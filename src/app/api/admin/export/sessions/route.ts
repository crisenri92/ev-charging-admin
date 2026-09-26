import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

// M-8: Support date range filtering to avoid exporting unbounded data
export async function GET(req: NextRequest) {
  const token = req.cookies.get('admin_token')?.value
  if (!token) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const url = new URL(req.url)
  const from = url.searchParams.get('from')  // ISO date string
  const to = url.searchParams.get('to')      // ISO date string

  // M-8: Paginate to avoid silent truncation at 5000 rows
  const PAGE_SIZE = 1000
  const MAX_ROWS = 50_000
  let allSessions: any[] = []
  let page = 0
  let hasMore = true

  while (hasMore && allSessions.length < MAX_ROWS) {
    let query = supabase
      .from('charging_sessions')
      .select('id, user_id, charger_id, charger_name, status, started_at, ended_at, energy_kwh, cost, stop_reason')
      .order('started_at', { ascending: false })
      .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1)

    if (from) query = query.gte('started_at', from)
    if (to) query = query.lte('started_at', to)

    const { data, error } = await query
    if (error || !data?.length) { hasMore = false; break }
    allSessions.push(...data)
    hasMore = data.length === PAGE_SIZE
    page++
  }

  const truncated = allSessions.length >= MAX_ROWS
  const header = 'ID,Usuario,Cargador,Estado,Inicio,Fin,Energía kWh,Costo USD,Razón\n'
  const rows = allSessions.map(s =>
    `"${s.id}","${s.user_id}","${s.charger_name || s.charger_id}","${s.status}","${s.started_at || ''}","${s.ended_at || ''}","${s.energy_kwh ?? ''}","${s.cost ?? ''}","${s.stop_reason || ''}"`
  ).join('\n')

  const responseHeaders: Record<string, string> = {
    'Content-Type': 'text/csv; charset=utf-8',
    'Content-Disposition': `attachment; filename="sesiones_${new Date().toISOString().split('T')[0]}.csv"`,
  }
  if (truncated) {
    responseHeaders['X-Export-Truncated'] = 'true'
    responseHeaders['X-Export-Warning'] = `Results limited to ${MAX_ROWS} rows. Use ?from=&to= date filters to export specific ranges.`
  }

  return new NextResponse(header + rows, { headers: responseHeaders })
}
