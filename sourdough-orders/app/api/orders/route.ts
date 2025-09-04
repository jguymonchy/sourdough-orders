// app/api/orders/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL as string,
  process.env.SUPABASE_SERVICE_ROLE_KEY as string,
  { auth: { persistSession: false } }
);

const shortId = (uuid: string) =>
  uuid?.replace?.(/-/g, "")?.slice(0, 8)?.toUpperCase?.() || "";

const first = (...vals: any[]) =>
  vals.find((v) => typeof v === "string" && v.trim())?.toString().trim();

/** Read body safely (avoids “Unexpected end of JSON input”) */
async function readJson(req: Request) {
  const text = await req.text();
  if (!text) return { ok: false as const, error: "Empty body" };
  try {
    return { ok: true as const, data: JSON.parse(text) };
  } catch {
    return { ok: false as const, error: "Invalid JSON" };
  }
}

export async function POST(req: Request) {
  // 1) Read + parse
  const bodyRes = await readJson(req);
  if (!bodyRes.ok) {
    return NextResponse.json({ ok: false, error: bodyRes.error }, { status: 400 });
  }
  const raw = bodyRes.data;

  try {
    // 2) Normalize fields (accepts old + new names)
    const email = first(raw.email, raw.customerEmail, raw?.contact?.email) || "";
    if (!email) {
      return NextResponse.json({ ok: false, error: "Missing email" }, { status: 400 });
    }

    const customer_name =
      first(
        raw.customer_name,
        raw.customerName,
        raw.name,
        raw.fullName,
        raw.full_name
      ) || email.split("@")[0] || "Customer";

    // method → boolean ship column (matches your DB)
    const method = first(raw.fulfillment, raw.fulfillment_method) || (raw.ship ? "shipping" : "pickup");
    const ship: boolean = (method === "shipping") || !!raw.ship;

    // items array (fallbacks)
    const items = Array.isArray(raw.items)
      ? raw.items
      : [];

    // address parts
    const address_line1 =
      first(raw.address_line1, raw.address1, raw.addressLine1, raw.street) || null;
    const address_line2 =
      first(raw.address_line2, raw.address2, raw.addressLine2, raw.apt, raw.unit, raw.suite) || null;
    const city = first(raw.city) || null;
    const state = first(raw.state, raw.region, raw.province) || null;
    const postal_code = first(raw.postal_code, raw.postal, raw.postcode, raw.zip) || null;
    const country = first(raw.country, raw.countryCode, raw.country_code) || "USA";
    const notes = first(raw.notes, raw.orderNotes, raw.comment) || null;

    // 3) Insert into your existing schema (uses ship: boolean)
    const { data, error } = await supabase
      .from("orders")
      .insert({
        customer_name,
        email,
        phone: first(raw.phone, raw?.contact?.phone) || null,
        ship, // boolean column in your DB
        address_line1,
        address_line2,
        city,
        state,
        postal_code,
        country,
        items, // JSONB/JSON column
        notes,
        status: "open",
      })
      .select()
      .single();

    if (error) {
      // Surface the real reason so we can fix fast
      return NextResponse.json(
        { ok: false, error: `Supabase insert failed: ${error.message}` },
        { status: 500 }
      );
    }

    // 4) Send emails (non-blocking; failures won’t break the order)
    const origin = new URL(req.url).origin;
    const kh = shortId(data.id || "");

    try {
      await fetch(`${origin}/api/send-email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: email,
          subject: `Your order is confirmed — #${kh}`,
          html: `<p>Thanks, ${customer_name}! Your order #${kh} is received.</p>`,
        }),
      });
      await fetch(`${origin}/api/send-email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: [process.env.ADMIN_NOTIFY_EMAIL || process.env.FROM_EMAIL],
          subject: `NEW ORDER — #${kh}`,
          html: `<p>${customer_name} placed an order. Items: ${
            (items || []).map((i: any) => `${i.qty}× ${i.item || i.name}`).join(", ")
          }</p>`,
        }),
      });
    } catch (e) {
      console.warn("[orders] email send skipped/failed", e);
    }

    // 5) Return JSON so the form can show success
    return NextResponse.json({ ok: true, kh, order_id: data.id }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "Unknown error" }, { status: 500 });
  }
}


