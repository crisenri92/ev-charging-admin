import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  const token = request.cookies.get('admin_token')?.value
  const { pathname } = request.nextUrl

  if (pathname === '/login') return NextResponse.next()

  if (!token || token !== process.env.ADMIN_SECRET) {
    return NextResponse.redirect(new URL('/login', request.url))
  }
  return NextResponse.next()
}

export const config = { matcher: ['/((?!_next|favicon.ico|api).*)'] }
