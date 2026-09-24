import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { logAuditEvent } from '@/lib/audit-log'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function requireAdminUser(req: NextRequest) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '') ??
                req.cookies.get('sb-access-token')?.value ?? ''
  if (!token) return null
  const { data: { user }, error } = await supabase.auth.getUser(token)
  if (error || !user) return null
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  return profile?.role === 'admin' ? user : null
}

export async function POST(req: NextRequest) {
  const adminUser = await requireAdminUser(req)
  if (!adminUser) return NextResponse.json({ error: 'Se requiere rol admin' }, { status: 403 })

  try {
    const { userId, amount, operation, reason } = await req.json()
    if (!userId || amount === undefined || !operation)
      return NextResponse.json({ error: 'Missing fields' }, { status: 400 })

    const { data: existing } = await supabase
      .from('user_balances')
      .select('balance')
      .eq('user_id', userId)
      .single()
    const currentBalance = Number(existing?.balance ?? 0)

    let newBalance: number
    if (operation === 'add') newBalance = currentBalance + Number(amount)
    else if (operation === 'subtract') newBalance = Math.max(0, currentBalance - Number(amount))
    else newBalance = Number(amount)

    const { error } = await supabase.from('user_balances').upsert(
      { user_id: userId, balance: newBalance, updated_at: new Date().toISOString() },
      { onConflict: 'user_id' }
    )
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    // Audit trail — log to balance_transactions
    const adjustedAmount =
      operation === 'add' ? Number(amount)
      : operation === 'subtract' ? -Math.min(Number(amount), currentBalance)
      : newBalance - currentBalance
    await supabase.from('balance_transactions').insert({
      user_id: userId,
      amount: adjustedAmount,
      type: 'manual_adjustment',
      description: `Admin adjustment (${operation})${reason ? ': ' + reason : ''}`,
      balance_before: currentBalance,
      balance_after: newBalance,
    })

    // Audit trail — log to audit_logs for admin accountability
    logAuditEvent(
      adminUser.id,
      'user.balance_adjust',
      'user_balances',
      userId,
      {
        operation,
        amount: Number(amount),
        reason: reason ?? null,
        balance_before: currentBalance,
        balance_after: newBalance,
        admin_id: adminUser.id,
      }
    )

    return NextResponse.json({ success: true, newBalance })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
