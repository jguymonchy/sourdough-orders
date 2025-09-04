import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL as string,
  process.env.SUPABASE_SERVICE_ROLE_KEY as string,
  { auth: { persistSession: false } }
);

const shortId = (uuid: string) => uuid?.replace?.(/-/g, "")?.slice(0, 8)?.toUpperCase?.() || "";

export async function POST(req: Request) {
  try {
    // Read safely (avoid empty-body parse crash)
    const text = await req.text();
    if (!text) {
      console.error("[orders] Empty body");
      return NextResponse.json({ ok: false, error: "Empty body" }, { status: 400 });
    }
    let raw: any;
    try {
      raw = JSON.parse(text);
    } catch (e) {
      console.error("[orders] Invalid JSON", e);
      return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
    }

    // Normalize fields (accept both old and new names)
    const first = (...vals: any[]) => vals.find(v => typeof v === "string" && v.trim())?.toString().trim();

    const order = {
      customer_name: first(raw.customer_name, raw.customerName, raw.name) || "Customer",
      email: first(raw.email, raw.customerEmail) || "",
      phone: first(raw.phone, raw?.contact?.phone) || null,

      // fulfillment
      fulfillment: (first(raw.fulfillment, raw.fulfillment_method) || (raw.ship ? "shipping" : "pickup")) === "shipping"
        ? "delivery" // DB/Sheet uses 'delivery' vs 'pickup'
        : "pickup",

      // address
      address_line1: first(raw.address_line1, raw.address1, raw.addressLine1, raw.street) || null,
      address_line2: first(raw.address_line2, raw.address2, raw.addressLine2) || null,
      city: first(raw.city) || null,
      state: first(raw.state) || null,
      postal_code: first(raw.postal_code, raw.postal) || null,
      country: first(raw.country) || "USA",

      // notes
      notes: first(raw.notes) || null,

      // items
      items: Array.isArray(raw.items) ? raw.items : [],
      status: "open",
    };

    // Minimal validation
    if (!order.email) {
      return NextResponse.json({ ok: false, error: "Missing email" }, { status: 400 });
    }
    if (!order.items.length) {
      return NextResponse.json({ ok: false, error: "No items" }, { status: 400 });
    }

    // Insert into Supabase (trigger → Apps Script → Google Sheet)
    const { data, error } = await supabase
      .from("orders")
      .insert({
        customer_name: order.customer_name,
        email: order.email,
        phone: order.phone,
        fulfillment: order.fulfillment, // 'pickup' | 'delivery'
        address_line1: order.address_line1,
        address_line2: order.address_line2,
        city: order.city,
        state: order.state,
        postal_code: order.postal_code,
        country: order.country,
        items: order.items,
        notes: order.notes,
        status: order.status,
      })
      .select()
      .single();

    if (error) {
      console.error("[orders] Supabase insert failed", error);
      return NextResponse.json({ ok: false, error: "Failed to save order" }, { status: 500 });
    }

    // Optionally email via your existing /api/send-email route (kept non-blocking here)
    const origin = new URL(req.url).origin;
    const idShort = shortId(data.id || "");
    try {
      await fetch(`${origin}/api/send-email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: order.email,
          subject: `Your order is confirmed — #${idShort}`,
          html: `<p>Thanks, ${order.customer_name}! Your order #${idShort} is received.</p>`,
        }),
      });
      await fetch(`${origin}/api/send-email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: process.env.ADMIN_NOTIFY_EMAIL || process.env.FROM_EMAIL,
          subject: `NEW ORDER — #${idShort}`,
          html: `<p>${order.customer_name} placed an order. Items: ${(order.items || [])
            .map((i: any) => `${i.qty}× ${i.item || i.name}`).join(", ")}</p>`,
        }),
      });
    } catch (e) {
      console.warn("[orders] email send skipped/failed", e);
      // do not fail the order
    }

    // Return JSON (so the form doesn’t crash parsing)
    return NextResponse.json({ ok: true, kh: idShort, order_id: data.id }, { status: 200 });
  } catch (err: any) {
    console.error("[orders] error", err);
    return NextResponse.json({ ok: false, error: err?.message || "Unknown error" }, { status: 500 });
  }
}



