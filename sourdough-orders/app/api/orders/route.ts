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

const firstNonEmpty = (...vals: unknown[]) =>
  vals.find(v => typeof v === "string" && v.trim())?.toString().trim();

const shortOrderId = (uuid: string) => uuid.replace(/-/g, "").slice(0, 8).toUpperCase();

// -------- Name + Address helpers (accept many shapes/keys) --------
function resolveName(raw: any, emailForFallback?: string): string {
  const joinedFirstLast =
    [raw.firstName, raw.lastName].every(v => typeof v === "string" && v.trim())
      ? `${raw.firstName} ${raw.lastName}`.trim()
      : null;

  const name =
    firstNonEmpty(
      raw.customerName,
      raw.name,
      raw.fullName,
      raw.full_name,
      raw.contact?.name,
      raw.shipping_name,
      raw.billing_name,
      joinedFirstLast
    ) ||
    (emailForFallback ? emailForFallback.split("@")[0] : "") ||
    "Customer";

  return name;
}

function pickAddress1(raw: any): string | null {
  // flat variants
  const flat = firstNonEmpty(
    raw.address1,
    raw.addressLine1,
    raw.street,
    raw.street1,
    raw.streetAddress,
    raw.shipping_address1,
    raw.billing_address1
  );
  if (flat) return flat;

  // nested common shapes
  const nestedCandidates = [
    raw.address,
    raw.shippingAddress,
    raw.billingAddress,
    raw.deliveryAddress,
    raw.contact?.address,
    raw.contact?.shippingAddress,
  ];

  for (const obj of nestedCandidates) {
    if (!obj) continue;
    const fromObj = firstNonEmpty(
      obj.address1,
      obj.addressLine1,
      obj.line1,
      obj.street,
      obj.street1,
      obj.streetAddress
    );
    if (fromObj) return fromObj;
  }
  return null;
}

function pickAddress2(raw: any): string | null {
  return (
    firstNonEmpty(
      raw.address2,
      raw.addressLine2,
      raw.apt,
      raw.unit,
      raw.suite,
      raw.shipping_address2,
      raw.billing_address2
    ) ||
    firstNonEmpty(
      raw.address?.address2,
      raw.address?.line2,
      raw.shippingAddress?.address2,
      raw.shippingAddress?.line2,
      raw.billingAddress?.address2,
      raw.billingAddress?.line2
    ) ||
    null
  );
}

function pickCity(raw: any): string | null {
  return (
    firstNonEmpty(
      raw.city,
      raw.town,
      raw.locality,
      raw.shipping_city,
      raw.billing_city
    ) ||
    firstNonEmpty(
      raw.address?.city,
      raw.address?.locality,
      raw.shippingAddress?.city,
      raw.shippingAddress?.locality,
      raw.billingAddress?.city,
      raw.billingAddress?.locality
    ) ||
    null
  );
}

function pickState(raw: any): string | null {
  return (
    firstNonEmpty(
      raw.state,
      raw.region,
      raw.province,
      raw.shipping_state,
      raw.billing_state
    ) ||
    firstNonEmpty(
      raw.address?.state,
      raw.address?.region,
      raw.shippingAddress?.state,
      raw.shippingAddress?.region,
      raw.billingAddress?.state,
      raw.billingAddress?.region
    ) ||
    null
  );
}

function pickPostal(raw: any): string | null {
  return (
    firstNonEmpty(
      raw.postalCode,
      raw.postcode,
      raw.zip,
      raw.zipcode,
      raw.shipping_postalCode,
      raw.billing_postalCode
    ) ||
    firstNonEmpty(
      raw.address?.postalCode,
      raw.address?.postcode,
      raw.address?.zip,
      raw.shippingAddress?.postalCode,
      raw.shippingAddress?.zip,
      raw.billingAddress?.postalCode,
      raw.billingAddress?.zip
    ) ||
    null
  );
}

function pickCountry(raw: any): string | null {
  return (
    firstNonEmpty(
      raw.country,
      raw.countryCode,
      raw.shipping_country,
      raw.billing_country
    ) ||
    firstNonEmpty(
      raw.address?.country,
      raw.address?.countryCode,
      raw.shippingAddress?.country,
      raw.shippingAddress?.countryCode,
      raw.billingAddress?.country,
      raw.billingAddress?.countryCode
    ) ||
    "USA"
  );
}

