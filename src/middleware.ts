import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// Rutas públicas que no requieren autenticación de ningún tipo
const PUBLIC_PATHS = [
  '/login',
  '/mobile/login',
  '/mobile/register',
  '/mobile/forgot-password',
  '/mobile/reset-password',
]

// Rutas de la app móvil — usan Supabase Auth, no admin_token
const MOBILE_PREFIXES = ['/mobile', '/wallet']

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Permitir rutas públicas sin autenticación
  if (PUBLIC_PATHS.includes(pathname)) {
    return NextResponse.next()
  }

  // Permitir rutas móviles — Supabase Auth se encarga en cada página
  if (MOBILE_PREFIXES.some(prefix => pathname === prefix || pathname.startsWith(prefix + '/'))) {
    return NextResponse.next()
  }

  // Rutas admin — requieren admin_token
  const expectedSecret = process.env.ADMIN_SECRET || 'ev-admin-secret-2024'
  const token = request.cookies.get('admin_token')?.value

  if (!token || token !== expectedSecret) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  return NextResponse.next()
}

// Exclude: Next.js internals, static files, PWA assets, and API routes
export const config = {
  matcher: ['/((?!_next|favicon.ico|api|manifest\.json|sw\.js|icon-|.*\.png|.*\.svg|.*\.webmanifest).*)'],
}
