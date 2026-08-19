import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

export async function POST(req: NextRequest) {
  try {
    const { sessionId, energyKwh } = await req.json()
    const { data: session } = await supabase.from('charging_sessions').select('*, chargers(price_per_kwh)').eq('id', sessionId).single()
    if (!session) return NextResponse.json({ error: 'Sesion no encontrada' }, { status: 404 })
    const pricePerKwh = session.chargers?.price_per_kwh || 0.15
    const cost = parseFloat((energyKwh * pricePerKwh).toFixed(2))
    const durationSeconds = Math.round((Date.now() - new Date(session.started_at).getTime()) / 1000)
    const { data: balanceRow } = await supabase.from('user_balances').select('balance').eq('user_id', session.user_id).single()
    const balanceBefore = balanceRow?.balance || 0
    const balanceAfter = Math.max(0, balanceBefore - cost)
    await supabase.from('user_balances').update({ balance: balanceAfter, updated_at: new Date().toISOString() }).eq('user_id', session.user_id)
    await supabase.from('balance_transactions').insert({ user_id: session.user_id, amount: -cost, type: 'charge_deduction', description: 'Sesion de carga - ' + energyKwh.toFixed(2) + ' kWh', charging_session_id: sessionId, balance_before: balanceBefore, balance_after: balanceAfter }).select().maybeSingle()
    await supabase.from('charging_sessions').update({ ended_at: new Date().toISOString(), energy_kwh: energyKwh, cost, duration_seconds: durationSeconds, status: 'completed' }).eq('id', sessionId)
    return NextResponse.json({ cost, balanceAfter, energyKwh })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}