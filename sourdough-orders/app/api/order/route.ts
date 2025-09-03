import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';

const GAS_URL = process.env.GAS_WEBAPP_URL!;         // e.g. https://script.google.com/macros/s/XXXX/exec
const ADMIN_EMAIL = process.env.ADMIN_EMAIL!;        // you+admin@yourdomain
const FROM_EMAIL = process.env.RESEND_FROM_EMAIL!;   // e.g. "Kanarra Heights Homestead <orders@yourdomain.com>"
const resend = new Resend(process.env.RESEND_API_KEY!);

export async function POST(req: NextRequest) {
  const body = await req.json();

  // 1) Forward to GAS as x-www-form-urlencoded (this triggers KH### + Sheets writes)
  const params = new URLSearchParams({
    action: 'submit_order',
    name: String(body.name || ''),
    email: String(body.email || ''),
    phone: String(body.phone || ''),
    fulfillment_method: String(body.fulfillment_method || 'pickup'),
    pickup_date: String(body.pickup_date || ''),
    address1: String(body.address1 || ''),
    address2: String(body.address2 || ''),
    city: String(body.city || ''),
    state: String(body.state || ''),
    postal: String(body.postal || ''),
    item1_name: String(body.item1_name || ''),
    item1_qty: String(body.item1_qty ?? '0'),
    item2_name: String(body.item2_name || ''),
    item2_qty: String(body.item2_qty ?? '0'),
  });

  const gasResp = await fetch(GAS_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString(),
  });

  // We don’t need GAS’s HTML body. If it failed hard, bail.
  if (!gasResp.ok) {
    const detail = await gasResp.text().catch(() => '');
    return NextResponse.json({ ok: false, error: 'GAS error', detail }, { status: 500 });
  }

  // 2) Compose order summary for emails
  const method = String(body.fulfillment_method || 'pickup') === 'shipping' ? 'shipping' : 'pickup';
  const items: Array<{name:string; qty:number; price:number}> = [];
  if (body.item1_name && Number(body.item1_qty || 0) > 0) items.push({ name: body.item1_name, qty: Number(body.item1_qty), price: 10 });
  if (body.item2_name && Number(body.item2_qty || 0) > 0) items.push({ name: body.item2_name, qty: Number(body.item2_qty), price: 10 });
  const total = items.reduce((s,i)=>s + i.qty*i.price, 0);
  const itemsRows = items.length
    ? items.map(i => `<tr><td>${i.name}</td><td align="right">${i.qty}</td><td align="right">$${i.price}</td></tr>`).join('')
    : '<tr><td colspan="3">—</td></tr>';

  // If you want a KH### in emails, we can add a tiny GAS change to return JSON with kh; for now, omit or show “pending”.
  const orderId = 'pending KH'; // (optional) upgrade later to read KH### from GAS

  const html = (who: 'admin'|'customer') => `
    <div style="font-family:system-ui,Segoe UI,Roboto,Arial,sans-serif">
      <h2 style="margin:0 0 10px">Kanarra Heights Homestead</h2>
      <p style="margin:0 0 10px">${who==='admin'?'New order received':'Thanks! We received your order.'}</p>
      <p><b>Order:</b> ${orderId}</p>
      <p><b>Fulfillment:</b> ${method === 'pickup' ? 'Pickup' : 'Shipping'}</p>
      ${body.pickup_date ? `<p><b>Pickup date:</b> ${body.pickup_date}</p>` : ''}
      <table cellpadding="6" cellspacing="0" border="0" style="border-collapse:collapse;margin:10px 0 0">
        <thead><tr><th align="left">Item</th><th align="right">Qty</th><th align="right">Price</th></tr></thead>
        <tbody>${itemsRows}</tbody>
      </table>
      <p style="margin-top:10px"><b>Total:</b> $${total}</p>
    </div>
  `;

  // 3) Send emails via Resend
  await resend.emails.send({
    from: FROM_EMAIL,
    to: ADMIN_EMAIL,
    subject: `New order — ${orderId}`,
    html: html('admin'),
  });

  if (body.email) {
    await resend.emails.send({
      from: FROM_EMAIL,
      to: String(body.email),
      subject: `Order received — ${orderId}`,
      html: html('customer'),
    });
  }

  return NextResponse.json({ ok: true });
}

