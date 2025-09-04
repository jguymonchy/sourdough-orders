// app/api/orders/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

const shortId = (u: string) =>
  u?.replace?.(/-/g, "")?.slice(0, 8)?.toUpperCase?.() || "";

const first = (...v: any[]) =>
  v.find((x) => typeof x === "string" && x.trim())?.toString().trim();

async function readJson(req: Request) {
  const t = await req.text();
  if (!t) return { ok: false as const, error: "Empty body" };
  try {
    return { ok: true as const, data: JSON.parse(t) };
  } catch {
    return { ok: false as const, error: "Invalid JSON" };
  }
}

function currency(n: number | null | undefined) {
  const val = Number(n || 0);
  return `$${val.toFixed(2)}`;
}

function htmlEscape(s: string | null | undefined) {
  return (s || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

type Line = { sku?: string; name?: string; item?: string; qty?: number; unit_price?: number };

function renderEmailHTML(opts: {
  kh: string;
  customer_name: string;
  email: string;
  phone?: string | null;
  ship: boolean;
  address_line1?: string | null;
  address_line2?: string | null;
  city?: string | null;
  state?: string | null;
  postal_code?: string | null;
  country?: string | null;
  notes?: string | null;
  items: Line[];
  isAdmin: boolean;
}) {
  const {
    kh,
    customer_name,
    email,
    phone,
    ship,
    address_line1,
    address_line2,
    city,
    state,
    postal_code,
    country = "USA",
    notes,
    items,
    isAdmin,
  } = opts;

  const rows = (items || []).map((i) => {
    const nm = i.name || i.item || "Item";
    const qty = Number(i.qty || 0);
    const price = Number(i.unit_price || 0);
    const line = qty * price;
    return {
      name: nm,
      qty,
      price,
      line,
    };
  });

  const total = rows.reduce((s, r) => s + r.line, 0);

  const addrHTML = ship
    ? `
      <p style="margin:4px 0 0 0">${htmlEscape(address_line1)}</p>
      ${address_line2 ? `<p style="margin:4px 0 0 0">${htmlEscape(address_line2)}</p>` : ""}
      <p style="margin:4px 0 0 0">${htmlEscape(city)}, ${htmlEscape(state)} ${htmlEscape(postal_code)}</p>
      <p style="margin:4px 0 0 0">${htmlEscape(country)}</p>
    `
    : `<p style="margin:4px 0 0 0">Pickup at Festival City Farmers Market (Cedar City)</p>`;

  const headline = isAdmin ? "NEW ORDER received" : "Thanks for your order!";
  const preface = isAdmin
    ? `Order # ${kh}`
    : `Your order is confirmed — #${kh}`;

  const noteBlock = notes
    ? `
      <h3 style="margin:24px 0 8px;font-size:16px">Notes</h3>
      <p style="margin:0">${htmlEscape(notes)}</p>
    `
    : "";

  return `<!doctype html>
<html>
  <body style="margin:0;padding:0;background:#f6f6f6;font-family:system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif">
    <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
      <tr><td align="center" style="padding:24px">
        <table role="presentation" cellpadding="0" cellspacing="0" width="640" style="background:#ffffff;border-radius:12px;overflow:hidden">
          <tr>
            <td style="padding:20px 24px;border-bottom:1px solid #eee">
              <div style="font-size:20px;font-weight:700">Kanarra Heights Homestead</div>
              <div style="color:#666;font-size:12px">Artisan Sourdough Bread</div>
            </td>
          </tr>
          <tr>
            <td style="padding:24px">
              <h1 style="margin:0 0 4px;font-size:22px">${headline}</h1>
              <div style="color:#555;margin:0 0 16px">${preface}</div>

              <h3 style="margin:16px 0 6px;font-size:16px">Customer</h3>
              <p style="margin:0">${htmlEscape(customer_name)}</p>
              <p style="margin:4px 0 0 0">${htmlEscape(email)}</p>
              ${phone ? `<p style="margin:4px 0 0 0">${htmlEscape(phone)}</p>` : ""}

              <h3 style="margin:16px 0 6px;font-size:16px">${ship ? "Delivery" : "Pickup"}</h3>
              ${addrHTML}

              <h3 style="margin:24px 0 8px;font-size:16px">Items</h3>
              <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="border-collapse:collapse">
                <thead>
                  <tr>
                    <th align="left" style="text-align:left;padding:8px;border-bottom:1px solid #eee;font-size:13px">Item</th>
                    <th align="right" style="text-align:right;padding:8px;border-bottom:1px solid #eee;font-size:13px">Qty</th>
                    <th align="right" style="text-align:right;padding:8px;border-bottom:1px solid #eee;font-size:13px">Price</th>
                    <th align="right" style="text-align:right;padding:8px;border-bottom:1px solid #eee;font-size:13px">Line</th>
                  </tr>
                </thead>
                <tbody>
                  ${rows
                    .map(
                      (r) => `
                    <tr>
                      <td style="padding:8px;border-bottom:1px solid #f3f3f3">${htmlEscape(r.name)}</td>
                      <td align="right" style="padding:8px;border-bottom:1px solid #f3f3f3;text-align:right">${r.qty}</td>
                      <td align="right" style="padding:8px;border-bottom:1px solid #f3f3f3;text-align:right">${currency(r.price)}</td>
                      <td align="right" style="padding:8px;border-bottom:1px solid #f3f3f3;text-align:right">${currency(r.line)}</td>
                    </tr>`
                    )
                    .join("")}
                  <tr>
                    <td></td><td></td>
                    <td align="right" style="padding:10px 8px;font-weight:700;text-align:right">Total</td>
                    <td align="right" style="padding:10px 8px;font-weight:700;text-align:right">${currency(total)}</td>
                  </tr>
                </tbody>
              </table>

              ${noteBlock}

              ${
                isAdmin
                  ? `<p style="color:#999;font-size:12px;margin-top:20px">This notification was sent to ADMIN_NOTIFY_EMAIL.</p>`
                  : `<p style="color:#444;font-size:13px;margin-top:20px">Reply to this email if you have any questions. For Venmo, include your order ID <b>#${kh}</b> in the note.</p>`
              }
            </td>
          </tr>
          <tr>
            <td style="padding:16px 24px;border-top:1px solid #eee;color:#888;font-size:12px">
              — Kanarra Heights Homestead
            </td>
          </tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>`;
}

function renderText(customer_name: string, kh: string, items: Line[], ship: boolean) {
  const rows = (items || []).map((i) => `${i.qty || 0}× ${i.name || i.item}`).join(", ");
  return [
    ship ? "NEW ORDER (Shipping)" : "NEW ORDER (Pickup)",
    `Order #${kh}`,
    `Customer: ${customer_name}`,
    `Items: ${rows}`,
    "",
    "— Kanarra Heights Homestead",
  ].join("\n");
}

