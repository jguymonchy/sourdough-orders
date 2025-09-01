// app/api/send-email/route.ts
import { NextResponse } from "next/server";
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY ?? "");

type SendEmailBody = {
  to: string | string[];
  subject: string;
  html?: string;
  text?: string;
};

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as SendEmailBody;

    if (!process.env.RESEND_API_KEY) throw new Error("RESEND_API_KEY missing");
    if (!process.env.FROM_EMAIL) throw new Error("FROM_EMAIL missing");

    const to = Array.isArray(body.to) ? body.to : [body.to];
    if (!to || !to.length || !to[0]) {
      return NextResponse.json({ error: "Missing 'to' address" }, { status: 400 });
    }
    if (!body.subject) {
      return NextResponse.json({ error: "Missing 'subject'" }, { status: 400 });
    }
    if (!body.html && !body.text) {
      return NextResponse.json({ error: "Provide 'html' or 'text' content" }, { status: 400 });
    }

    const options: any = {
      from: `Kanarra Heights Homestead <${process.env.FROM_EMAIL}>`,
      to,
      subject: body.subject,
    };
    if (body.html) options.html = body.html;
    if (body.text) options.text = body.text;

    const { data, error } = await resend.emails.send(options as any);

    if (error) return NextResponse.json({ error }, { status: 400 });
    return NextResponse.json({ id: data?.id }, { status: 200 });
  } catch (err: any) {
    const msg = typeof err?.message === "string" ? err.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

