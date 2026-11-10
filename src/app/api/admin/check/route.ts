import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

/**
 * POST /api/admin/check
 * Verifies if the authenticated Supabase user has admin role.
 * If so, sets the admin_token cookie so they can access the dashboard.
 * Used by mobile login to detect and redirect admin users.
 */
export async function POST(req: NextRequest) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '').trim()
  if (!token) return NextResponse.json({ isAdmin: false })

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data: { user } } = await supabase.auth.getUser(token)
  if (!user) return NextResponse.json({ isAdmin: false })

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role === 'admin') {
    const secret = process.env.ADMIN_SECRET || 'ev-admin-secret-2024'
    const response = NextResponse.json({ isAdmin: true, name: user.user_metadata?.full_name || user.email })
    response.cookies.set('admin_token', secret, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7,
      path: '/',
    })
    return response
  }

  return NextResponse.json({ isAdmin: false })
}
