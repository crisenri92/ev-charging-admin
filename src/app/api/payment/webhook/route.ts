import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2024-06-20' })
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

export async function POST(req: NextRequest) {
  const body = await req.text()
  const sig = req.headers.get('stripe-signature') || ''

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET!)
  } catch (err: any) {
    console.error('[Webhook] Firma inválida:', err.message)
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session
    const meta = session.metadata || {}

    if (meta.type === 'balance_recharge' && meta.userId && meta.amount) {
      const amount = parseFloat(meta.amount)
      const { data: current } = await supabase
        .from('user_balances').select('balance').eq('user_id', meta.userId).single()
      const balanceBefore = parseFloat(current?.balance ?? '0')
      const balanceAfter  = parseFloat((balanceBefore + amount).toFixed(2))

      const { error: e1 } = await supabase.from('user_balances').upsert(
        { user_id: meta.userId, balance: balanceAfter, currency: 'USD', updated_at: new Date().toISOString() },
        { onConflict: 'user_id' }
      )
      if (e1) {
        console.error('[Webhook] Error actualizando balance:', e1.message)
        return NextResponse.json({ error: 'DB error' }, { status: 500 })
      }

      await supabase.from('balance_transactions').insert({
        user_id:          meta.userId,
        amount,
        type:             'recharge',
        description:      `Recarga vía Stripe — $${amount}`,
        stripe_session_id: session.id,
        balance_before:   balanceBefore,
        balance_after:    balanceAfter,
      })

      console.log(`[Webhook] $${amount} acreditado a ${meta.userId} → saldo: $${balanceAfter}`)
    }
  }

  return NextResponse.json({ received: true })
}
