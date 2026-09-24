import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { logAuditEvent } from '@/lib/audit-log'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function requireAdminUser(req: NextRequest) {
  const token =
    req.headers.get('authorization')?.replace('Bearer ', '') ??
    req.cookies.get('sb-access-token')?.value ??
    ''
  if (!token) return null
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser(token)
  if (error || !user) return null
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()
  return profile?.role === 'admin' ? user : null
}

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const adminUser = await requireAdminUser(req)
  if (!adminUser)
    return NextResponse.json({ error: 'Se requiere rol admin' }, { status: 403 })

  const { id } = params

  // Fetch session to validate state and get balance data
  const { data: session, error: fetchError } = await supabase
    .from('charging_sessions')
    .select('user_id, amount_charged, ended_at')
    .eq('id', id)
    .single()

  if (fetchError || !session) {
    return NextResponse.json({ error: 'Sesión no encontrada' }, { status: 404 })
  }

  if (session.ended_at) {
    return NextResponse.json({ error: 'La sesión ya está cerrada' }, { status: 409 })
  }

  // Force-stop: mark session as ended
  const { error: updateError } = await supabase
    .from('charging_sessions')
    .update({ ended_at: new Date().toISOString() })
    .eq('id', id)

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 })
  }

  // Restore wallet balance if a charge was deducted
  const amountToRestore = Number(session.amount_charged ?? 0)
  if (amountToRestore > 0 && session.user_id) {
    const { data: existing } = await supabase
      .from('user_balances')
      .select('balance')
      .eq('user_id', session.user_id)
      .single()
    const currentBalance = Number(existing?.balance ?? 0)
    const newBalance = currentBalance + amountToRestore
    await supabase.from('user_balances').upsert(
      {
        user_id: session.user_id,
        balance: newBalance,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id' }
    )
  }

  // Log the forced stop for audit trail
  logAuditEvent(
    adminUser.id,
    'charging.stop',
    'charging_session',
    id,
    {
      forced: true,
      admin_id: adminUser.id,
      balance_restored: amountToRestore,
    }
  )

  return NextResponse.json({
    success: true,
    message: 'Sesión cerrada forzosamente y saldo restaurado',
  })
}
