import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// Public paths that don't require admin authentication
const PUBLIC_PATHS = ['/login', '/mobile', '/forgot-password']

export function middleware(request: NextRequest) {
  const token = request.cookies.get('admin_token')?.value
  const { pathname } = request.nextUrl

  // Allow all public paths and their sub-paths
  const isPublic = PUBLIC_PATHS.some(p => pathname === p || pathname.startsWith(p + '/'))
  if (isPublic) return NextResponse.next()

  if (!token || token !== process.env.ADMIN_SECRET) {
    return NextResponse.redirect(new URL('/login', request.url))
  }
  return NextResponse.next()
}

// Exclude: Next.js internals, static files, PWA assets, and API routes
export const config = {
  matcher: ['/((?!_next|favicon.ico|api|manifest\.json|sw\.js|icon-|.*\.png|.*\.svg|.*\.webmanifest).*)'],
}
