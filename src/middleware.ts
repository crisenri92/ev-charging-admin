import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// Routes that require admin token (dashboard + admin API routes)
const ADMIN_API_PATHS = [
  '/api/chargers',
  '/api/pricing',
  '/api/admin',
]

// Public API routes that skip auth (mobile auth handled per-route, webhooks are signed)
const PUBLIC_API_PREFIXES = [
  '/api/csms',        // OCPP webhook (has its own secret)
  '/api/auth',        // auth endpoints
  '/api/wallet',      // mobile: requireAuthFromRequest per route
  '/api/charging',    // mobile: requireAuthFromRequest per route
  '/api/reservations',// mobile: requireAuthFromRequest per route
  '/api/pricing',     // GET pricing is public (POST is admin)
]

export function middleware(request: NextRequest) {
  const { pathname, method } = request.nextUrl as any
  const _method = request.method

  // Allow Next.js internals and static assets through
  if (pathname.startsWith('/_next') || pathname.startsWith('/favicon')) {
    return NextResponse.next()
  }

  const adminCookie = request.cookies.get('admin_token')?.value
  const adminHeader = request.headers.get('x-admin-token')
  const isAdminAuthed =
    (adminCookie && adminCookie === process.env.ADMIN_SECRET) ||
    (adminHeader && adminHeader === process.env.ADMIN_SECRET)

  // Admin API routes: require admin auth
  if (pathname.startsWith('/api/')) {
    const isPublicApi = PUBLIC_API_PREFIXES.some(p => pathname.startsWith(p))
    const isAdminApi = ADMIN_API_PATHS.some(p => pathname.startsWith(p))

    // GET /api/pricing is public; POST/DELETE requires admin
    if (pathname.startsWith('/api/pricing') && _method === 'GET') {
      return NextResponse.next()
    }

    if (isAdminApi && !isPublicApi) {
      if (!isAdminAuthed) {
        return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
      }
    }
    return NextResponse.next()
  }

  // Dashboard pages: require admin auth
  if (pathname === '/login') return NextResponse.next()

  if (!isAdminAuthed) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next|favicon.ico|manifest\.json|sw\.js|icon-|.*\.png|.*\.svg|.*\.webmanifest).*)'],
}
