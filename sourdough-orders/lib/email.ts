// lib/email.ts
import { Resend } from 'resend'

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

  console.log('[email] sending', { to, subject, replyTo })

  const { error, data } = await resend.emails.send({
    from: `${fromName} <${fromEmail}>`,
    to,
    subject,
    html,
    // Resend uses `reply_to`
    reply_to: replyTo,
  })

  if (error) {
    console.error('[email] resend error', error)
    throw error
  }

  console.log('[email] resend accepted', { id: data?.id })
}

