import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { logAuditEvent } from '@/lib/audit-log'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// Bug #3 fix: removed requireAdminUser() — the middleware already validated the admin_token
// cookie before this handler is reached. Using a local Supabase JWT check was causing
// 403 because the admin panel never sends a Bearer token, only the admin_token cookie.
export async function POST(req: NextRequest) {
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
      'admin',
      'user.balance_adjust',
      'user_balances',
      userId,
      {
        operation,
        amount: Number(amount),
        reason: reason ?? null,
        balance_before: currentBalance,
        balance_after: newBalance,
      }
    )

    return NextResponse.json({ success: true, newBalance })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
