import { NextRequest, NextResponse } from 'next/server'
import { checkRateLimit } from '@/lib/api-helpers'
import { createClient } from '@supabase/supabase-js'

const adminDb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for') ?? 'unknown'
  if (!checkRateLimit(`register:${ip}`, 3))
    return NextResponse.json({ error: 'Demasiados intentos. Espera un minuto.' }, { status: 429 })

  const { email, password, fullName } = await req.json()

  if (!email || !password) {
    return NextResponse.json({ error: 'Email y contrasena requeridos' }, { status: 400 })
  }

  // Use anon client signUp -- Supabase sends confirmation email automatically
  const anonDb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  const redirectTo = `${process.env.NEXT_PUBLIC_SITE_URL ?? 'https://recargat.app'}/mobile/login`

  const { data, error } = await anonDb.auth.signUp({
    email,
    password,
    options: {
      data: { full_name: fullName || '' },
      emailRedirectTo: redirectTo,
    },
  })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  // Supabase returns identities: [] when email already registered (security behavior)
  if (data.user && data.user.identities?.length === 0) {
    return NextResponse.json({ error: 'Este correo ya esta registrado.' }, { status: 400 })
  }

  const userId = data.user?.id
  if (userId) {
    // Initialize wallet immediately -- user exists in DB even though unconfirmed
    await adminDb.from('user_balances').upsert(
      { user_id: userId, balance: 0 },
      { onConflict: 'user_id', ignoreDuplicates: true }
    )
  }

  return NextResponse.json({ ok: true, requiresConfirmation: true })
}
