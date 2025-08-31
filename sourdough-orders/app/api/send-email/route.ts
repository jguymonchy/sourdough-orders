// app/api/send-email/route.ts
import { NextResponse } from "next/server";
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(req: Request) {
  try {
    const { to, subject, html } = await req.json();

    if (!to || (Array.isArray(to) && to.length === 0)) {
      return NextResponse.json({ error: "Missing 'to' address" }, { status: 400 });
    }

    const { data, error } = await resend.emails.send({
      from: `FieldLux Orders <${process.env.FROM_EMAIL!}>`,
      to: Array.isArray(to) ? to : [to], // always make it an array
      subject: subject ?? "Thanks for your order!",
      html: html ?? "<p>Order received — thanks!</p>",
    });

    if (error) {
      return NextResponse.json({ error }, { status: 400 });
    }

    return NextResponse.json({ id: data?.id }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message ?? "Unknown error" }, { status: 500 });
  }
}
