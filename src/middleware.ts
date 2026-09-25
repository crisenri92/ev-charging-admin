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
]

// Admin API routes that require admin token
const ADMIN_API_PATHS = [
  '/api/admin',
  '/api/chargers',
  '/api/pricing/rules',
  '/api/vouchers',
]

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Always allow: welcome page, login, forgot-password, mobile app
  if (
    pathname === '/' ||
    pathname === '/login' ||
    pathname === '/forgot-password' ||
    pathname.startsWith('/mobile')
  ) {
    return NextResponse.next()
  }

  // API routes: only protect ADMIN_API_PATHS with admin token
  if (pathname.startsWith('/api/')) {
    const isAdminApi = ADMIN_API_PATHS.some(p => pathname.startsWith(p))
    if (isAdminApi) {
      const adminToken = request.cookies.get('admin_token')?.value
      if (!adminToken || adminToken !== process.env.ADMIN_SECRET) {
        return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
      }
    }
    return NextResponse.next()
  }

  // Admin dashboard pages: require admin token
  const isAdminPage = ADMIN_PAGE_PREFIXES.some(p => pathname.startsWith(p))
  if (isAdminPage) {
    const adminToken = request.cookies.get('admin_token')?.value
    if (!adminToken || adminToken !== process.env.ADMIN_SECRET) {
      return NextResponse.redirect(new URL('/login', request.url))
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next|favicon\.ico|manifest\.json|sw\.js|icon-|.*\.png|.*\.svg|.*\.webmanifest).*)'],
}
