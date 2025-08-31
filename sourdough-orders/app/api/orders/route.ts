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
  sku?: string;
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

const shortId = (uuid?: string) =>
  (uuid || "")
    .replace(/-/g, "")
    .slice(0, 8)
    .toUpperCase() || undefined;

const renderAddressBlock = (o: IncomingOrder) => {
  const lines: string[] = [];
  if (o.address1) lines.push(o.address1);
  if (o.address2) lines.push(o.address2);
  const cityLine = [o.city, o.state, o.postalCode].filter(Boolean).join(", ");
  if (cityLine) lines.push(cityLine);
  if (o.country) lines.push(String(o.country));
  if (!lines.length) return "<em>No address provided</em>";
  return lines.map((l) => `<div>${l}</div>`).join("");
};

function renderItemsTable(items: OrderItem[]) {
  const rows =
    items?.map(
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
    <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin:12px 0 4px;width:100%">
      <thead>
        <tr>
          <th align="left" style="text-align:left;padding:6px 8px;border-bottom:2px solid #000">Item</th>
          <th align="center" style="text-align:center;padding:6px 8px;border-bottom:2px solid #000">Qty</th>
          <th align="right" style="text-align:right;padding:6px 8px;border-bottom:2px solid #000">Price</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>`;
}

// --------- CUSTOMER HTML ---------
function renderCustomerHtml(order: IncomingOrder & { id?: string }) {
  const idShort = shortId(order.id);
  return `
  <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;line-height:1.45;color:#222">
    <h1 style="margin:0 0 8px">Thanks for your order, ${toTitle(order.customerName)}!</h1>
    ${idShort ? `<p style="margin:0 0 12px">Order #${idShort}</p>` : ""}

    <h3 style="margin:16px 0 6px">Your Items</h3>
    ${renderItemsTable(order.items)}

    <h3 style="margin:16px 0 6px">Delivery</h3>
    <div style="padding:8px 10px;background:#fafafa;border:1px solid #eee;border-radius:8px;">
      ${renderAddressBlock(order)}
    </div>

    <h3 style="margin:16px 0 6px">Contact</h3>
    <div style="padding:8px 10px;background:#fafafa;border:1px solid #eee;border-radius:8px;">
      <div><strong>Email:</strong> ${order.customerEmail}</div>
      ${order.phone ? `<div><strong>Phone:</strong> ${order.phone}</div>` : ""}
    </div>

    ${
      order.notes
        ? `<h3 style="margin:16px 0 6px">Notes</h3>
           <div style="padding:8px 10px;background:#fafafa;border:1px solid #eee;border-radius:8px;">${order.notes}</div>`
        : ""
    }

    <p style="margin:16px 0 0">If anything looks off, just reply to this email and we’ll fix it.</p>
    <p style="margin:6px 0 0">— Kanarra Heights Homestead</p>
  </div>`;
}

// --------- ADMIN HTML ---------
function renderAdminHtml(order: IncomingOrder & { id?: string }) {
  const idShort = shortId(order.id);
  return `
  <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;line-height:1.45;color:#222">
    <h1 style="margin:0 0 8px">NEW ORDER received</h1>
    ${idShort ? `<p style="margin:0 0 12px"><strong>Order #</strong> ${idShort}</p>` : ""}

    <h3 style="margin:16px 0 6px">Customer</h3>
    <div style="padding:8px 10px;background:#fafafa;border:1px solid #eee;border-radius:8px;">
      <div><strong>Name:</strong> ${toTitle(order.customerName)}</div>
      <div><strong>Email:</strong> ${order.customerEmail}</div>
      ${order.phone ? `<div><strong>Phone:</strong> ${order.phone}</div>` : ""}
    </div>

    <h3 style="margin:16px 0 6px">Delivery</h3>
    <div style="padding:8px 10px;background:#fafafa;border:1px solid #eee;border-radius:8px;">
      ${renderAddressBlock(order)}
    </div>

    <h3 style="margin:16px 0 6px">Items</h3>
    ${renderItemsTable(order.items)}

    ${
      order.notes
        ? `<h3 style="margin:16px 0 6px">Notes</h3>
           <div style="padding:8px 10px;background:#fff3cd;border:1px solid #ffe69c;border-radius:8px;">${order.notes}</div>`
        : ""
    }

    <p style="margin:16px 0 0">— Kanarra Heights Homestead</p>
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

    let nameCandidate = firstNonEmpty(
      raw.customerName,
      raw.name,
      raw.fullName,
      raw.full_name,
      combinedName1,
      combinedName2,
      raw?.contact?.name
    );

    // Prefer real name when present; only infer from email if truly missing
    const name = nameCandidate && nameCandidate.trim()
      ? toTitle(nameCandidate)
      : (email ? inferNameFromEmail(email) : "Customer");

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
    const idShort = shortId(data?.id);
    const customerHtml = renderCustomerHtml({ ...order, id: data?.id });
    const adminHtml = renderAdminHtml({ ...order, id: data?.id });
    const admin = process.env.ADMIN_NOTIFY_EMAIL || process.env.FROM_EMAIL;

    // send customer copy
    const sendCustomer = fetch(`${origin}/api/send-email`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        to: order.customerEmail,
        subject: `Your order is confirmed${idShort ? ` — #${idShort}` : ""}`,
        html: customerHtml,
        fromName: "Kanarra Heights Homestead", // (update your send-email route to honor this)
      }),
    });

    // send admin copy
    const sendAdmin = fetch(`${origin}/api/send-email`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        to: admin,
        subject: `NEW ORDER${idShort ? ` — #${idShort}` : ""}`,
        html: adminHtml,
        fromName: "Kanarra Heights Homestead", // (update your send-email route to honor this)
      }),
    });

    await Promise.all([sendCustomer, sendAdmin]);

    return NextResponse.json({ success: true, order: data }, { status: 200 });
  } catch (e: any) {
    console.error("Orders route error:", e);
    return NextResponse.json({ error: e?.message ?? "Unknown error" }, { status: 500 });
  }
}
