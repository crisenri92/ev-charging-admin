import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  // Auth: Bearer token del usuario móvil
  const authHeader = req.headers.get('authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const token = authHeader.substring(7)

  // Verificar token con Supabase
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
  const { data: { user }, error: authError } = await supabase.auth.getUser(token)
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json()
  const { amount, reference_number, receipt_url } = body

  if (!amount || typeof amount !== 'number' || amount <= 0 || amount > 10000) {
    return NextResponse.json({ error: 'Invalid amount. Must be between 0 and 10000 USD' }, { status: 400 })
  }

  if (!reference_number && !receipt_url) {
    return NextResponse.json({ error: 'Must provide reference_number or receipt_url' }, { status: 400 })
  }

  const db = supabaseAdmin()
  const { data, error } = await db
    .from('transfer_requests')
    .insert({
      user_id: user.id,
      amount,
      currency: 'USD',
      reference_number: reference_number || null,
      receipt_url: receipt_url || null,
      status: 'pending'
    })
    .select()
    .single()

  if (error) {
    console.error('[TransferRequest] Insert error:', error)
    return NextResponse.json({ error: 'Failed to create transfer request' }, { status: 500 })
  }

  return NextResponse.json({ success: true, transfer_request: data }, { status: 201 })
}

export async function GET(req: NextRequest) {
  // Auth: Bearer token del usuario móvil — lista sus propias solicitudes
  const authHeader = req.headers.get('authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const token = authHeader.substring(7)

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
  const { data: { user }, error: authError } = await supabase.auth.getUser(token)
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const db = supabaseAdmin()
  const { data, error } = await db
    .from('transfer_requests')
    .select('id, amount, currency, reference_number, status, admin_notes, created_at, updated_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(20)

  if (error) {
    return NextResponse.json({ error: 'Failed to fetch transfer requests' }, { status: 500 })
  }

  return NextResponse.json({ transfer_requests: data })
}
