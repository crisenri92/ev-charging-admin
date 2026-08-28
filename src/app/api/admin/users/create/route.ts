import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

export async function POST(req: NextRequest) {
  try {
    const { email, password, role = 'client', name = '' } = await req.json()
    if (!email || !password) return NextResponse.json({ error: 'Email y contraseña requeridos' }, { status: 400 })

    const { data, error } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { role, full_name: name },
    })
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })

    const userId = data.user.id
    await supabase.from('profiles').upsert({ id: userId, email, role, full_name: name }, { onConflict: 'id' })
    await supabase.from('user_balances').upsert({ user_id: userId, balance: 0 }, { onConflict: 'user_id' })

    // Audit log
    const adminToken = req.cookies.get('admin_token')?.value
    await supabase.from('audit_logs').insert({
      action: 'create_user',
      target_user_id: userId,
      details: { email, role, name },
      performed_by: adminToken ? 'admin' : 'system',
    }).then(() => {})  // non-blocking, ignore errors if table doesn't exist yet

    // Send welcome email with password reset so user can set their own password
    await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${process.env.NEXT_PUBLIC_APP_URL || 'https://ev-charging-admin-production.up.railway.app'}/mobile/reset-password`,
    })

    return NextResponse.json({ userId, email })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
