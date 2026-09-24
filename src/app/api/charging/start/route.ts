/**
 * POST /api/charging/start
 * Inicia una sesión de carga.
 * Busca autorización activa o valida saldo de wallet.
 * Envía RemoteStartTransaction al CSMS OCPP (con retry).
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireAuthFromRequest, supabaseAdmin } from '@/lib/api-helpers'
import { getCurrentPrice } from '@/lib/pricing'
import { getPaymentRepository } from '@/lib/database/payment-repository'
import { checkRateLimit } from '@/lib/rate-limit'
import { logAuditEvent } from '@/lib/audit-log'

const OCPP_URL = process.env.OCPP_SERVER_URL || 'https://ev-charging-csms-production.up.railway.app'

export async function POST(req: NextRequest) {
  try {
    const { chargerId } = await req.json()
    const { user } = await requireAuthFromRequest(req)

    // Rate limiting: 5 requests per minute per user
    const rl = checkRateLimit(`rl:start:${user.id}`, 5, 60_000)
    if (!rl.ok) {
      return NextResponse.json(
        { error: 'too_many_requests', retryIn: Math.ceil(rl.resetIn / 1000) },
        { status: 429 }
      )
    }

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

    // Audit log: record charging session start (fire-and-forget)
    logAuditEvent(user.id, 'charging.start', 'charging_session', session.id, {
      chargerId,
      chargerName: charger?.name,
      paymentMethod,
      pricePerKwh,
    })

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

    // OCPP RemoteStart con retry (no bloqueante)
    ;(async () => {
      const MAX_RETRIES = 3
      const RETRY_DELAY_MS = 1000
      for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        try {
          const ocppRes = await fetch(`${OCPP_URL}/api/chargers/${chargerId}/remote-start`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${process.env.CSMS_WEBHOOK_SECRET}`,
            },
            body: JSON.stringify({ sessionId: session.id, userId: user.id, connectorId: 1 }),
          })
          if (ocppRes.ok) {
            console.log(`[Charging Start] OCPP RemoteStart OK (attempt ${attempt})`)
            break
          }
          console.warn(`[Charging Start] OCPP attempt ${attempt} returned ${ocppRes.status}`)
        } catch (err) {
          console.error(`[Charging Start] OCPP attempt ${attempt} failed:`, err)
        }
        if (attempt < MAX_RETRIES) await new Promise(r => setTimeout(r, RETRY_DELAY_MS * attempt))
      }
    })()

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
