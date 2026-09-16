/**
 * POST /api/charging/start
 * Inicia una sesión de carga.
 * Busca autorización activa o valida saldo de wallet.
 * Envía RemoteStartTransaction al CSMS OCPP.
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireAuthFromRequest, supabaseAdmin } from '@/lib/api-helpers'
import { getCurrentPrice } from '@/lib/pricing'
import { getPaymentRepository } from '@/lib/database/payment-repository'

const OCPP_URL = process.env.OCPP_SERVER_URL || 'https://ev-charging-csms-production.up.railway.app'

export async function POST(req: NextRequest) {
  try {
    const { chargerId } = await req.json()
    const { user } = await requireAuthFromRequest(req)
    const supabase = supabaseAdmin()
    const repo = getPaymentRepository()

    const authorization = await repo.findActiveAuthorization(user.id, chargerId)

    let paymentMethod = 'wallet'
    let balance = 0

    if (authorization) {
      console.log('[Charging Start] Using payment authorization:', authorization.id)
      paymentMethod = authorization.provider
      await repo.useAuthorization(authorization.id, '')
    } else {
      console.log('[Charging Start] Using wallet payment')
      const { data: balanceRow } = await supabase
        .from('user_balances')
        .select('balance')
        .eq('user_id', user.id)
        .single()

      balance = balanceRow?.balance || 0
      if (balance <= 0) {
        return NextResponse.json({ error: 'insufficient_balance', balance }, { status: 402 })
      }
    }

    const { data: charger } = await supabase
      .from('chargers')
      .select('id, name, price_per_kwh')
      .eq('id', chargerId)
      .single()

    const { price: dynamicPrice, ruleName } = await getCurrentPrice(process.env.SUPABASE_SERVICE_ROLE_KEY!)
    const pricePerKwh = dynamicPrice || charger?.price_per_kwh || 0.15

    // Crear sesión en Supabase
    const { data: session, error } = await supabase
      .from('charging_sessions')
      .insert({
        user_id: user.id,
        charger_id: chargerId,
        charger_name: charger?.name || chargerId,
        status: 'active',
        started_at: new Date().toISOString(),
      })
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    if (authorization) {
      await supabase
        .from('charging_authorizations')
        .update({ charging_session_id: session.id })
        .eq('id', authorization.id)
    }

    await supabase
      .from('charger_reservations')
      .update({ status: 'cancelled' })
      .eq('charger_id', chargerId)
      .eq('user_id', user.id)
      .eq('status', 'active')

    // Enviar RemoteStartTransaction al CSMS OCPP (no bloqueante)
    try {
      const ocppRes = await fetch(`${OCPP_URL}/api/chargers/${chargerId}/remote-start`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.CSMS_WEBHOOK_SECRET}`,
        },
        body: JSON.stringify({
          sessionId: session.id,
          userId: user.id,
          connectorId: 1,
        }),
      })
      if (!ocppRes.ok) {
        console.warn(`[Charging Start] OCPP RemoteStart returned ${ocppRes.status}`)
      } else {
        console.log('[Charging Start] OCPP RemoteStart sent successfully')
      }
    } catch (ocppErr) {
      // No bloqueante: la sesión ya está creada en BD
      console.error('[Charging Start] OCPP RemoteStart failed (non-fatal):', ocppErr)
    }

    return NextResponse.json({
      sessionId: session.id,
      balance,
      chargerName: charger?.name,
      pricePerKwh,
      pricingRule: ruleName,
      paymentMethod,
      authorized: !!authorization,
    })
  } catch (err: any) {
    console.error('[Charging Start] Error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
