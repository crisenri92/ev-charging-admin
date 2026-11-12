import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getCurrentPrice } from '@/lib/pricing'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://ev-charging-admin-production.up.railway.app'

/** Envía RemoteStopTransaction al CSMS. Best-effort, no lanza si falla. */
async function sendRemoteStop(chargerId: string): Promise<void> {
  const ocppServerUrl = process.env.OCPP_SERVER_URL
  if (!ocppServerUrl) return
  try {
    // Step 1: obtener estado del CSMS en memoria
    let csmsChargerId = chargerId
    let transactionId: number | null = null

    const chargerRes = await fetch(`${ocppServerUrl}/api/chargers`, {
      headers: { Authorization: `Bearer ${process.env.OCPP_API_SECRET || 'ev-admin-2024'}` },
    })
    if (chargerRes.ok) {
      const chargers: Array<{ id: string; activeSession: { transactionId: number } | null }> = await chargerRes.json()
      const csmsCharger = chargers.find(c => c.id === chargerId || c.id.replace(/_/g, '') === chargerId.replace(/_/g, ''))
      if (csmsCharger) {
        csmsChargerId = csmsCharger.id
        transactionId = csmsCharger.activeSession?.transactionId ?? null
      }
    }

    // Step 2: fallback — buscar transactionId en tabla sessions del CSMS (mismo Supabase)
    if (!transactionId) {
      const { data: csmsSession } = await supabase
        .from('sessions')
        .select('transaction_id, charger_id')
        .eq('status', 'Active')
        .or(`charger_id.eq.${chargerId},charger_id.eq.${chargerId.replace(/_/g, '')}`)
        .order('start_time', { ascending: false })
        .limit(1)
        .single()
      if (csmsSession?.transaction_id) {
        transactionId = csmsSession.transaction_id
        csmsChargerId = csmsSession.charger_id
      }
    }

    if (!transactionId) return  // sin transacción activa

    await fetch(`${ocppServerUrl}/api/admin/chargers/${csmsChargerId}/remote-stop`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.OCPP_API_SECRET || 'ev-admin-2024'}` },
      body: JSON.stringify({ transactionId }),
    })
  } catch { /* best-effort */ }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { chargerId, sessionId, meterStart, meterStop, reason } = body

    let sessionQuery = supabase.from('charging_sessions').select('*').eq('status', 'active')
    if (sessionId) {
      sessionQuery = sessionQuery.eq('id', sessionId)
    } else if (chargerId) {
      const normalizedId = (chargerId as string).replace(/_/g, '')
      sessionQuery = sessionQuery.eq('charger_id', normalizedId).order('started_at', { ascending: false }).limit(1)
    }
    const { data: sessions } = await sessionQuery
    if (!sessions || sessions.length === 0) return NextResponse.json({ message: 'No active session found' })

    const session = sessions[0]

    // Enviar RemoteStop al cargador físico (best-effort)
    await sendRemoteStop(session.charger_id)

    const energyKwh = (meterStop != null && (meterStart ?? session.meter_start) != null) ? (meterStop - (meterStart ?? session.meter_start)) / 1000 : 0
    const { price: pricePerKwh } = await getCurrentPrice(process.env.SUPABASE_SERVICE_ROLE_KEY!)
    const cost = parseFloat((energyKwh * pricePerKwh).toFixed(4))
    const now = new Date().toISOString()

    // Calcular tiempo transcurrido en minutos
    const startedAt = session.started_at ? new Date(session.started_at) : new Date(session.created_at)
    const elapsedMs = new Date(now).getTime() - startedAt.getTime()
    const elapsedMinutes = Math.max(1, Math.ceil(elapsedMs / 60000))

    await supabase.from('charging_sessions').update({
      status: 'completed', ended_at: now, energy_kwh: energyKwh, cost, stop_reason: reason || 'Remote',
      meter_start: (meterStart ?? session.meter_start) ?? null, meter_stop: meterStop ?? null,
    }).eq('id', session.id)

    // Restaurar estado del cargador a Available
    await supabase.from('chargers').update({ status: 'Available' }).eq('id', session.charger_id)

    // Obtener saldo actual (dinero y minutos)
    const { data: balanceRow } = await supabase
      .from('user_balances')
      .select('balance, minutes_balance')
      .eq('user_id', session.user_id)
      .single()

    const currentBalance = balanceRow?.balance || 0
    const currentMinutes = balanceRow?.minutes_balance || 0
    let newBalance = currentBalance
    let newMinutesBalance: number | null = null

    if (currentMinutes > 0) {
      // Facturación por minutos: descontar minutos usados
      const minutesUsed = Math.min(elapsedMinutes, currentMinutes)
      newMinutesBalance = Math.max(0, currentMinutes - minutesUsed)
      await supabase.from('user_balances')
        .update({ minutes_balance: newMinutesBalance })
        .eq('user_id', session.user_id)
      await supabase.from('balance_transactions').insert({
        user_id: session.user_id,
        amount: -minutesUsed,
        type: 'minutes_deduction',
        description: `Sesión de carga - ${session.charger_name || session.charger_id} - ${minutesUsed} min usados`,
        balance_after: currentBalance,
        reference_id: session.id,
      })
    } else if (cost > 0) {
      // Facturación por energía (kWh): descontar dinero
      newBalance = Math.max(0, currentBalance - cost)
      await supabase.from('user_balances').update({ balance: newBalance }).eq('user_id', session.user_id)
      await supabase.from('balance_transactions').insert({
        user_id: session.user_id, amount: -cost,
        type: 'charge_deduction',
        description: `Sesión de carga - ${session.charger_name || session.charger_id} - ${energyKwh.toFixed(3)} kWh`,
        balance_after: newBalance, reference_id: session.id,
      })

      // Notificación push
      try {
        await fetch(`${APP_URL}/api/push/send`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: session.user_id,
            title: '⚡ Carga completada',
            body: `${energyKwh.toFixed(2)} kWh · $${cost.toFixed(2)} descontado · Saldo: $${newBalance.toFixed(2)}`,
            url: '/mobile/historial',
          }),
        })
      } catch {} // non-blocking
    }

    return NextResponse.json({
      ok: true,
      sessionId: session.id,
      cost: currentMinutes > 0 ? 0 : cost,
      energyKwh,
      newBalance,
      minutesBalance: newMinutesBalance,
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
