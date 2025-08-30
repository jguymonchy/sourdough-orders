import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const { password } = await req.json()
  const ok = password && process.env.ADMIN_PASSWORD && password === process.env.ADMIN_PASSWORD
  if (!ok) return new NextResponse('Unauthorized', { status: 401 })
  const cookieName = process.env.SESSION_COOKIE_NAME || 'admin_session'
  const res = NextResponse.json({ ok: true })
  res.cookies.set(cookieName, '1', { httpOnly: true, path: '/', secure: true, maxAge: 60 * 60 * 8 })
  return res
}
