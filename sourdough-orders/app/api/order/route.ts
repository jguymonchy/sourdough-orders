import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getSupabaseAdmin } from '../../../lib/supabase'
import { sendOrderEmail } from '../../../lib/email'


const ItemSchema = z.object({
  sku: z.string(),
  name: z.string(),
  qty: z.number().int().positive()
})
const OrderSchema = z.object({
  customer_name: z.string().min(1),
  email: z.string().email().optional().or(z.literal('')),
  phone: z.string().optional().or(z.literal('')),
  ship: z.boolean(),
  address_line1: z.string().optional().or(z.literal('')),
  address_line2: z.string().optional().or(z.literal('')),
  city: z.string().optional().or(z.literal('')),
  state: z.string().optional().or(z.literal('')),
  postal_code: z.string().optional().or(z.literal('')),
  country: z.string().optional().or(z.literal('')),
  items: z.array(ItemSchema).min(1),
  notes: z.string().optional().or(z.literal(''))
})

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const data = OrderSchema.parse(body)

    const sb = getSupabaseAdmin()
    const { data: inserted, error } = await sb
      .from('orders')
      .insert({
        customer_name: data.customer_name,
        email: data.email?.trim() || null,
        phone: data.phone || null,
        ship: data.ship,
        address_line1: data.address_line1 || null,
        address_line2: data.address_line2 || null,
        city: data.city || null,
        state: data.state || null,
        postal_code: data.postal_code || null,
        country: data.country || 'USA',
        items: data.items,
        notes: data.notes || null,
        status: 'new'
      })
      .select()
      .single()

    if (error) throw error

// ---------- Email setup (used for both emails) ----------
const siteName = process.env.NEXT_PUBLIC_SITE_NAME || 'Sourdough Orders';
const adminTo =
  process.env.ADMIN_NOTIFY_EMAIL ||
  process.env.NEXT_PUBLIC_FROM_EMAIL ||
  'orders@example.com';

// 1) Admin email
console.log('[order] admin email', { to: adminTo, orderId: inserted.id })
await sendOrderEmail({ to: adminTo, subject, html, replyTo: inserted.email || undefined })

// 2) Customer email (only if they provided one)
if (inserted.email) {
  const siteName = process.env.NEXT_PUBLIC_SITE_NAME || 'Sourdough Orders'
  const adminTo  = process.env.ADMIN_NOTIFY_EMAIL || process.env.NEXT_PUBLIC_FROM_EMAIL || 'orders@example.com'

  const customerHtml = `
    <p>Thanks, ${inserted.customer_name}! We received your order.</p>
    ${html}
  `

  console.log('[order] customer email', { to: inserted.email, replyTo: adminTo })
  await sendOrderEmail({
    to: inserted.email,
    subject: `Thanks for your order – ${siteName}`,
    html: customerHtml,
    replyTo: adminTo,
  })
} else {
  console.log('[order] no customer email provided')
}







export async function GET(req: NextRequest) {
  // Admin list endpoint (protected by middleware)
  try {
    const sb = getSupabaseAdmin()
    const { data, error } = await sb
      .from('orders')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(200)
    if (error) throw error
    return NextResponse.json(data)
  } catch (e:any) {
    return new NextResponse(e.message || 'Error', { status: 500 })
  }
}
