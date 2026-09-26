import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

// M-8: Support date range filtering and paginate to avoid silent truncation
export async function GET(req: NextRequest) {
  const token = req.cookies.get('admin_token')?.value
  if (!token) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const url = new URL(req.url)
  const from = url.searchParams.get('from')
  const to = url.searchParams.get('to')

  const PAGE_SIZE = 1000
  const MAX_ROWS = 50_000
  let allTxns: any[] = []
  let page = 0
  let hasMore = true

  while (hasMore && allTxns.length < MAX_ROWS) {
    let query = supabase
      .from('balance_transactions')
      .select('id, user_id, amount, type, description, balance_after, created_at, reference_id')
      .order('created_at', { ascending: false })
      .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1)

    if (from) query = query.gte('created_at', from)
    if (to) query = query.lte('created_at', to)

    const { data, error } = await query
    if (error || !data?.length) { hasMore = false; break }
    allTxns.push(...data)
    hasMore = data.length === PAGE_SIZE
    page++
  }

  const truncated = allTxns.length >= MAX_ROWS
  const header = 'ID,Usuario,Monto,Tipo,Descripción,Saldo después,Fecha,Referencia\n'
  const rows = allTxns.map(t =>
    `"${t.id}","${t.user_id}","${t.amount}","${t.type}","${t.description || ''}","${t.balance_after ?? ''}","${t.created_at}","${t.reference_id || ''}"`
  ).join('\n')

  const responseHeaders: Record<string, string> = {
    'Content-Type': 'text/csv; charset=utf-8',
    'Content-Disposition': `attachment; filename="pagos_${new Date().toISOString().split('T')[0]}.csv"`,
  }
  if (truncated) {
    responseHeaders['X-Export-Truncated'] = 'true'
    responseHeaders['X-Export-Warning'] = `Results limited to ${MAX_ROWS} rows. Use ?from=&to= date filters to export specific ranges.`
  }

  return new NextResponse(header + rows, { headers: responseHeaders })
}
