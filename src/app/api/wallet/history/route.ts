import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'

export async function GET(req: NextRequest) {
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
  const cookieStore = cookies()
  const token = cookieStore.get('sb-access-token')?.value
  if (!token) return NextResponse.json({ transactions: [] })
  const { data: { user } } = await supabase.auth.getUser(token)
  if (!user) return NextResponse.json({ transactions: [] })
  const { data: txns, error } = await supabase.from('balance_transactions').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(15)
  if (!error && txns) return NextResponse.json({ transactions: txns })
  const { data: sessions } = await supabase.from('charging_sessions').select('id, cost, energy_kwh, charger_name, started_at').eq('user_id', user.id).not('cost', 'is', null).order('started_at', { ascending: false }).limit(15)
  const transactions = (sessions || []).map(s => ({ id: s.id, amount: -(s.cost || 0), type: 'charge_deduction', description: 'Sesion en ' + s.charger_name + ' - ' + (s.energy_kwh?.toFixed(2) || '?') + ' kWh', created_at: s.started_at }))
  return NextResponse.json({ transactions })
}