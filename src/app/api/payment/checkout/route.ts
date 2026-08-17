/**
 * DEUNA Payment Checkout API Route
 * POST /api/payment/checkout
 *
 * Activa cuando tengas DEUNA_API_KEY configurada en Railway.
 * Body: { chargerId, userId, estimatedKwh, pricePerKwh }
 * Returns: { checkoutUrl, orderId }
 */
import { NextRequest, NextResponse } from 'next/server'

const DEUNA_API_KEY  = process.env.DEUNA_API_KEY
const DEUNA_SANDBOX  = process.env.DEUNA_SANDBOX !== 'false'
const DEUNA_BASE_URL = DEUNA_SANDBOX
  ? 'https://api.sandbox.deuna.io'
  : 'https://api.deuna.io'

export async function POST(req: NextRequest) {
  if (!DEUNA_API_KEY) {
    return NextResponse.json(
      { error: 'DEUNA_API_KEY no configurada. Agrégala como variable de entorno en Railway.' },
      { status: 503 }
    )
  }

  const body = await req.json()
  const { chargerId, userId, estimatedKwh, pricePerKwh } = body

  if (!chargerId || !estimatedKwh || !pricePerKwh) {
    return NextResponse.json({ error: 'Faltan campos requeridos: chargerId, estimatedKwh, pricePerKwh' }, { status: 400 })
  }

  const totalAmount = Math.round(estimatedKwh * pricePerKwh * 100) // centavos
  const currency    = 'USD'
  const orderId     = `EV-${chargerId}-${Date.now()}`

  try {
    const res = await fetch(`${DEUNA_BASE_URL}/merchants/orders`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Api-Key': DEUNA_API_KEY,
      },
      body: JSON.stringify({
        order: {
          order_id:    orderId,
          currency,
          total_amount: totalAmount,
          items: [
            {
              id:          chargerId,
              name:        `Carga EV — ${chargerId}`,
              description: `${estimatedKwh} kWh @ $${pricePerKwh}/kWh`,
              quantity:    1,
              unit_price:  totalAmount,
              total_price: totalAmount,
            },
          ],
          metadata: {
            charger_id: chargerId,
            user_id:    userId ?? null,
            kwh:        estimatedKwh,
          },
        },
        user: {
          // DEUNA requiere datos de usuario para crear el checkout
          // Si tienes el email/teléfono del usuario, pásalo aquí
          email: body.userEmail ?? 'guest@evcharging.com',
          phone: body.userPhone ?? '',
          first_name: body.userName ?? 'Usuario',
          last_name:  '',
        },
        callback_config: {
          success_redirect_url: `${process.env.NEXT_PUBLIC_APP_URL ?? ''}/payment/success?order=${orderId}`,
          failure_redirect_url: `${process.env.NEXT_PUBLIC_APP_URL ?? ''}/payment/failure?order=${orderId}`,
        },
      }),
    })

    if (!res.ok) {
      const err = await res.text()
      console.error('[DEUNA] Error creando orden:', err)
      return NextResponse.json({ error: 'Error al crear la orden en DEUNA', detail: err }, { status: 502 })
    }

    const data = await res.json()
    const checkoutUrl = data.order?.redirect_url ?? data.order?.order_url ?? data.checkout_url

    return NextResponse.json({ checkoutUrl, orderId, amount: totalAmount / 100, currency })
  } catch (err) {
    console.error('[DEUNA] Excepción:', err)
    return NextResponse.json({ error: 'Error interno al procesar el pago' }, { status: 500 })
  }
}
