import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2024-06-20' })

export async function POST(req: NextRequest) {
  try {
    const { amount } = await req.json()
    if (!amount || amount < 1) return NextResponse.json({ error: 'Monto invalido' }, { status: 400 })
    const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
    const cookieStore = cookies()
    const token = cookieStore.get('sb-access-token')?.value
    if (!token) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    const { data: { user } } = await supabase.auth.getUser(token)
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [{ price_data: { currency: 'usd', product_data: { name: 'Recarga de saldo EV - $' + amount }, unit_amount: Math.round(amount * 100) }, quantity: 1 }],
      mode: 'payment',
      managed_payments: { enabled: false } as any,
      metadata: { type: 'balance_recharge', amount: String(amount), userId: user.id },
      success_url: 'https://ev-charging-admin-production.up.railway.app/wallet?recharge=success',
      cancel_url: 'https://ev-charging-admin-production.up.railway.app/wallet',
    })
    return NextResponse.json({ checkoutUrl: session.url })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
