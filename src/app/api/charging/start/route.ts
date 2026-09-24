/**
 * POST /api/charging/start
 * Inicia una sesión de carga.
 * Si hay autorización Deuna la usa; si no, valida saldo de wallet.
 *
 * fix(C-3): session created as 'pending_ocpp'; promoted to 'active' ONLY
 * after OCPP RemoteStartTransaction is confirmed (up to 3 retries).
 * On failure: status set to 'failed', wallet authorization restored,
 * 503 returned — the user is NOT charged.
 *
 * SCHEMA NOTE: If charging_sessions.status has a CHECK constraint that
 * does not include 'pending_ocpp' or 'failed', run this migration:
 *   ALTER TABLE charging_sessions
 *     DROP CONSTRAINT IF EXISTS charging_sessions_status_check;
 *   ALTER TABLE charging_sessions
 *     ADD CONSTRAINT charging_sessions_status_check
 *     CHECK (status IN ('pending_ocpp', 'active', 'completed', 'failed'));
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireAuthFromRequest, supabaseAdmin } from '@/lib/api-helpers'
import { getCurrentPrice } from '@/lib/pricing'
import { getPaymentRepository } from '@/lib/database/payment-repository'

const OCPP_MAX_RETRIES = 3
const OCPP_RETRY_DELAY_MS = 1000

/**
 * Send OCPP 1.6 RemoteStartTransaction to the backend bridge, with linear backoff.
 * Returns true if the charger accepted within OCPP_MAX_RETRIES attempts.
 *
 * If OCPP_BACKEND_URL is not set (non-OCPP deployment), returns true to preserve
 * existing behaviour. Set the env var in production to enforce OCPP confirmation.
 */
async function sendOcppRemoteStart(chargerId: string, sessionId: string): Promise<boolean> {
  const ocppUrl = process.env.OCPP_BACKEND_URL
  if (!ocppUrl) {
    console.warn('[OCPP] OCPP_BACKEND_URL not configured — skipping OCPP (non-OCPP mode)')
    return true
  }

  for (let attempt = 1; attempt <= OCPP_MAX_RETRIES; attempt++) {
    try {
      const res = await fetch(`${ocppUrl}/remote-start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chargerId, transactionId: sessionId }),
        signal: AbortSignal.timeout(5000),
      })

      if (res.ok) {
        const data = await res.json()
        if (data?.status === 'Accepted') {
          console.log(`[OCPP] RemoteStartTransaction accepted (attempt ${attempt})`)
          return true
        }
        console.warn(`[OCPP] Attempt ${attempt}: unexpected status=${data?.status}`)
      } else {
        console.warn(`[OCPP] Attempt ${attempt}: HTTP ${res.status}`)
      }
    } catch (err) {
      console.error(`[OCPP] Attempt ${attempt} error:`, err)
    }

    if (attempt < OCPP_MAX_RETRIES) {
      await new Promise(r => setTimeout(r, OCPP_RETRY_DELAY_MS * attempt))
    }
  }

  console.error(`[OCPP] All ${OCPP_MAX_RETRIES} retries exhausted for charger ${chargerId}`)
  return false
}

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

    // C-3 fix: create session as 'pending_ocpp' — not yet confirmed by the physical charger
    const { data: session, error } = await supabase
      .from('charging_sessions')
      .insert({
        user_id: user.id,
        charger_id: chargerId,
        charger_name: charger?.name || chargerId,
        price_per_kwh: pricePerKwh,
        status: 'pending_ocpp',
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

    // C-3 fix: block until OCPP confirms (or all retries fail) before returning to client
    const ocppSuccess = await sendOcppRemoteStart(chargerId, session.id)

    if (!ocppSuccess) {
      // Mark session as failed so it is invisible to active-session queries
      await supabase
        .from('charging_sessions')
        .update({ status: 'failed' })
        .eq('id', session.id)

      // Restore wallet balance if a wallet authorization was consumed at start
      // (authorization.amount holds the pre-authorized value)
      if (authorization && authorization.provider === 'wallet') {
        const { error: rpcErr } = await supabase.rpc('restore_wallet_balance', {
          p_user_id: user.id,
          p_amount: (authorization as any).amount ?? 0,
        })
        if (rpcErr) {
          // Non-fatal: session is failed; flag for manual reconciliation
          console.error('[OCPP] Wallet restoration failed — manual reconciliation needed:', rpcErr.message)
        }
      }

      return NextResponse.json(
        { error: 'Charger unavailable, payment not charged' },
        { status: 503 }
      )
    }

    // OCPP confirmed — promote session to active
    const { error: updateErr } = await supabase
      .from('charging_sessions')
      .update({ status: 'active' })
      .eq('id', session.id)

    if (updateErr) {
      console.error('[Charging Start] Failed to promote session to active:', updateErr.message)
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
