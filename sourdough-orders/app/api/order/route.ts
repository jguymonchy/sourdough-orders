// app/api/orders/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// ----- Supabase (server-only keys) -----
const supabase = createClient(
  process.env.SUPABASE_URL as string,
  process.env.SUPABASE_SERVICE_ROLE_KEY as string, // server-only
  { auth: { persistSession: false } }
);

// Basic type for what we expect from the checkout form
type IncomingOrder = {
  customerEmail: string;
  customerName?: string;
  phone?: string;

  // whatever your UI sends:
  items?: Array<{
    id: string | number;
    name: string;
    qty: number;
    price?: number; // optional
    variant?: string;
  }>;

  notes?: string;
  subtotal?: number;
  tax?: number;
  total?: number;
  pickupDate?: string; // ISO
  pickupWindow?: string; // e.g. "9–11am"
  address?: string;     // if you deliver
};

// Simple HTML receipt (customize freely)
function renderReceiptHtml(order: IncomingOrder & { id?: string | number }) {
  const itemsHtml = (order.items ?? [])
    .map(
      (it) =>
        `<tr>
          <td style="padding:6px 8px;border-bottom:1px solid #eee">${it.name}${
            it.variant ? ` (${it.variant})` : ""
          }</td>
          <td style="padding:6px 8px;border-bottom:1px solid #eee;text-align:center">${it.qty}</td>
          <td style="padding:6px 8px;border-bottom:1px solid #eee;text-align:right">${
            typeof it.price === "number" ? `$${it.price.toFixed(2)}` : "-"
          }</td>
        </tr>`
    )
    .join("");

  const money = (n?: number) =>
    typeof n === "number" ? `$${n.toFixed(2)}` : "-";

  return `
  <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;line-height:1.45;color:#222">
    <h1 style="margin:0 0 8px">Thanks for your order${order.customerName ? `, ${order.customerName}` : ""}!</h1>
    ${order.id ? `<p style="margin:0 0 12px">Order #${order.id}</p>` : ""}
    ${
      order.pickupDate
        ? `<p style="margin:0 0 12px"><strong>Pickup:</strong> ${new Date(
            order.pickupDate
          ).toLocaleString()}${order.pickupWindow ? ` (${order.pickupWindow})` : ""}</p>`
        : ""
    }
    ${
      order.address
        ? `<p style="margin:0 0 12px"><strong>Address:</strong> ${order.address}</p>`
        : ""
    }
    ${
      order.notes
        ? `<p style="margin:0 0 12px"><strong>Notes:</strong> ${order.notes}</p>`
        : ""
    }

    <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin:12px 0 4px;width:100%">
      <thead>
        <tr>
          <th align="left" style="text-align:left;padding:6px 8px;border-bottom:2px solid #000">Item</th>
          <th align="center" style="text-align:center;padding:6px 8px;border-bottom:2px solid #000">Qty</th>
          <th align="right" style="text-align:right;padding:6px 8px;border-bottom:2px solid #000">Price</th>
        </tr>
      </thead>
      <tbody>${itemsHtml || `<tr><td colspan="3" style="padding:8px 0">No items listed</td></tr>`}</tbody>
    </table>

    <table width="100%" cellpadding="0" cellspacing="0" style="margin-top:8px">
      <tr>
        <td></td>
        <td style="width:200px">
          <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse">
            <tr><td style="padding:4px 0">Subtotal</td><td align="right">${money(order.subtotal)}</td></tr>
            <tr><td style="padding:4px 0">Tax</td><td align="right">${money(order.tax)}</td></tr>
            <tr><td style="padding:6px 0;font-weight:700;border-top:1px solid #eee">Total</td><td align="right" style="font-weight:700;border-top:1px solid #eee">${money(order.total)}</td></tr>
          </table>
        </td>
      </tr>
    </table>

    <p style="margin:16px 0 0">If anything looks off, just reply to this email and we’ll fix it.</p>
    <p style="margin:6px 0 0">— FieldLux / Kanarra Homestead</p>
  </div>`;
}

export async function POST(req: Request) {
  try {
    const order = (await req.json()) as IncomingOrder;

    // ---- minimal validation ----
    if (!order?.customerEmail) {
      return NextResponse.json(
        { error: "Missing 'customerEmail' on order." },
        { status: 400 }
      );
    }

    // ---- 1) Save to DB ----
    // Adjust table/columns to match your schema. Here we store the raw order in a JSONB column.
    const { data, error } = await supabase
      .from("orders")
      .insert({
        customer_email: order.customerEmail,
        customer_name: order.customerName ?? null,
        phone: order.phone ?? null,
        items: order.items ?? [],
        notes: order.notes ?? null,
        subtotal: order.subtotal ?? null,
        tax: order.tax ?? null,
        total: order.total ?? null,
        pickup_date: order.pickupDate ?? null,
        pickup_window: order.pickupWindow ?? null,
        address: order.address ?? null,
        raw: order, // optional: keep entire payload for traceability
      })
      .select()
      .single();

    if (error) {
      console.error("Supabase insert error:", error);
      return NextResponse.json(
        { error: "Failed to save order." },
        { status: 500 }
      );
    }

    // ---- 2) Send confirmation email(s) ----
    const origin = new URL(req.url).origin; // works locally and in prod
    const receiptHtml = renderReceiptHtml({ ...order, id: data?.id });

    const emailRes = await fetch(`${origin}/api/send-email`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        to: [
          order.customerEmail,                 // customer gets a copy
          process.env.FROM_EMAIL as string,    // you get a copy
        ],
        subject: `Your order is confirmed${
          data?.id ? ` — #${data.id}` : ""
        }`,
        html: receiptHtml,
      }),
    });

    if (!emailRes.ok) {
      const details = await emailRes.json().catch(() => ({}));
      console.error("Email send failed:", details);
      // We still return success for the order save, but include a warning
      return NextResponse.json(
        { success: true, order: data, emailWarning: details?.error ?? "Email failed" },
        { status: 200 }
      );
    }

    return NextResponse.json({ success: true, order: data }, { status: 200 });
  } catch (e: any) {
    console.error("Orders route error:", e);
    return NextResponse.json(
      { error: e?.message ?? "Unknown error" },
      { status: 500 }
    );
  }
}