// -------------------- HTML renderers --------------------
function renderCustomerHtml(order: IncomingOrder & { id?: string }) {
  const itemsHtml =
    order.items?.map(it => {
      const price =
        typeof it.price === "number" ? `$${it.price.toFixed(2)}` : "-";
      return `<tr><td>${it.name}${it.variant ? ` (${it.variant})` : ""}</td><td align="center">${it.qty}</td><td align="right">${price}</td></tr>`;
    }).join("") || `<tr><td colspan="3">No items listed</td></tr>`;

  const addrLines = [
    [order.address1, order.address2].filter(Boolean).join(" "),
    [order.city, order.state].filter(Boolean).join(", "),
    order.postalCode,
    order.country
  ].filter(Boolean);

  return `
  <div style="font-family:Arial,sans-serif">
    <h1>Thanks for your order, ${order.customerName}!</h1>
    <p>Order #${shortOrderId(order.id || "")}</p>
    <h3>Your Items</h3>
    <table>${itemsHtml}</table>
    <h3>Delivery</h3>
    <p>${addrLines.join("<br/>")}</p>
    <h3>Contact</h3>
    <p>Email: ${order.customerEmail}<br/>Phone: ${order.phone || ""}</p>
    <h3>Notes</h3>
    <p>${order.notes || ""}</p>
    <p>If anything looks off, just reply to this email and we’ll fix it.</p>
    <p>— Kanarra Heights Homestead</p>
  </div>`;
}

function renderAdminHtml(order: IncomingOrder & { id?: string }) {
  const itemsHtml =
    order.items?.map(it => {
      const price =
        typeof it.price === "number" ? `$${it.price.toFixed(2)}` : "-";
      return `<tr><td>${it.name}${it.variant ? ` (${it.variant})` : ""}</td><td align="center">${it.qty}</td><td align="right">${price}</td></tr>`;
    }).join("") || `<tr><td colspan="3">No items listed</td></tr>`;

  const addrLines = [
    [order.address1, order.address2].filter(Boolean).join(" "),
    [order.city, order.state].filter(Boolean).join(", "),
    order.postalCode,
    order.country
  ].filter(Boolean);

  return `
  <div style="font-family:Arial,sans-serif">
    <h1>NEW ORDER received</h1>
    <p><strong>Order #</strong> ${shortOrderId(order.id || "")}</p>
    <h3>Customer</h3>
    <p><strong>Name:</strong> ${order.customerName}<br/>
       <strong>Email:</strong> ${order.customerEmail}<br/>
       <strong>Phone:</strong> ${order.phone || ""}</p>
    <h3>Delivery</h3>
    <p>${addrLines.join("<br/>")}</p>
    <h3>Items</h3>
    <table>${itemsHtml}</table>
    <h3>Notes</h3>
    <p>${order.notes || ""}</p>
    <p>— Kanarra Heights Homestead</p>
  </div>`;
}

// -------------------- Route --------------------
export async function POST(req: Request) {
  try {
    const raw: any = await req.json();

    // Uncomment for one test order to see exactly what the front-end sends:
    // console.log("ORDER RAW PAYLOAD", JSON.stringify(raw, null, 2));

    const email =
      firstNonEmpty(raw.customerEmail, raw.email, raw.contact?.email) || "";
    if (!email) {
      return NextResponse.json({ error: "Missing 'customerEmail'." }, { status: 400 });
    }

    const name = resolveName(raw, email);

    const items: OrderItem[] = Array.isArray(raw.items) ? raw.items : [];

    const order: IncomingOrder = {
      customerEmail: email,
      customerName: name,
      phone: firstNonEmpty(raw.phone, raw.contact?.phone) ?? null,
      ship: typeof raw.ship === "boolean" ? raw.ship : true,
      address1: pickAddress1(raw),
      address2: pickAddress2(raw),
      city: pickCity(raw),
      state: pickState(raw),
      postalCode: pickPostal(raw),
      country: pickCountry(raw),
      items,
      notes: firstNonEmpty(raw.notes, raw.orderNotes, raw.comment) ?? null,
    };

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
      return NextResponse.json({ error: `Failed to save order: ${error.message}` }, { status: 500 });
    }

    const origin = new URL(req.url).origin;

    // Customer email
    await fetch(`${origin}/api/send-email`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        to: [order.customerEmail],
        subject: `Your order is confirmed — #${shortOrderId(data.id)}`,
        html: renderCustomerHtml({ ...order, id: data.id }),
      }),
    });

    // Admin email
    await fetch(`${origin}/api/send-email`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        to: [process.env.ADMIN_NOTIFY_EMAIL || (process.env.FROM_EMAIL as string)],
        subject: `NEW ORDER — #${shortOrderId(data.id)}`,
        html: renderAdminHtml({ ...order, id: data.id }),
      }),
    });

    return NextResponse.json({ success: true, order: data }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Unknown error" }, { status: 500 });
  }
}

