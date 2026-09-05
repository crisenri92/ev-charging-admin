/**
 * POST /api/charging/start
 * Inicia una sesión de carga.
 * Si hay autorización Deuna la usa; si no, valida saldo de wallet.
 */

import { NextRequest } from 'next/server'
import { requireAuth, supabaseAdmin, apiError } from '@/lib/api-helpers'
import { getCurrentPrice } from '@/lib/pricing'
import { getPaymentRepository } from '@/lib/database/payment-repository'


export async function POST(req: NextRequest) {
  try {
    const { chargerId } = await req.json()
    const cookieStore = await cookies()

      const { user } = await requireAuth()
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
