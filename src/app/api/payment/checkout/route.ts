import { NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2026-07-29.dahlia' as any,
})

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(request: Request) {
  try {
    const authHeader = request.headers.get('authorization')
    const token = authHeader?.replace('Bearer ', '')
    if (!token) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    if (authError || !user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const body = await request.json()
    const amount = parseFloat(body.amount)

    if (!amount || amount < 1) {
      return NextResponse.json({ error: 'El monto mínimo es $1.00' }, { status: 400 })
    }

    const amountInCents = Math.round(amount * 100)
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://ev-charging-admin-production.up.railway.app'

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      managed_payments: { enabled: false },
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: 'Recarga de saldo EV Charging',
              description: `Agregar $${amount.toFixed(2)} a tu wallet`,
            },
            unit_amount: amountInCents,
          },
          quantity: 1,
        },
      ],
      metadata: {
        userId: user.id,
        amount: String(amount),
        type: 'balance_recharge',
      },
      success_url: appUrl + '/wallet?recharge=success',
      cancel_url: appUrl + '/wallet',
    })

    return NextResponse.json({ checkoutUrl: session.url, sessionId: session.id, amount })
  } catch (err) {
    console.error('[Stripe] Checkout error:', err)
    return NextResponse.json({ error: 'Error al procesar el pago', detail: (err as any)?.message }, { status: 500 })
  }
}
