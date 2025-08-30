import { Resend } from 'resend'

export async function sendOrderEmail(params: {
  to: string
  from?: string
  subject: string
  html: string
}) {
  const resend = new Resend(process.env.RESEND_API_KEY!)
  const from = params.from || process.env.NEXT_PUBLIC_FROM_EMAIL || 'orders@example.com'
  await resend.emails.send({ from, to: params.to, subject: params.subject, html: params.html })
}
