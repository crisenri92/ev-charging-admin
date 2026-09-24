import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function requireAdminUser(req: NextRequest) {
  const token =
    req.headers.get('authorization')?.replace('Bearer ', '') ??
    req.cookies.get('sb-access-token')?.value ??
    ''
  if (!token) return null
  const { data: { user }, error } = await supabase.auth.getUser(token)
  if (error || !user) return null
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()
  return profile?.role === 'admin' ? user : null
}

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const adminUser = await requireAdminUser(req)
  if (!adminUser)
    return NextResponse.json({ error: 'Se requiere rol admin' }, { status: 403 })

  const { id } = params

  const { data, error } = await supabase
    .from('charging_sessions')
    .select(
      'id, status, started_at, ended_at, energy_kwh, cost, charger_id, charger_name, stop_reason'
    )
    .eq('user_id', id)
    .order('started_at', { ascending: false })
    .limit(50)

  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json(data)
}
