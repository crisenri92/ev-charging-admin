import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

export async function GET(req: NextRequest) {
  const token = req.cookies.get('admin_token')?.value
  if (!token) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  const { data: txns } = await supabase
    .from('balance_transactions')
    .select('id, user_id, amount, type, description, balance_after, created_at, reference_id')
    .order('created_at', { ascending: false })
    .limit(5000)
  if (!txns) return NextResponse.json({ error: 'Error' }, { status: 500 })
  const header = 'ID,Usuario,Monto,Tipo,Descripción,Saldo después,Fecha,Referencia\n'
  const rows = txns.map(t =>
    `"${t.id}","${t.user_id}","${t.amount}","${t.type}","${t.description || ''}","${t.balance_after ?? ''}","${t.created_at}","${t.reference_id || ''}"`
  ).join('\n')
  return new NextResponse(header + rows, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="pagos_${new Date().toISOString().split('T')[0]}.csv"`,
    },
  })
}
