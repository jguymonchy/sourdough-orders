// app/api/orders/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL as string,
  process.env.SUPABASE_SERVICE_ROLE_KEY as string,
  { auth: { persistSession: false } }
);

type OrderItem = { id?: string | number; name: string; qty: number; price?: number; variant?: string; };

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

/** ---------- Name + Address resolvers (broadened) ---------- */
function resolveName(raw: any, emailForFallback?: string): string {
  const joinedTop = [raw.firstName, raw.lastName].every(v => typeof v === "string" && v?.trim())
    ? `${raw.firstName} ${raw.lastName}`.trim()
    : null;

  const joinedContact = [raw?.contact?.firstName, raw?.contact?.lastName].every(
    v => typeof v === "string" && v?.trim()
  )
    ? `${raw.contact.firstName} ${raw.contact.lastName}`.trim()
    : null;

  const name =
    firstNonEmpty(
      raw.customerName,
      raw.customer_name,
      raw.name,
      raw.fullName,
      raw.full_name,
      raw.contactName,
      raw?.contact?.name,
      raw?.contact?.fullName,
      raw?.contact?.full_name,
      joinedTop,
      joinedContact
    ) ||
    (emailForFallback ? emailForFallback.split("@")[0] : "") ||
    "Customer";

  return name;
}

function pickAddress1(raw: any): string | null {
  // flat + snake/camel
  const flat = firstNonEmpty(
    raw.address1,
    raw.address_line1,
    raw.addressLine1,
    raw.street,
    raw.street1,
    raw.streetAddress,
    raw.shipping_address1,
    raw.billing_address1
  );
  if (flat) return flat;

  // delivery-scoped and common nested variants
  const nests = [
    raw.delivery,
    raw.deliveryAddress,
    raw.address,
    raw.shippingAddress,
    raw.billingAddress,
    raw.contact?.address,
    raw.contact?.shippingAddress,
  ];
  for (const obj of nests) {
    if (!obj) continue;
    const v = firstNonEmpty(
      obj.address1,
      obj.address_line1,
      obj.addressLine1,
      obj.line1,
      obj.street,
      obj.street1,
      obj.streetAddress
    );
    if (v) return v;
  }
  return null;
}

function pickAddress2(raw: any): string | null {
  return (
    firstNonEmpty(
      raw.address2,
      raw.address_line2,
      raw.addressLine2,
      raw.apt,
      raw.unit,
      raw.suite,
      raw.shipping_address2,
      raw.billing_address2
    ) ||
    firstNonEmpty(
      raw.delivery?.address2,
      raw.delivery?.address_line2,
      raw.delivery?.addressLine2,
      raw.delivery?.line2,
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
    firstNonEmpty(raw.city, raw.shipping_city, raw.billing_city) ||
    firstNonEmpty(
      raw.delivery?.city,
      raw.delivery?.locality,
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
    firstNonEmpty(raw.state, raw.region, raw.province, raw.shipping_state, raw.billing_state) ||
    firstNonEmpty(
      raw.delivery?.state,
      raw.delivery?.region,
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
    firstNonEmpty(raw.postalCode, raw.postal_code, raw.postcode, raw.zip, raw.zipcode) ||
    firstNonEmpty(
      raw.delivery?.postalCode,
      raw.delivery?.postal_code,
      raw.delivery?.postcode,
      raw.delivery?.zip,
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
    firstNonEmpty(raw.country, raw.countryCode, raw.country_code) ||
    firstNonEmpty(
      raw.delivery?.country,
      raw.delivery?.countryCode,
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

/** ---------- HTML renderers (with table header: Item | Qty | Price) ---------- */
function itemsTable(items: OrderItem[]) {
  const rows =
    items?.map(it => {
      const price = typeof it.price === "number" ? `$${it.price.toFixed(2)}` : "-";
      return `<tr>
        <td style="padding:6px 8px;border-top:1px solid #eee">${it.name}${it.variant ? ` (${it.variant})` : ""}</td>
        <td align="center" style="padding:6px 8px;border-top:1px solid #eee">${it.qty}</td>
        <td align="right" style="padding:6px 8px;border-top:1px solid #eee">${price}</td>
      </tr>`;
    }).join("") || `<tr><td colspan="3" style="padding:6px 8px;border-top:1px solid #eee">No items listed</td></tr>`;

  return `<table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse">
    <thead>
      <tr>
        <th align="left" style="padding:6px 8px;border-bottom:2px solid #000">Item</th>
        <th align="center" style="padding:6px 8px;border-bottom:2px solid #000">Qty</th>
        <th align="right" style="padding:6px 8px;border-bottom:2px solid #000">Price</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>`;
}

function addressBlock(o: IncomingOrder) {
  const parts = [
    [o.address1, o.address2].filter(Boolean).join(" "),
    [o.city, o.state].filter(Boolean).join(", "),
    o.postalCode,
    o.country,
  ].filter(Boolean);
  return parts.join("<br/>");
}

function renderCustomerHtml(order: IncomingOrder & { id?: string }) {
  return `
  <div style="font-family:Arial,sans-serif">
    <h1>Thanks for your order, ${order.customerName}!</h1>
    <p>Order #${shortOrderId(order.id || "")}</p>
    <h3>Your Items</h3>
    ${itemsTable(order.items)}
    <h3>Delivery</h3>
    <p>${addressBlock(order)}</p>
    <h3>Contact</h3>
    <p>Email: ${order.customerEmail}<br/>Phone: ${order.phone || ""}</p>
    <h3>Notes</h3>
    <p>${order.notes || ""}</p>
    <p>If anything looks off, just reply to this email and we’ll fix it.</p>
    <p>— Kanarra Heights Homestead</p>
  </div>`;
}

function renderAdminHtml(order: IncomingOrder & { id?: string }) {
  return `
  <div style="font-family:Arial,sans-serif">
    <h1>NEW ORDER received</h1>
    <p><strong>Order #</strong> ${shortOrderId(order.id || "")}</p>
    <h3>Customer</h3>
    <p><strong>Name:</strong> ${order.customerName}<br/>
       <strong>Email:</strong> ${order.customerEmail}<br/>
       <strong>Phone:</strong> ${order.phone || ""}</p>
    <h3>Delivery</h3>
    <p>${addressBlock(order)}</p>
    <h3>Items</h3>
    ${itemsTable(order.items)}
    <h3>Notes</h3>
    <p>${order.notes || ""}</p>
    <p>— Kanarra Heights Homestead</p>
  </div>`;
}

/** -------------------- Route -------------------- */
export async function POST(req: Request) {
  try {
    const raw: any = await req.json();

    // Uncomment once for debugging if needed:
    // console.log("ORDER RAW PAYLOAD", JSON.stringify(raw));

    const email =
      firstNonEmpty(raw.customerEmail, raw.email, raw?.contact?.email) || "";
    if (!email) {
      return NextResponse.json({ error: "Missing 'customerEmail'." }, { status: 400 });
    }

    const name = resolveName(raw, email);

    const items: OrderItem[] = Array.isArray(raw.items) ? raw.items : [];

    const order: IncomingOrder = {
      customerEmail: email,
      customerName: name,
      phone: firstNonEmpty(raw.phone, raw?.contact?.phone) ?? null,
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

    await fetch(`${origin}/api/send-email`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        to: [order.customerEmail],
        subject: `Your order is confirmed — #${shortOrderId(data.id)}`,
        html: renderCustomerHtml({ ...order, id: data.id }),
      }),
    });

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


