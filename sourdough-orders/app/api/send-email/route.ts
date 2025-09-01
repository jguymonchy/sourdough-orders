// app/api/send-email/route.ts
import { NextResponse } from "next/server";
import { Resend } from "resend";

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const FROM_EMAIL = process.env.FROM_EMAIL;

if (!RESEND_API_KEY) throw new Error("Missing RESEND_API_KEY env var");
if (!FROM_EMAIL) throw new Error("Missing FROM_EMAIL env var");

const resend = new Resend(RESEND_API_KEY);

type SendEmailBody = {
  to: string | string[];
  subject: string;
  html?: string;
  text?: string;
};

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as SendEmailBody;

    // Basic validation
    if (!body?.to) return NextResponse.json({ error: "Missing 'to' address" }, { status: 400 });
    if (!body?.subject) return NextResponse.json({ error: "Missing 'subject'" }, { status: 400 });
    if (!body?.html && !body?.text) {
      return NextResponse.json({ error: "Provide 'html' or 'text' content" }, { status: 400 });
    }

    const toArray = Array.isArray(body.to) ? body.to : [body.to];

    // Build payload with exactly one content field to satisfy strict typings
    const base = {
      from: `Kanarra Heights Homestead <${FROM_EMAIL}>`,
      to: toArray,
      subject: body.subject,
    };

    let payload: Record<string, unknown>;
    if (body.html) {
      payload = { ...base, html: body.html };
    } else {
      payload = { ...base, text: body.text! };
    }

    // Cast to any to sidestep SDK union-narrowing issues across versions
    const { data, error } = await resend.emails.send(payload as any);

    if (error) {
      const msg = typeof error === "string" ? error : JSON.stringify(error);
      return NextResponse.json({ error: msg }, { status: 400 });
    }

    return NextResponse.json({ id: data?.id }, { status: 200 });
  } catch (e: any) {
    const msg = typeof e?.message === "string" ? e.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
}
