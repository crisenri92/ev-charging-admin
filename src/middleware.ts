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

const MAX_SESSION_AGE_MS = 8 * 60 * 60 * 1000 // 8 horas

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

    // Verificar expiracion de sesion
    const sessionCreatedAt = request.cookies.get('session_created_at')?.value

    if (!sessionCreatedAt) {
      // Sin timestamp: primera solicitud post-deploy -- inicializar ahora
      const response = NextResponse.next()
      response.cookies.set('session_created_at', Date.now().toString(), {
        sameSite: 'strict',
        maxAge: 60 * 60 * 24,
        path: '/',
      })
      return response
    }

    const age = Date.now() - parseInt(sessionCreatedAt, 10)
    if (age > MAX_SESSION_AGE_MS) {
      // Sesion expirada -- limpiar cookies y redirigir al login
      const response = NextResponse.redirect(new URL('/login?reason=session_expired', request.url))
      response.cookies.delete('session_created_at')
      response.cookies.delete('admin_token')
      return response
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next|favicon\.ico|manifest\.json|sw\.js|icon-|.*\.png|.*\.svg|.*\.webmanifest).*)'],
}
