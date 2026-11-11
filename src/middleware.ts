import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// Only these routes require admin token — everything else passes through
// and handles its own auth (e.g. Supabase session for user-facing pages)
const ADMIN_PATHS = ['/dashboard', '/users', '/chargers', '/transfers', '/audit']

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Allow /login itself (admin login page)
  if (pathname === '/login') return NextResponse.next()

  // Check if this is an admin-protected route
  const isAdminRoute = ADMIN_PATHS.some(p => pathname === p || pathname.startsWith(p + '/'))
  if (!isAdminRoute) return NextResponse.next()

  // Require admin token for admin routes
  const token = request.cookies.get('admin_token')?.value
  if (!token || token !== process.env.ADMIN_SECRET) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  return NextResponse.next()
}

// Exclude: Next.js internals, static files, PWA assets, and API routes
export const config = {
  matcher: ['/((?!_next|favicon.ico|api|manifest\.json|sw\.js|icon-|.*\.png|.*\.svg|.*\.webmanifest).*)'],
}
