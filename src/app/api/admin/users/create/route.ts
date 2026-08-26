import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: NextRequest) {
  try {
    const { email, password, role = 'client', name = '' } = await req.json()
    if (!email || !password) return NextResponse.json({ error: 'Email y contraseña requeridos' }, { status: 400 })

    const { data, error } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,  // skip email confirmation
      user_metadata: { role, full_name: name },
    })
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })

    // Ensure profile row exists
    await supabase.from('profiles').upsert({ id: data.user.id, role, full_name: name }, { onConflict: 'id' })
    // Create balance row
    await supabase.from('user_balances').upsert({ user_id: data.user.id, balance: 0, currency: 'USD' }, { onConflict: 'user_id' })

    return NextResponse.json({ user: { id: data.user.id, email: data.user.email } })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
