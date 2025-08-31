import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// Only run middleware on admin UI and the admin-only GET to /api/order.
// It will NOT run for /manifest.webmanifest, /icons/*, /sw.js, etc.
export const config = {
  matcher: ['/admin/:path*', '/api/order', '/api/order/:path*'],
}

export function middleware(req: NextRequest) {
  const cookieName = process.env.SESSION_COOKIE_NAME || 'admin_session'
  const hasSession = req.cookies.get(cookieName)?.value

  const isAdminUI = req.nextUrl.pathname.startsWith('/admin')
  const isOrdersApi = req.nextUrl.pathname.startsWith('/api/order')

  // We want POST /api/order (placing orders) to be public,
  // but protect reading orders (GET) behind the admin session.
  const isProtectedApiCall = isOrdersApi && req.method !== 'POST'

  if ((isAdminUI || isProtectedApiCall) && !hasSession) {
    if (req.nextUrl.pathname.startsWith('/api/')) {
      return new NextResponse('Unauthorized', { status: 401 })
    }
    return NextResponse.redirect(new URL('/admin', req.url))
  }

  return NextResponse.next()
}

