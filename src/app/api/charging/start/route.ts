/**
 * POST /api/charging/start
 * Inicia una sesión de carga.
 * Acepta Bearer token (móvil) o cookies de sesión (web).
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, supabaseAdmin, apiError } from '@/lib/api-helpers'
import { getCurrentPrice } from '@/lib/pricing'
import { getPaymentRepository } from '@/lib/database/payment-repository'

/** Verifica auth por Bearer token (móvil) o cookies (web). */
async function getAuthUser(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.slice(7)
    const admin = supabaseAdmin()
    const { data: { user }, error } = await admin.auth.getUser(token)
    if (error || !user) throw apiError('No autorizado', 401)
    return user
  }
  const { user } = await requireAuth()
  return user
}

/** Envía RemoteStartTransaction al servidor OCPP. */
async function sendRemoteStart(chargerId: string, idTag: string): Promise<void> {
  const ocppServerUrl = process.env.OCPP_SERVER_URL
  if (!ocppServerUrl) {
    console.warn('[Charging Start] OCPP_SERVER_URL not set — skipping RemoteStart')
    return
  }
  const res = await fetch(`${ocppServerUrl}/remote-start`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-ocpp-secret': process.env.OCPP_API_SECRET || 'dev-secret',
    },
    body: JSON.stringify({ chargerId, idTag: idTag.substring(0, 20), connectorId: 1 }),
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw Object.assign(new Error(body.error || 'ocpp_error'), { body, status: res.status })
  }
}

export async function POST(req: NextRequest) {
  try {
    const { chargerId } = await req.json()
    const user = await getAuthUser(req)
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

    // Enviar RemoteStartTransaction al cargador físico
    try {
      await sendRemoteStart(chargerId, user.id)
    } catch (ocppErr: any) {
      console.error('[Charging Start] OCPP RemoteStart failed:', ocppErr.message, ocppErr.body)
      // Si el cargador no está conectado, revertir y devolver error claro
      if (ocppErr.body?.error === 'charger_not_connected') {
        await supabase.from('charging_sessions').delete().eq('id', session.id)
        return NextResponse.json(
          { error: 'charger_not_connected', message: 'El cargador no está conectado al sistema OCPP. Verifica que esté encendido.' },
          { status: 503 }
        )
      }
      // Otros errores OCPP: seguir igual (la sesión queda en DB)
      console.warn('[Charging Start] Continuing despite OCPP error')
    }

    // Actualizar estado del cargador a Charging
    await supabase
      .from('chargers')
      .update({ status: 'Charging' })
      .eq('id', chargerId)

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
    return apiError(err.message || 'Error interno', 500)
  }
}
