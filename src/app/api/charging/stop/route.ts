import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
const PRICE_PER_KWH = 0.15

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    // OCPP server sends: { chargerId, sessionId, meterStart, meterStop, reason }
    const { chargerId, sessionId, meterStart, meterStop, reason } = body

    // Find active session - by OCPP sessionId or charger_id
    let sessionQuery = supabase.from('charging_sessions')
      .select('*')
      .eq('status', 'active')

    if (sessionId) {
      sessionQuery = sessionQuery.eq('id', sessionId)
    } else if (chargerId) {
      const normalizedId = (chargerId as string).replace(/_/g, '')
      sessionQuery = sessionQuery.eq('charger_id', normalizedId).order('started_at', { ascending: false }).limit(1)
    }

    const { data: sessions } = await sessionQuery
    if (!sessions || sessions.length === 0) {
      return NextResponse.json({ message: 'No active session found' }, { status: 200 })
    }

    const session = sessions[0]
    const energyKwh = meterStop && meterStart ? (meterStop - meterStart) / 1000 : 0
    const pricePerKwh = PRICE_PER_KWH
    const cost = parseFloat((energyKwh * pricePerKwh).toFixed(4))
    const now = new Date().toISOString()

    // Mark session as completed
    await supabase.from('charging_sessions').update({
      status: 'completed',
      ended_at: now,
      energy_kwh: energyKwh,
      cost,
      stop_reason: reason || 'Remote',
    }).eq('id', session.id)

    // Deduct from balance
    if (cost > 0) {
      const { data: balanceRow } = await supabase
        .from('user_balances')
        .select('balance')
        .eq('user_id', session.user_id)
        .single()

      const currentBalance = balanceRow?.balance || 0
      const newBalance = Math.max(0, currentBalance - cost)

      await supabase.from('user_balances').update({ balance: newBalance }).eq('user_id', session.user_id)
      await supabase.from('balance_transactions').insert({
        user_id: session.user_id,
        amount: -cost,
        type: 'charge',
        description: `Sesión de carga - ${session.charger_name || session.charger_id} - ${energyKwh.toFixed(3)} kWh`,
        balance_after: newBalance,
        reference_id: session.id,
      })
    }

    return NextResponse.json({ ok: true, sessionId: session.id, cost, energyKwh })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
