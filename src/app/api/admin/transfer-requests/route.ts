import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  // Auth ya validada por middleware (admin_token cookie)
  const { searchParams } = new URL(req.url)
  const status = searchParams.get('status') || 'pending'
  const page = parseInt(searchParams.get('page') || '1')
  const limit = 20
  const offset = (page - 1) * limit

  const db = supabaseAdmin()
  
  let query = db
    .from('transfer_requests')
    .select(`
      id, amount, currency, reference_number, receipt_url,
      status, admin_notes, reviewed_at, created_at,
      user:user_id (
        id,
        email
      )
    `, { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (status !== 'all') {
    query = query.eq('status', status)
  }

  const { data, error, count } = await query

  if (error) {
    console.error('[Admin TransferRequests] Error:', error)
    return NextResponse.json({ error: 'Failed to fetch transfer requests' }, { status: 500 })
  }

  return NextResponse.json({
    transfer_requests: data,
    total: count,
    page,
    pages: Math.ceil((count || 0) / limit)
  })
}
