import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2024-06-20' })
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

export const config = { api: { bodyParser: false } }

export async function POST(req: NextRequest) {
  const body = await req.text()
  const sig = req.headers.get('stripe-signature') || ''

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET || 'dummy')
  } catch {
    try { event = JSON.parse(body) } catch { return NextResponse.json({ error: 'Invalid' }, { status: 400 }) }
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session
    const meta = session.metadata || {}

    if (meta.type === 'balance_recharge' && meta.userId && meta.amount) {
      const amount = parseFloat(meta.amount)
      const { data: current } = await supabase.from('user_balances').select('balance').eq('user_id', meta.userId).single()
      const balanceBefore = current?.balance || 0
      const balanceAfter = balanceBefore + amount
      await supabase.from('user_balances').upsert({ user_id: meta.userId, balance: balanceAfter, currency: 'USD', updated_at: new Date().toISOString() }, { onConflict: 'user_id' })
      await supabase.from('balance_transactions').insert({ user_id: meta.userId, amount, type: 'recharge', description: 'Recarga via Stripe - $' + amount, stripe_session_id: session.id, balance_before: balanceBefore, balance_after: balanceAfter }).select().maybeSingle()
    } else {
      const chargingSessionId = meta.charging_session_id || meta.sessionId
      if (chargingSessionId) {
        await supabase.from('charging_sessions').update({ stripe_payment_status: 'paid' }).eq('id', chargingSessionId)
      }
    }
  }

  return NextResponse.json({ received: true })
}