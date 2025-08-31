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
        email: data.email || null,
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

    // email you
    const to = process.env.NEXT_PUBLIC_FROM_EMAIL || 'orders@example.com'
    const subject = `New Order: ${inserted.customer_name}`
    const html = `
      <h2>New order</h2>
      <p><strong>Name:</strong> ${inserted.customer_name}</p>
      <p><strong>Email:</strong> ${inserted.email || ''} | <strong>Phone:</strong> ${inserted.phone || ''}</p>
      <p><strong>Ship:</strong> ${inserted.ship ? 'Yes' : 'No'}</p>
      ${inserted.ship ? `
      <p><strong>Address:</strong> ${[inserted.address_line1, inserted.address_line2, inserted.city, inserted.state, inserted.postal_code, inserted.country].filter(Boolean).join(', ')}</p>`: ''}
      <p><strong>Items:</strong></p>
      <ul>${(inserted.items || []).map((i:any) => `<li>${i.name} x ${i.qty}</li>`).join('')}</ul>
      <p><strong>Notes:</strong> ${inserted.notes || ''}</p>
      <p><small>Order ID: ${inserted.id} | ${inserted.created_at}</small></p>
    `
    await sendOrderEmail({ to, subject, html })

    // confirmation to customer (if email provided)
    if (inserted.email) {
      await sendOrderEmail({
        to: inserted.email,
        subject: `Thanks for your order – ${process.env.NEXT_PUBLIC_SITE_NAME || 'Sourdough Orders'}`,
        html: `<p>Thanks, ${inserted.customer_name}! We received your order:</p>${html}`
      })
    }

    return NextResponse.json({ ok: true })
  } catch (e:any) {
    return new NextResponse(e.message || 'Bad Request', { status: 400 })
  }
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
