import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(req: NextRequest) {
  if (req.nextUrl.pathname.startsWith('/admin') && !req.nextUrl.pathname.startsWith('/admin/login')) {
    const sessionCookieName = process.env.SESSION_COOKIE_NAME || 'admin_session'
    const cookie = req.cookies.get(sessionCookieName)
    if (!cookie || cookie.value !== '1') {
      const url = new URL('/admin/login', req.url)
      return NextResponse.redirect(url)
    }
  }
  return NextResponse.next()
}

export const config = {
  matcher: ['/admin/:path*']
}
