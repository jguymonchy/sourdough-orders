import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

type Line = { sku?: string; name?: string; item?: string; qty?: number; unit_price?: number };

const first = (...v: any[]) =>
  v.find((x) => typeof x === "string" && x.trim())?.toString().trim();

async function readJson(req: Request) {
  const t = await req.text();
  if (!t) return { ok: false as const, error: "Empty body" };
  try { return { ok: true as const, data: JSON.parse(t) }; }
  catch { return { ok: false as const, error: "Invalid JSON" }; }
}

function toYMD(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
function fromYMD(s?: string | null) {
  if (!s) return null;
  const [y, m, d] = s.split("-").map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
}
function nextDowFrom(from: Date, targetDow: number) {
  const d = new Date(from);
  d.setHours(0, 0, 0, 0);
  while (d.getDay() !== targetDow) d.setDate(d.getDate() + 1);
  return d;
}
function esc(s: string | null | undefined) {
  return (s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
function currency(n: number | null | undefined) {
  const val = Number(n || 0);
  return `$${val.toFixed(2)}`;
}

function summarizeItems(lines: Line[]) {
  const rows = (lines || []).map(i => {
    const name = i.name || i.item || "Item";
    const qty = Number(i.qty || 0);
    const price = Number(i.unit_price || 0);
    const line_total = qty * price;
    return { name, qty, price, line_total };
  });
  const items_list = rows.map(r => `${r.qty}× ${r.name}`).join(", ");
  const items_count = rows.reduce((s, r) => s + r.qty, 0);
  const order_total = rows.reduce((s, r) => s + r.line_total, 0);
  return { rows, items_list, items_count, order_total };
}

function renderEmailHTML(opts: {
  kh: string; customer_name: string; email: string; phone?: string | null;
  ship: boolean; address_line1?: string | null; address_line2?: string | null;
  city?: string | null; state?: string | null; postal_code?: string | null; country?: string | null;
  notes?: string | null; items: Line[]; isAdmin: boolean; origin?: string;
}) {
  const {
    kh, customer_name, email, phone, ship, address_line1, address_line2, city, state, postal_code,
    country = "USA", notes, items, isAdmin, origin = ""
  } = opts;

  const { rows, order_total } = summarizeItems(items);

  const addrHTML = ship
    ? `
      <p style="margin:4px 0 0 0">${esc(address_line1)}</p>
      ${address_line2 ? `<p style="margin:4px 0 0 0">${esc(address_line2)}</p>` : ""}
      <p style="margin:4px 0 0 0">${esc(city)}, ${esc(state)} ${esc(postal_code)}</p>
      <p style="margin:4px 0 0 0">${esc(country)}</p>`
    : `<p style="margin:4px 0 0 0">Pickup at Festival City Farmers Market (Cedar City)</p>`;

  const headline = isAdmin ? "NEW ORDER received" : "Thanks for your order!";
  const preface  = isAdmin ? `Order # ${kh}` : `Your order is confirmed — #${kh}`;
  const noteBlock = notes ? `<h3 style="margin:24px 0 8px;font-size:16px">Notes</h3><p style="margin:0">${esc(notes)}</p>` : "";

  // --- Payment section for customers ---
  const payBlock = !isAdmin ? `
    <h3 style="margin:24px 0 8px;font-size:16px">Payment</h3>
    <p style="margin:0 0 8px">Please pay within <b>24 hours</b> via Venmo. Include your order ID <b>#${kh}</b> in the note.</p>
    <p style="margin:0 0 8px">
      <a href="venmo://paycharge?txn=pay&recipients=${encodeURIComponent("John-T-Guymon")}&amount=${order_total}&note=${encodeURIComponent(kh + " — Kanarra Heights Homestead")}"
         style="color:#3d95ce;text-decoration:underline">Open Venmo (app)</a>
      &nbsp;•&nbsp;
      <a href="https://account.venmo.com/u/John-T-Guymon" target="_blank" rel="noopener"
         style="color:#3d95ce;text-decoration:underline">Open Venmo on the web</a>
    </p>
    <p style="margin:12px 0 0">
      <img src="${origin}/venmo-qr.png" alt="Venmo QR Code" style="max-width:180px;height:auto;border:1px solid #ccc;border-radius:8px;padding:4px" />
    </p>
  ` : "";

  return `<!doctype html><html><body style="margin:0;padding:0;background:#f6f6f6;font-family:system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif">
  <table role="presentation" cellpadding="0" cellspacing="0" width="100%"><tr><td align="center" style="padding:24px">
  <table role="presentation" cellpadding="0" cellspacing="0" width="640" style="background:#fff;border-radius:12px;overflow:hidden">
    <tr><td style="padding:20px 24px;border-bottom:1px solid #eee">
      <div style="font-size:20px;font-weight:700">Kanarra Heights Homestead</div>
      <div style="color:#666;font-size:12px">Artisan Sourdough Bread</div>
    </td></tr>
    <tr><td style="padding:24px">
      <h1 style="margin:0 0 4px;font-size:22px">${headline}</h1>
      <div style="color:#555;margin:0 0 16px">${preface}</div>

      <h3 style="margin:16px 0 6px;font-size:16px">Customer</h3>
      <p style="margin:0">${esc(customer_name)}</p>
      <p style="margin:4px 0 0 0">${esc(email)}</p>
      ${phone ? `<p style="margin:4px 0 0 0">${esc(phone)}</p>` : ""}

      <h3 style="margin:16px 0 6px;font-size:16px">${opts.ship ? "Shipping" : "Pickup"}</h3>
      ${addrHTML}

      <h3 style="margin:24px 0 8px;font-size:16px">Items</h3>
      <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="border-collapse:collapse">
        <thead>
          <tr>
            <th align="left"  style="text-align:left;padding:8px;border-bottom:1px solid #eee;font-size:13px">Item</th>
            <th align="right" style="text-align:right;padding:8px;border-bottom:1px solid #eee;font-size:13px">Qty</th>
            <th align="right" style="text-align:right;padding:8px;border-bottom:1px solid #eee;font-size:13px">Price</th>
            <th align="right" style="text-align:right;padding:8px;border-bottom:1px solid #eee;font-size:13px">Line</th>
          </tr>
        </thead>
        <tbody>
          ${rows.map(r => `
            <tr>
              <td style="padding:8px;border-bottom:1px solid #f3f3f3">${esc(r.name)}</td>
              <td align="right" style="padding:8px;border-bottom:1px solid #f3f3f3;text-align:right">${r.qty}</td>
              <td align="right" style="padding:8px;border-bottom:1px solid #f3f3f3;text-align:right">${currency(r.price)}</td>
              <td align="right" style="padding:8px;border-bottom:1px solid #f3f3f3;text-align:right">${currency(r.line_total)}</td>
            </tr>`).join("")}
          <tr>
            <td></td><td></td>
            <td align="right" style="padding:10px 8px;font-weight:700;text-align:right">Total</td>
            <td align="right" style="padding:10px 8px;font-weight:700;text-align:right">${currency(order_total)}</td>
          </tr>
        </tbody>
      </table>
      ${noteBlock}
      ${payBlock}
      ${isAdmin
        ? `<p style="color:#999;font-size:12px;margin-top:20px">This notification was sent to ADMIN_NOTIFY_EMAIL.</p>`
        : `<p style="color:#444;font-size:13px;margin-top:20px">Reply if you have questions.</p>`}
    </td></tr>
    <tr><td style="padding:16px 24px;border-top:1px solid #eee;color:#888;font-size:12px">— Kanarra Heights Homestead</td></tr>
  </table>
  </td></tr></table>
  </body></html>`;
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
    const email = first(raw.email, raw.customerEmail, raw?.contact?.email) || "";
    if (!email) return NextResponse.json({ ok: false, error: "Missing email" }, { status: 400 });

    const customer_name =
      first(raw.customer_name, raw.customerName, raw.name, raw.fullName, raw.full_name) ||
      email.split("@")[0] || "Customer";

    const method = first(raw.fulfillment, raw.fulfillment_method) || (raw.ship ? "shipping" : "pickup");
    const ship = method === "shipping" || !!raw.ship;
    const order_type = ship ? "shipping" : "pickup";

    const items: Line[] = Array.isArray(raw.items) ? raw.items : [];
    const { items_list, items_count, order_total } = summarizeItems(items);

    const pickup_date_s = first(raw.pickup_date);
    let batchDate: Date | null = fromYMD(pickup_date_s);
    if (!batchDate) {
      const targetDow = ship ? 5 : 6;
      batchDate = nextDowFrom(new Date(), targetDow);
    }
    const week_key = toYMD(batchDate!);
    const week_start = week_key;

    const address_line1 = first(raw.address_line1, raw.address1, raw.addressLine1, raw.street) || null;
    const address_line2 = first(raw.address_line2, raw.address2, raw.addressLine2, raw.apt, raw.unit, raw.suite) || null;
    const city = first(raw.city) || null;
    const state = first(raw.state, raw.region, raw.province) || null;
    const postal_code = first(raw.postal_code, raw.postal, raw.postcode, raw.zip) || null;
    const country = first(raw.country, raw.countryCode, raw.country_code) || "USA";
    const notes = first(raw.notes, raw.orderNotes, raw.comment) || null;
    const phone = first(raw.phone, raw?.contact?.phone) || null;

    const { data: seqData, error: seqErr } = await supabase.rpc("next_kh_seq", {
      p_week_key: week_key,
      p_week_start: week_start,
    });
    if (seqErr) {
      return NextResponse.json({ ok: false, error: `Counter RPC failed: ${seqErr.message}` }, { status: 500 });
    }
    const seq = Number(seqData || 1);
    const kh_short = `KH${String(seq).padStart(3, "0")}`;

    const { data: insRows, error } = await supabase
      .from("orders")
      .insert({
        kh_short_id: kh_short,
        customer_name, email, phone,
        ship,
        order_type,
        pickup_date: order_type === "pickup" ? batchDate : null,
        ship_date:  order_type === "shipping" ? batchDate : null,
        address_line1, address_line2, city, state, postal_code, country,
        items, notes,
        status: "open",
        items_count,
        items_list,
        order_total,
        batch_week_key: week_key
      })
      .select();

    if (error) {
      return NextResponse.json({ ok: false, error: `Supabase insert failed: ${error.message}` }, { status: 500 });
    }

    const insertedRow = insRows?.[0];
    try {
      if (insertedRow && (!insertedRow.kh_short_id || insertedRow.kh_short_id !== kh_short)) {
        await supabase
          .from("orders")
          .update({ kh_short_id: kh_short })
          .eq("id", insertedRow.id);
      }
    } catch (e) {
      console.warn("[orders] failed to ensure kh_short_id on row", e);
    }

    const origin = new URL(req.url).origin;

    async function send(to: string[], subject: string, html: string, text: string, tag: string) {
      const resp = await fetch(`${origin}/api/send-email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to, subject, html, text, replyTo: process.env.FROM_EMAIL }),
      });
      const dbg = await resp.text();
      console.log("[orders] send-email", tag, resp.status, dbg?.slice(0, 500));
      return resp.ok;
    }

    const customerHTML = renderEmailHTML({
      kh: kh_short, customer_name, email, phone, ship,
      address_line1, address_line2, city, state, postal_code, country, notes, items,
      isAdmin: false, origin
    });
    const adminHTML = renderEmailHTML({
      kh: kh_short, customer_name, email, phone, ship,
      address_line1, address_line2, city, state, postal_code, country, notes, items,
      isAdmin: true, origin
    });

    const customerText = renderText(customer_name, kh_short, items, ship);
    const adminText    = renderText(customer_name, kh_short, items, ship);

    await send([email], `Your order is confirmed — #${kh_short}`, customerHTML, customerText, "customer");
    const adminTo = [process.env.ADMIN_NOTIFY_EMAIL || process.env.FROM_EMAIL].filter(Boolean) as string[];
    await send(adminTo, `NEW ORDER — #${kh_short}`, adminHTML, adminText, "admin");

    return NextResponse.json({ ok: true, kh: kh_short, order_id: insertedRow?.id }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "Unknown error" }, { status: 500 });
  }
}


