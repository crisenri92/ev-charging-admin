import { NextResponse } from 'next/server'
import Stripe from 'stripe'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2026-07-29.dahlia' as any,
})

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { chargerId, estimatedKwh, pricePerKwh } = body

    if (!chargerId || !estimatedKwh || !pricePerKwh) {
      return NextResponse.json(
        { error: 'Faltan campos requeridos: chargerId, estimatedKwh, pricePerKwh' },
        { status: 400 }
      )
    }

    const totalKwh = parseFloat(estimatedKwh)
    const pricePerUnit = parseFloat(pricePerKwh)
    const amountInCents = Math.round(totalKwh * pricePerUnit * 100)

    if (amountInCents < 50) {
      return NextResponse.json(
        { error: 'El monto minimo es $0.50' },
        { status: 400 }
      )
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://ev-charging-admin-production.up.railway.app'

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'payment',
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: 'Carga EV - Cargador ' + chargerId,
              description: totalKwh + ' kWh @ $' + pricePerUnit + '/kWh',
            },
            unit_amount: amountInCents,
          },
          quantity: 1,
        },
      ],
      metadata: {
        chargerId: String(chargerId),
        estimatedKwh: String(totalKwh),
        pricePerKwh: String(pricePerUnit),
      },
      success_url: appUrl + '/sessions?payment=success',
      cancel_url: appUrl + '/chargers',
    })

    return NextResponse.json({
      checkoutUrl: session.url,
      sessionId: session.id,
      amount: amountInCents / 100,
    })
  } catch (err) {
    console.error('[Stripe] Error creando checkout session:', err)
    return NextResponse.json(
      { error: 'Error interno al procesar el pago', detail: (err as any)?.message },
      { status: 500 }
    )
  }
}
