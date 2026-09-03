import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  const token = request.cookies.get('admin_token')?.value
  const { pathname } = request.nextUrl

  // Public routes: landing, admin login, mobile app
  if (pathname === '/' || pathname === '/login' || pathname.startsWith('/mobile')) {
    return NextResponse.next()
  }

  // Admin-only routes
  if (!token || token !== process.env.ADMIN_SECRET) {
    return NextResponse.redirect(new URL('/login', request.url))
  }
  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next|favicon.ico|api|manifest\.json|sw\.js|icon-|.*\.png|.*\.svg|.*\.webmanifest).*)'],
}
