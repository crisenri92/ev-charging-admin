import { NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-06-30.basil',
})

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(request: Request) {
  const body = await request.text()
  const sig = request.headers.get('stripe-signature')
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET

  let event: Stripe.Event

  try {
    if (webhookSecret && sig) {
      event = stripe.webhooks.constructEvent(body, sig, webhookSecret)
    } else {
      event = JSON.parse(body) as Stripe.Event
    }
  } catch (err) {
    console.error('[Webhook] Error verificando firma:', err)
    return NextResponse.json({ error: 'Webhook signature invalida' }, { status: 400 })
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session

    const chargerId = session.metadata?.chargerId
    const sessionId = session.id
    const amountTotal = session.amount_total ?? 0

    console.log('[Webhook] Pago completado:', { sessionId, chargerId, amountTotal })

    if (chargerId) {
      const { error } = await supabase
        .from('charging_sessions')
        .upsert({
          stripe_session_id: sessionId,
          charger_id: chargerId,
          amount_paid: amountTotal / 100,
          currency: session.currency ?? 'usd',
          payment_status: 'paid',
          customer_email: session.customer_details?.email ?? null,
          paid_at: new Date().toISOString(),
        }, {
          onConflict: 'stripe_session_id',
        })

      if (error) {
        console.error('[Webhook] Error guardando en Supabase:', error)
        return NextResponse.json({ error: 'Error al guardar sesion' }, { status: 500 })
      }
    }
  }

  return NextResponse.json({ received: true })
}
