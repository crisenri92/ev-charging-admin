
import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function POST(request: Request) {
  const { email, password } = await request.json()

  const { data, error } = await supabase.auth.signInWithPassword({ email, password })

  if (error || !data.user) {
    return NextResponse.json({ error: 'Credenciales incorrectas' }, { status: 401 })
  }

  // Check if user has admin role
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', data.user.id)
    .single()

  if (!profile || profile.role !== 'admin') {
    return NextResponse.json({ error: 'Sin permisos de administrador' }, { status: 403 })
  }

  const secret = process.env.ADMIN_SECRET || 'ev-admin-secret-2024'
  const response = NextResponse.json({ ok: true })
  response.cookies.set('admin_token', secret, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 7, // 7 days
    path: '/'
  })
  return response
}
