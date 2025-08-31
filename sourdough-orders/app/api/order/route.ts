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
  phone?: string;
  ship?: boolean;
  address1?: string;
  address2?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
  items: OrderItem[];
  notes?: string;
};

function renderReceiptHtml(order: IncomingOrder & { id?: string }) {
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
    <h1 style="margin:0 0 8px">Thanks for your order${order.customerName ? `, ${order.customerName}` : ""}!</h1>
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

export async function POST(req: Request) {
  try {
    const raw = await req.json();

    // -------- NORMALIZE INCOMING FIELDS --------
    const order: IncomingOrder = {
      // accept several possible field names from your form
      customerEmail:
        raw.customerEmail ??
        raw.email ??
        raw?.contact?.email ??
        "",
      customerName:
        raw.customerName ??
        raw.name ??
        raw?.contact?.name ??
        "",
      phone: raw.phone ?? raw?.contact?.phone ?? null,
      ship: raw.ship ?? true,

      // addresses (accept multiple shapes)
      address1: raw.address1 ?? raw.addressLine1 ?? raw.street ?? null,
      address2: raw.address2 ?? raw.addressLine2 ?? null,
      city: raw.city ?? null,
      state: raw.state ?? null,
      postalCode: raw.postalCode ?? raw.zip ?? null,
      country: raw.country ?? "USA",

      // order lines
      items: Array.isArray(raw.items) ? raw.items : [],

      // extra
      notes: raw.notes ?? null,
    };

    // -------- VALIDATION --------
    if (!order.customerEmail || typeof order.customerEmail !== "string" || !order.customerEmail.trim()) {
      return NextResponse.json({ error: "Missing 'customerEmail'." }, { status: 400 });
    }
    if (!order.customerName || typeof order.customerName !== "string" || !order.customerName.trim()) {
      return NextResponse.json({ error: "Missing 'customerName'." }, { status: 400 });
    }
    if (!Array.isArray(order.items)) {
      return NextResponse.json({ error: "'items' must be an array." }, { status: 400 });
    }

    // -------- SAVE TO SUPABASE (matches your existing columns) --------
    const { data, error } = await supabase
      .from("orders")
      .insert({
        customer_name: order.customerName,
        email: order.customerEmail,
        phone: order.phone ?? null,
        ship: order.ship ?? true,
        address1: order.address1 ?? null,
        address2: order.address2 ?? null,
        city: order.city ?? null,
        state: order.state ?? null,
        postal_code: order.postalCode ?? null,
        country: order.country ?? "USA",
        items: order.items,
        notes: order.notes ?? null,
        status: "new",
      })
      .select()
      .single();

    if (error) {
      console.error("Supabase insert error:", error);
      return NextResponse.json({ error: "Failed to save order." }, { status: 500 });
    }

    // -------- SEND CONFIRMATION EMAIL (customer + you) --------
    const origin = new URL(req.url).origin; // works local & prod
    const html = renderReceiptHtml({ ...order, id: data?.id });

    const emailRes = await fetch(`${origin}/api/send-email`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        to: [order.customerEmail, process.env.FROM_EMAIL as string],
        subject: `Your order is confirmed${data?.id ? ` — #${data.id}` : ""}`,
        html,
      }),
    });

    if (!emailRes.ok) {
      const details = await emailRes.json().catch(() => ({}));
      console.error("Email send failed:", details);
      // Order saved; surface a warning in response
      return NextResponse.json(
        { success: true, order: data, emailWarning: details?.error ?? "Email failed" },
        { status: 200 }
      );
    }

    return NextResponse.json({ success: true, order: data }, { status: 200 });
  } catch (e: any) {
    console.error("Orders route error:", e);
    return NextResponse.json({ error: e?.message ?? "Unknown error" }, { status: 500 });
  }
}
