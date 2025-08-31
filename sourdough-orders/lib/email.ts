// lib/email.ts
import { Resend } from 'resend'

// Uses your Vercel env vars
const resend = new Resend(process.env.RESEND_API_KEY!)
const fromEmail = process.env.NEXT_PUBLIC_FROM_EMAIL || 'onboarding@resend.dev'
const fromName  = process.env.NEXT_PUBLIC_SITE_NAME || 'Sourdough Orders'

export async function sendOrderEmail(opts: {
  to: string
  subject: string
  html: string
  replyTo?: string
}) {
  const { to, subject, html, replyTo } = opts

  const { error } = await resend.emails.send({
    from: `${fromName} <${fromEmail}>`,
    to,
    subject,
    html,
    // This is the important line that wires through reply-to:
    reply_to: replyTo,
  })

  if (error) {
    console.error('Resend error:', error)
    throw new Error(JSON.stringify(error))
  }
}
