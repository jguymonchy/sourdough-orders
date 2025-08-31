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

const toTitle = (s: string) =>
  s
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase()
    .replace(/\b\w/g, (m) => m.toUpperCase());

const inferNameFromEmail = (email: string) => {
  const local = (email.split("@")[0] || "").replace(/[._-]+/g, " ");
  return local ? toTitle(local) : "Customer";
};

// --------- RECEIPT HTML (customer copy) ---------
function renderCustomerHtml(order: IncomingOrder & { id?: string }) {
  const itemsHtml =
    order.items?.map(
      (it) => `
        <tr>
          <td style="padding:6px 8px;border-bottom:1px solid #eee">${it.name}${it.variant ? ` (${it.variant})` : ""}</td>
          <td style="padding:6px 8px;border-bottom:1px solid #eee;text-align:center">${it.qty}</td>
          <td style="padding:6px 8px;border-bottom:1px solid #eee;text-align:right">
            ${typeof it.price === "number" ? `$${it.price.toFixed(2)}` : "-"}
          </td>
        </tr>`
    ).join("") || `<tr><td colspan="3" style="padding:8px 0">No items listed</td></tr>`;

  return `
  <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;line-height:1.45;color:#222">
    <h1 style="margin:0 0 8px">Thanks for your order, ${order.customerName}!</h1>
    ${order.id ? `<p style="margin:0 0 12px">Order #${order.id}</p>` : ""}
    <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin:12px 0 4px;width:100%">
      <thead>
        <tr>
          <th align="left" style="text-align:left;padding:6px 8px;border-bottom:2px solid #000">Item</th>
          <th align="center" style="text-align:center;padding:6px 8px;border-bottom:2px solid #000">Qty</th>
          <th align="right" style="text-align:right;padding:6px 8px;border-bottom:2px solid #000">Price</th>
        </tr>
      </thead>
      <tbody>${itemsHtml}</tbody>
    </table>
    <p style="margin:16px 0 0">If anything looks off, just reply to this email and we’ll fix it.</p>
    <p style="margin:6px 0 0">— FieldLux / Kanarra Homestead</p>
  </div>`;
}

// --------- ADMIN HTML (your copy) ---------
function renderAdminHtml(order: IncomingOrder & { id?: string }) {
  return `
  <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;line-height:1.45;color:#222">
    <h1 style="margin:0 0 8px">NEW ORDER received</h1>
    ${order.id ? `<p style="margin:0 0 12px">Order #${order.id}</p>` : ""}

    <h2>Customer</h2>
    <p><strong>${order.customerName}</strong> (${order.customerEmail})</p>
    ${order.phone ? `<p>Phone: ${order.phone}</p>` : ""}

    <h2>Delivery</h2>
    <p>
      ${order.address1 ?? ""} ${order.address2 ?? ""}<br/>
      ${order.city ?? ""}, ${order.state ?? ""} ${order.postalCode ?? ""}<br/>
      ${order.country ?? "USA"}
    </p>

    <h2>Items</h2>
    <pre>${JSON.stringify(order.items, null, 2)}</pre>

    ${order.notes ? `<h2>Notes</h2><p>${order.notes}</p>` : ""}
  </div>`;
}

export async function POST(req: Request) {
  try {
    console.log("HIT /api/orders v2 (dual-template)");

    const raw: any = await req.json();

    // -------- normalize inputs --------
    const email = firstNonEmpty(
      raw.customerEmail,
      raw.email,
      raw?.contact?.email
    );

    const combinedName1 =
      raw.firstName && raw.lastName
        ? `${raw.firstName} ${raw.lastName}`
        : undefined;
    const combinedName2 =
      raw.first_name && raw.last_name
        ? `${raw.first_name} ${raw.last_name}`
        : undefined;

    let name =
      firstNonEmpty(
        raw.customerName,
        raw.name,
        raw.fullName,
        raw.full_name,
        combinedName1,
        combinedName2,
        raw?.contact?.name
      ) || (email ? inferNameFromEmail(email) : "Customer");

    if (!email) {
      return NextResponse.json({ error: "Missing 'customerEmail'." }, { status: 400 });
    }

    const items: OrderItem[] = Array.isArray(raw.items) ? raw.items : [];

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
      items,
      notes: firstNonEmpty(raw.notes) ?? null,
    };

    // -------- SAVE TO SUPABASE --------
    const { data, error } = await supabase
      .from("orders")
      .insert({
        customer_name: order.customerName,
        email: order.customerEmail,
        phone: order.phone,
        ship: order.ship ?? true,
        address_line1: order.address1,
        address_line2: order.address2,
        city: order.city,
        state: order.state,
        postal_code: order.postalCode,
        country: order.country ?? "USA",
        items: order.items ?? [],
        notes: order.notes,
        status: "new",
      })
      .select()
      .single();

    if (error) {
      console.error("Supabase insert error:", error);
      return NextResponse.json({ error: `Failed to save order: ${error.message}` }, { status: 500 });
    }

    const origin = new URL(req.url).origin;
    const customerHtml = renderCustomerHtml({ ...order, id: data?.id });
    const adminHtml = renderAdminHtml({ ...order, id: data?.id });

    const admin = process.env.ADMIN_NOTIFY_EMAIL || process.env.FROM_EMAIL;

    // send customer copy
    await fetch(`${origin}/api/send-email`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        to: order.customerEmail,
        subject: `Your order is confirmed${data?.id ? ` — #${data.id}` : ""}`,
        html: customerHtml,
      }),
    });

    // send admin copy
    await fetch(`${origin}/api/send-email`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        to: admin,
        subject: `NEW ORDER${data?.id ? ` — #${data.id}` : ""}`,
        html: adminHtml,
      }),
    });

    return NextResponse.json({ success: true, order: data }, { status: 200 });
  } catch (e: any) {
    console.error("Orders route error:", e);
    return NextResponse.json({ error: e?.message ?? "Unknown error" }, { status: 500 });
  }
}
