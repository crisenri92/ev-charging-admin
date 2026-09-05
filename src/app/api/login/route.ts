import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { checkRateLimit } from '@/lib/api-helpers'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

export async function POST(request: NextRequest) {
  const ip = request.headers.get('x-forwarded-for') ?? 'unknown'
  if (!checkRateLimit(`login:${ip}`, 5))
    return NextResponse.json({ error: 'Demasiados intentos. Espera un minuto.' }, { status: 429 })

  const { email, password } = await request.json()

  const authClient = createClient(supabaseUrl, supabaseAnonKey)
  const { data, error } = await authClient.auth.signInWithPassword({ email, password })

  if (error || !data.user) {
    return NextResponse.json({ error: 'Credenciales incorrectas' }, { status: 401 })
  }

  const adminClient = createClient(supabaseUrl, supabaseServiceKey)
  const { data: profile } = await adminClient
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
    maxAge: 60 * 60 * 24 * 7,
    path: '/'
  })
  return response
}
