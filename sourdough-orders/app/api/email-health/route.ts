import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const origin = new URL(req.url).origin;
  const to = process.env.ADMIN_NOTIFY_EMAIL || process.env.FROM_EMAIL || "";
  if (!to) {
    return NextResponse.json({ ok:false, error:"Missing ADMIN_NOTIFY_EMAIL/FROM_EMAIL" }, { status: 500 });
  }

  const r = await fetch(`${origin}/api/send-email`, {
    method: "POST",
    headers: { "Content-Type":"application/json" },
    body: JSON.stringify({
      to: [to],
      subject: "KHH email health check",
      html: "<p>If you received this, Resend is working from Vercel → your inbox.</p>",
    }),
  });

  const raw = await r.text();
  let data:any=null; try { data = raw ? JSON.parse(raw) : null; } catch {}
  return NextResponse.json({ ok: r.ok, status: r.status, data: data ?? raw }, { status: r.ok ? 200 : 502 });
}
