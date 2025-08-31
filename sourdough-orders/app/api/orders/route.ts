// app/api/orders/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL as string,
  process.env.SUPABASE_SERVICE_ROLE_KEY as string,
  { auth: { persistSession: false } }
);

type OrderItem = {
  id?: string | number;
  name: string;
  qty: number;
  price?: number;
  variant?: string;
};

type IncomingOrder = {
  customerEmail: string;
  customerName: string;
  phone?: string | null;
  ship?: boolean;
  address1?: string | null;
  address2?: string | null;
  city?: string | null;
  state?: string | null;
  postalCode?: string | null;
  country?: string | null;
  items: OrderItem[];
  notes?: string | null;
};

// ---------- helpers ----------
const firstNonEmpty = (...vals: unknown[]): string | undefined => {
  for (const v of vals) {
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return undefined;
};

function simpleOrderId(uuid: string) {
  return uuid.split("-")[0].toUpperCase(); // shorten UUID
}

// ----------------- EMAIL TEMPLATES -----------------
function renderCustomerEmail(order: IncomingOrder & { id?: string }) {
  return `
  <div style="font-family:sans-serif;color:#222;line-height:1.5">
    <h1>Thanks for your order, ${order.customerName}!</h1>
    <p>Order <b>#${order.id}</b></p>

    <h3>Your Items</h3>
    <table width="100%" cellpadding="6" cellspacing="0" border="0" style="border-collapse:collapse">
      <tr><th align="left">Item</th><th align="center">Qty</th><th align="right">Price</th></tr>
      ${order.items.map(it => `
        <tr>
          <td>${it.name}${it.variant ? ` (${it.variant})` : ""}</td>
          <td align="center">${it.qty}</td>
          <td align="right">${typeof it.price === "number" ? `$${it.price.toFixed(2)}` : "-"}</td>
        </tr>`).join("")}
    </table>

    <h3>Delivery</h3>
    <p>
      ${order.address1 ?? ""} ${order.address2 ?? ""}<br/>
      ${order.city ?? ""}, ${order.state ?? ""} ${order.postalCode ?? ""}<br/>
      ${order.country ?? ""}
    </p>

    <h3>Contact</h3>
    <p>Email: ${order.customerEmail}<br/>Phone: ${order.phone ?? "-"}</p>

    ${order.notes ? `<h3>Notes</h3><p>${order.notes}</p>` : ""}

    <p style="margin-top:20px">If anything looks off, just reply to this email and we’ll fix it.</p>
    <p>— Kanarra Heights Homestead</p>
  </div>`;
}

function renderAdminEmail(order: IncomingOrder & { id?: string }) {
  return `
  <div style="font-family:sans-serif;color:#222;line-height:1.5">
    <h1>NEW ORDER received</h1>
    <p><b>Order # ${order.id}</b></p>

    <h3>Customer</h3>
    <p>
      <b>Name:</b> ${order.customerName}<br/>
      <b>Email:</b> ${order.customerEmail}<br/>
      <b>Phone:</b> ${order.phone ?? "-"}
    </p>

    <h3>Delivery</h3>
    <p>
      ${order.address1 ?? ""} ${order.address2 ?? ""}<br/>
      ${order.city ?? ""}, ${order.state ?? ""} ${order.postalCode ?? ""}<br/>
      ${order.country ?? ""}
    </p>

    <h3>Items</h3>
    <table width="100%" cellpadding="6" cellspacing="0" border="0" style="border-collapse:collapse">
      <tr><th align="left">Item</th><th align="center">Qty</th><th align="right">Price</th></tr>
      ${order.items.map(it => `
        <tr>
          <td>${it.name}${it.variant ? ` (${it.variant})` : ""}</td>
          <td align="center">${it.qty}</td>
          <td align="right">${typeof it.price === "number" ? `$${it.price.toFixed(2)}` : "-"}</td>
        </tr>`).join("")}
    </table>

    ${order.notes ? `<h3>Notes</h3><p>${order.notes}</p>` : ""}

    <p>— Kanarra Heights Homestead</p>
  </div>`;
}

// ----------------- MAIN HANDLER -----------------
export async function POST(req: Request) {
  try {
    const raw: any = await req.json();

    const email = firstNonEmpty(raw.customerEmail, raw.email, raw?.contact?.email);
    if (!email) return NextResponse.json({ error: "Missing customerEmail" }, { status: 400 });

    const name = firstNonEmpty(raw.customerName, raw.name, raw.fullName, raw.full_name) ?? "Customer";

    const order: IncomingOrder = {
      customerEmail: email,
      customerName: name,
      phone: firstNonEmpty(raw.phone, raw?.contact?.phone) ?? null,
      ship: typeof raw.ship === "boolean" ? raw.ship : true,
      address1: firstNonEmpty(raw.address1, raw.addressLine1, raw.street) ?? null,
      address2: firstNonEmpty(raw.address2, raw.addressLine2) ?? null,
      city: firstNonEmpty(raw.city) ?? null,
      state: firstNonEmpty(raw.state) ?? null,
      postalCode: firstNonEmpty(raw.postalCode, raw.zip) ?? null,
      country: firstNonEmpty(raw.country) ?? "USA",
      items: Array.isArray(raw.items) ? raw.items : [],
      notes: firstNonEmpty(raw.notes) ?? null,
    };

    // Save to Supabase
    const { data, error } = await supabase.from("orders").insert({
      customer_name: order.customerName,
      email: order.customerEmail,
      phone: order.phone,
      ship: order.ship,
      address_line1: order.address1,
      address_line2: order.address2,
      city: order.city,
      state: order.state,
      postal_code: order.postalCode,
      country: order.country,
      items: order.items,
      notes: order.notes,
      status: "new",
    }).select().single();

    if (error) {
      console.error("Supabase insert error:", error);
      return NextResponse.json({ error: "Failed to save order" }, { status: 500 });
    }

    const orderId = simpleOrderId(data.id);
    const origin = new URL(req.url).origin;
    const admin = process.env.ADMIN_NOTIFY_EMAIL || process.env.FROM_EMAIL;

    // Send customer email
    await fetch(`${origin}/api/send-email`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        from: `Kanarra Heights Homestead <${process.env.FROM_EMAIL}>`,
        to: order.customerEmail,
        subject: `Your order is confirmed — #${orderId}`,
        html: renderCustomerEmail({ ...order, id: orderId }),
      }),
    });

    // Send admin email
    await fetch(`${origin}/api/send-email`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        from: `Kanarra Heights Homestead <${process.env.FROM_EMAIL}>`,
        to: admin,
        subject: `NEW ORDER — #${orderId}`,
        html: renderAdminEmail({ ...order, id: orderId }),
      }),
    });

    return NextResponse.json({ success: true, order: { ...data, id: orderId } });
  } catch (e: any) {
    console.error("Orders route error:", e);
    return NextResponse.json({ error: e.message ?? "Unknown error" }, { status: 500 });
  }
}
