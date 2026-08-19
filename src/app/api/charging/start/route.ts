import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

export async function POST(req: NextRequest) {
  try {
    const { chargerId } = await req.json()
    const cookieStore = cookies()
    const token = cookieStore.get('sb-access-token')?.value
    if (!token) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    const { data: { user } } = await supabase.auth.getUser(token)
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    const { data: balanceRow } = await supabase.from('user_balances').select('balance').eq('user_id', user.id).single()
    const balance = balanceRow?.balance || 0
    if (balance <= 0) return NextResponse.json({ error: 'insufficient_balance', balance }, { status: 402 })
    const { data: charger } = await supabase.from('chargers').select('id, name, price_per_kwh').eq('id', chargerId).single()
    const { data: session, error } = await supabase.from('charging_sessions').insert({
      user_id: user.id, charger_id: chargerId, charger_name: charger?.name || chargerId, status: 'active', started_at: new Date().toISOString()
    }).select().single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ sessionId: session.id, balance, chargerName: charger?.name })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}