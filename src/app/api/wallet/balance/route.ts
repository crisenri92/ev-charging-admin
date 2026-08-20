import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'

export async function GET(req: NextRequest) {
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
  const cookieStore = cookies()
  const token =
    req.headers.get('authorization')?.replace('Bearer ', '').trim() ||
    cookieStore.get('sb-access-token')?.value
  if (!token) return NextResponse.json({ balance: 0, currency: 'USD' })
  const { data: { user } } = await supabase.auth.getUser(token)
  if (!user) return NextResponse.json({ balance: 0, currency: 'USD' })
  const { data } = await supabase.from('user_balances').select('balance, currency').eq('user_id', user.id).single()
  return NextResponse.json({ balance: data?.balance || 0, currency: data?.currency || 'USD' })
}
