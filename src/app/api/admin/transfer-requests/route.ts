import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

function requireAdmin(req: NextRequest): boolean {
  const token = req.cookies.get('admin_token')?.value
  const secret = process.env.ADMIN_SECRET || 'ev-admin-secret-2024'
  return !!token && token === secret
}

// GET — list all transfer requests (admin view)
export async function GET(req: NextRequest) {
  if (!requireAdmin(req)) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const status = searchParams.get('status') // optional filter: pending, approved, rejected

  let query = supabase
    .from('transfer_requests')
    .select('id, user_id, amount, currency, reference_number, receipt_url, status, admin_notes, created_at, updated_at')
    .order('created_at', { ascending: false })
    .limit(100)

  if (status) query = query.eq('status', status)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ transfer_requests: data })
}

// PATCH — approve or reject a transfer request
export async function PATCH(req: NextRequest) {
  if (!requireAdmin(req)) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  try {
    const { id, status, admin_notes } = await req.json()

    if (!id || !status) {
      return NextResponse.json({ error: 'id y status son requeridos' }, { status: 400 })
    }
    if (status !== 'approved' && status !== 'rejected') {
      return NextResponse.json({ error: 'status debe ser approved o rejected' }, { status: 400 })
    }

    // Get the transfer request
    const { data: tr, error: fetchErr } = await supabase
      .from('transfer_requests')
      .select('*')
      .eq('id', id)
      .single()

    if (fetchErr || !tr) {
      return NextResponse.json({ error: 'Solicitud no encontrada' }, { status: 404 })
    }
    if (tr.status !== 'pending') {
      return NextResponse.json({ error: `La solicitud ya fue ${tr.status}` }, { status: 409 })
    }

    // Update the transfer request status
    const { error: updateErr } = await supabase
      .from('transfer_requests')
      .update({ status, admin_notes: admin_notes || null, updated_at: new Date().toISOString() })
      .eq('id', id)

    if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 })

    // If approved, credit the balance
    if (status === 'approved') {
      const amount = Number(tr.amount)
      const userId = tr.user_id

      const { data: current } = await supabase
        .from('user_balances')
        .select('balance')
        .eq('user_id', userId)
        .single()

      const balanceBefore = Number(current?.balance ?? 0)
      const balanceAfter = parseFloat((balanceBefore + amount).toFixed(2))

      const { error: balErr } = await supabase.from('user_balances').upsert(
        { user_id: userId, balance: balanceAfter, currency: tr.currency || 'USD', updated_at: new Date().toISOString() },
        { onConflict: 'user_id' }
      )
      if (balErr) return NextResponse.json({ error: 'Error acreditando saldo: ' + balErr.message }, { status: 500 })

      await supabase.from('balance_transactions').insert({
        user_id: userId,
        amount,
        type: 'transfer',
        description: `Transferencia aprobada — ref: ${tr.reference_number || tr.id}`,
        balance_before: balanceBefore,
        balance_after: balanceAfter,
      })
    }

    return NextResponse.json({ ok: true, status, id })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