export async function POST(req: Request) {
  const parsed = await readJson(req);
  if (!parsed.ok) return NextResponse.json({ ok: false, error: parsed.error }, { status: 400 });
  const raw = parsed.data;

  try {
    const email =
      first(raw.email, raw.customerEmail, raw?.contact?.email) || "";
    if (!email) return NextResponse.json({ ok: false, error: "Missing email" }, { status: 400 });

    const customer_name =
      first(raw.customer_name, raw.customerName, raw.name, raw.fullName, raw.full_name) ||
      email.split("@")[0] ||
      "Customer";

    const method = first(raw.fulfillment, raw.fulfillment_method) || (raw.ship ? "shipping" : "pickup");
    const ship = method === "shipping" || !!raw.ship;
    const items: Line[] = Array.isArray(raw.items) ? raw.items : [];

    const address_line1 = first(raw.address_line1, raw.address1, raw.addressLine1, raw.street) || null;
    const address_line2 = first(
      raw.address_line2,
      raw.address2,
      raw.addressLine2,
      raw.apt,
      raw.unit,
      raw.suite
    ) || null;
    const city = first(raw.city) || null;
    const state = first(raw.state, raw.region, raw.province) || null;
    const postal_code = first(raw.postal_code, raw.postal, raw.postcode, raw.zip) || null;
    const country = first(raw.country, raw.countryCode, raw.country_code) || "USA";
    const notes = first(raw.notes, raw.orderNotes, raw.comment) || null;
    const phone = first(raw.phone, raw?.contact?.phone) || null;

    // Insert into Supabase
    const { data, error } = await supabase
      .from("orders")
      .insert({
        customer_name,
        email,
        phone,
        ship,
        address_line1,
        address_line2,
        city,
        state,
        postal_code,
        country,
        items,
        notes,
        status: "open",
      })
      .select()
      .single();

    if (error)
      return NextResponse.json(
        { ok: false, error: `Supabase insert failed: ${error.message}` },
        { status: 500 }
      );

    const origin = new URL(req.url).origin;
    const kh = shortId(data.id || "");
    const itemsLine = (items || []).map((i) => `${i.qty}× ${i.item || i.name}`).join(", ");

    // Helper to send and log result
    async function send(to: string[], subject: string, html: string, text: string) {
      const resp = await fetch(`${origin}/api/send-email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to,
          subject,
          html,
          text,
          replyTo: process.env.FROM_EMAIL, // display name supported
        }),
      });
      const dbg = await resp.text();
      console.log("[orders] /api/send-email", subject, resp.status, dbg?.slice(0, 500));
      return resp.ok;
    }

    // Render emails
    const customerHTML = renderEmailHTML({
      kh,
      customer_name,
      email,
      phone,
      ship,
      address_line1,
      address_line2,
      city,
      state,
      postal_code,
      country,
      notes,
      items,
      isAdmin: false,
    });
    const adminHTML = renderEmailHTML({
      kh,
      customer_name,
      email,
      phone,
      ship,
      address_line1,
      address_line2,
      city,
      state,
      postal_code,
      country,
      notes,
      items,
      isAdmin: true,
    });

    const customerText = renderText(customer_name, kh, items, ship);
    const adminText = `NEW ORDER — #${kh}\n${customer_name} placed an order. Items: ${itemsLine}`;

    // Send to customer
    await send([email], `Your order is confirmed — #${kh}`, customerHTML, customerText);

    // Send to admin
    const adminTo = [process.env.ADMIN_NOTIFY_EMAIL || process.env.FROM_EMAIL].filter(Boolean) as string[];
    await send(adminTo, `NEW ORDER — #${kh}`, adminHTML, adminText);

    return NextResponse.json({ ok: true, kh, order_id: data.id }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "Unknown error" }, { status: 500 });
  }
}
