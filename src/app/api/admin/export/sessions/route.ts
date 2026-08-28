import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

export async function GET(req: NextRequest) {
  const token = req.cookies.get('admin_token')?.value
  if (!token) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  const { data: sessions } = await supabase
    .from('charging_sessions')
    .select('id, user_id, charger_id, charger_name, status, started_at, ended_at, energy_kwh, cost, stop_reason')
    .order('started_at', { ascending: false })
    .limit(5000)
  if (!sessions) return NextResponse.json({ error: 'Error' }, { status: 500 })
  const header = 'ID,Usuario,Cargador,Estado,Inicio,Fin,Energía kWh,Costo USD,Razón\n'
  const rows = sessions.map(s =>
    `"${s.id}","${s.user_id}","${s.charger_name || s.charger_id}","${s.status}","${s.started_at || ''}","${s.ended_at || ''}","${s.energy_kwh ?? ''}","${s.cost ?? ''}","${s.stop_reason || ''}"`
  ).join('\n')
  return new NextResponse(header + rows, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="sesiones_${new Date().toISOString().split('T')[0]}.csv"`,
    },
  })
}
