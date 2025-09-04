// app/api/send-email/route.ts
import { NextResponse } from "next/server";

type SendReq = {
  to: string | string[];
  subject: string;
  html?: string;
  text?: string;
  from?: string;
  replyTo?: string | string[];
};

const RESEND_API = "https://api.resend.com/emails";

async function readJson(req: Request) {
  const t = await req.text();
  if (!t) return { ok: false as const, error: "Empty body" };
  try { return { ok: true as const, data: JSON.parse(t) as SendReq }; }
  catch { return { ok: false as const, error: "Invalid JSON" }; }
}

export async function POST(req: Request) {
  const parsed = await readJson(req);
  if (!parsed.ok) return NextResponse.json({ ok:false, error: parsed.error }, { status: 400 });

  const body = parsed.data;
  const apiKey = process.env.RESEND_API_KEY || "";
  const defaultFrom = process.env.FROM_EMAIL || "onboarding@resend.dev";

  if (!apiKey) {
    console.error("[send-email] Missing RESEND_API_KEY");
    return NextResponse.json({ ok:false, error:"Email not configured" }, { status: 500 });
  }

  const toList = Array.isArray(body.to) ? body.to : [body.to].filter(Boolean);
  if (!toList.length) {
    return NextResponse.json({ ok:false, error:"Missing 'to'" }, { status: 400 });
  }

  const payload = {
    from: body.from || defaultFrom,
    to: toList,
    subject: body.subject,
    html: body.html || undefined,
    text: body.text || undefined,
    reply_to: body.replyTo ? (Array.isArray(body.replyTo) ? body.replyTo : [body.replyTo]) : undefined,
  };

  try {
    const r = await fetch(RESEND_API, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });
    const raw = await r.text();
    let data: any = null;
    try { data = raw ? JSON.parse(raw) : null; } catch { /* keep raw */ }

    if (!r.ok) {
      console.error("[send-email] Resend error", r.status, raw);
      return NextResponse.json({ ok:false, error:`Resend ${r.status}`, details: data || raw }, { status: 502 });
    }

    return NextResponse.json({ ok:true, data: data }, { status: 200 });
  } catch (e:any) {
    console.error("[send-email] exception", e);
    return NextResponse.json({ ok:false, error: e?.message || "Send failed" }, { status: 500 });
  }
}

