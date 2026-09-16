import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// Admin-only dashboard pages (everything else is public or mobile)
const ADMIN_PAGE_PREFIXES = [
  '/dashboard',
  '/chargers',
  '/users',
  '/pricing',
  '/sessions',
  '/audit',
  '/historial',
  '/vouchers',
  '/wallet',
]

// Admin API routes that require admin token
const ADMIN_API_PATHS = [
  '/api/admin',
  '/api/chargers',
  '/api/pricing/rules',
  '/api/vouchers',
]

// API routes that are fully public or handle their own auth
const PUBLIC_API_PREFIXES = [
  '/api/csms',
  '/api/auth',
  '/api/wallet',
  '/api/charging',
  '/api/reservations',
  '/api/pricing',       // GET is public; rules/ is protected above
  '/api/payments',
  '/api/push',
]

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  const method = request.method

  // Always allow Next.js internals and static assets
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon') ||
    pathname.startsWith('/icon-') ||
    pathname.endsWith('.png') ||
    pathname.endsWith('.svg') ||
    pathname.endsWith('.webmanifest')
  ) {
    return NextResponse.next()
  }

  // Public pages — always accessible
  if (
    pathname === '/' ||           // welcome page (user/admin selector)
    pathname === '/login' ||
    pathname === '/forgot-password' ||
    pathname.startsWith('/mobile') // mobile app handles its own Supabase auth
  ) {
    return NextResponse.next()
  }

  const adminCookie = request.cookies.get('admin_token')?.value
  const adminHeader = request.headers.get('x-admin-token')
  const isAdminAuthed =
    (adminCookie && adminCookie === process.env.ADMIN_SECRET) ||
    (adminHeader && adminHeader === process.env.ADMIN_SECRET)

  // API routes
  if (pathname.startsWith('/api/')) {
    // Pricing rules — admin only (GET is allowed, writes are protected at route level)
    // Admin API paths — block without token
    const isAdminApi = ADMIN_API_PATHS.some(p => pathname.startsWith(p))
    const isPublicApi = PUBLIC_API_PREFIXES.some(p => pathname.startsWith(p))

    if (isAdminApi && !isPublicApi) {
      if (!isAdminAuthed) {
        return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
      }
    }
    return NextResponse.next()
  }

  // Admin dashboard pages — require admin token
  const isAdminPage = ADMIN_PAGE_PREFIXES.some(p => pathname.startsWith(p))
  if (isAdminPage) {
    if (!isAdminAuthed) {
      return NextResponse.redirect(new URL('/login', request.url))
    }
    return NextResponse.next()
  }

  // Everything else: allow through
  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next|favicon.ico|manifest\.json|sw\.js|icon-|.*\.png|.*\.svg|.*\.webmanifest).*)'],
}
