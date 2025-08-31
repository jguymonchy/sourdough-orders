// app/api/send-email/route.ts
import { NextResponse } from "next/server";
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const fromName =
      body.fromName ||
      (typeof body.from === "string" ? body.from.split("<")[0].trim() : null) ||
      "Kanarra Heights Homestead";

    const fromAddress =
      (typeof body.from === "string" && body.from.includes("<"))
        ? body.from
        : `${fromName} <${process.env.FROM_EMAIL}>`;

    const { data, error } = await resend.emails.send({
      from: fromAddress,                    // <- uses our brand name
      to: body.to,                          // string | string[]
      subject: body.subject,
      html: body.html,
      // optional:
      reply_to: body.replyTo || process.env.FROM_EMAIL,
    });

    if (error) {
      console.error("Resend error:", error);
      return NextResponse.json({ error: String(error) }, { status: 500 });
    }

    return NextResponse.json({ id: data?.id || null }, { status: 200 });
  } catch (e: any) {
    console.error("send-email route error:", e);
    return NextResponse.json({ error: e?.message ?? "Unknown error" }, { status: 500 });
  }
}
