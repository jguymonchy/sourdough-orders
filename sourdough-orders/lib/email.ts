// lib/email.ts
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY!);

const fromEmail =
  process.env.NEXT_PUBLIC_FROM_EMAIL || 'onboarding@resend.dev';
const fromName =
  process.env.NEXT_PUBLIC_SITE_NAME || 'Sourdough Orders';

type SendOpts = {
  to: string | string[];
  subject: string;
  html: string;
  replyTo?: string; // optional
};

export async function sendOrderEmail(opts: SendOpts) {
  const { to, subject, html, replyTo } = opts;

  // Build payload in a way that works with any Resend SDK version
  const payload: any = {
    from: `${fromName} <${fromEmail}>`,
    to,
    subject,
    html,
  };

  if (replyTo) {
    // Newer SDKs use snake_case, older used camelCase.
    payload.reply_to = replyTo;
    payload.replyTo = replyTo;
    // Ultimate fallback—most providers honor this header:
    payload.headers = { 'Reply-To': replyTo };
  }

  const { error } = await resend.emails.send(payload);
  if (error) {
    // surface the error in Vercel Runtime Logs
    console.error('Resend error:', error);
    throw new Error(JSON.stringify(error));
  }
}
