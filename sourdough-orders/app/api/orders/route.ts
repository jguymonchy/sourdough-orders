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
        <table role="presentation" cellpadding="0" cellspacin


