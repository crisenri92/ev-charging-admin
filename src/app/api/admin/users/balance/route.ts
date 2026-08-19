import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

export async function POST(req) {
  try {
    const { userId, amount, operation } = await req.json()
      return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
    const { data: existing } = await supabase.from('user_balances').select('balance').eq('user_id', userId).single()
    const currentBalance = existing?.balance ?? 0
    let newBalance
    if (operation === 'add') newBalance = Number(currentBalance) + Number(amount)
    else if (operation === 'subtract') newBalance = Math.max(0, Number(currentBalance) - Number(amount))
    else newBalance = Number(amount)
    const { error } = await supabase.from('user_balances').upsert({ user_id: userId, balance: newBalance, updated_at: new Date().toISOString() }, { onConflict: 'user_id' })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true, newBalance })
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}