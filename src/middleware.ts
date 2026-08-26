import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// Paths accessible to mobile users (Supabase Auth) without admin_token
const MOBILE_PATHS = ['/mobile', '/wallet']
// Unauthenticated public pages
const PUBLIC_PATHS = ['/login', '/forgot-password']

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Allow public auth pages
  if (PUBLIC_PATHS.includes(pathname)) return NextResponse.next()

  // Allow mobile and wallet pages — they handle their own Supabase auth client-side
  if (MOBILE_PATHS.some(p => pathname === p || pathname.startsWith(p + '/'))) {
    return NextResponse.next()
  }

  // Admin pages require admin_token
  const token = request.cookies.get('admin_token')?.value
  if (!token || token !== process.env.ADMIN_SECRET) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  return NextResponse.next()
}

// Exclude: Next.js internals, static files, PWA assets, and API routes
export const config = {
  matcher: ['/((?!_next|favicon.ico|api|manifest\\.json|sw\\.js|icon-|.*\\.png|.*\\.svg|.*\\.webmanifest).*)'],
}
