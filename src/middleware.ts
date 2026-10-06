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


const MAX_SESSION_AGE_MS = 1 * 60 * 60 * 1000 // 1 hora


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
