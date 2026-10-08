import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export const runtime = 'nodejs'

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  // Auth ya validada por middleware
  const { id } = params
  const body = await req.json()
  const { action, admin_notes } = body // action: 'approve' | 'reject'

  if (!['approve', 'reject'].includes(action)) {
    return NextResponse.json({ error: 'action must be approve or reject' }, { status: 400 })
  }

  const db = supabaseAdmin()

  // Leer solicitud actual con lock optimista
  const { data: request, error: fetchError } = await db
    .from('transfer_requests')
    .select('*')
    .eq('id', id)
    .eq('status', 'pending') // Solo procesar si sigue pendiente
    .single()

  if (fetchError || !request) {
    return NextResponse.json({ 
      error: 'Transfer request not found or already processed' 
    }, { status: 404 })
  }

  if (action === 'approve') {
    // Leer balance actual
    const { data: walletData } = await db
      .from('user_balances')
      .select('balance')
      .eq('user_id', request.user_id)
      .single()

    const balanceBefore = walletData?.balance || 0
    const balanceAfter = balanceBefore + request.amount

    // Actualizar balance
    const { error: balanceError } = await db
      .from('user_balances')
      .upsert({
        user_id: request.user_id,
        balance: balanceAfter,
        currency: 'USD',
        updated_at: new Date().toISOString()
      }, { onConflict: 'user_id' })

    if (balanceError) {
      console.error('[TransferApprove] Balance update error:', balanceError)
      return NextResponse.json({ error: 'Failed to update balance' }, { status: 500 })
    }

    // Registrar transacción
    await db.from('balance_transactions').insert({
      user_id: request.user_id,
      amount: request.amount,
      type: 'transfer',
      description: `Transferencia bancaria aprobada - Ref: ${request.reference_number || id}`,
      balance_before: balanceBefore,
      balance_after: balanceAfter
    })

    // Marcar como aprobada
    await db
      .from('transfer_requests')
      .update({
        status: 'approved',
        admin_notes: admin_notes || null,
        reviewed_by_admin: true,
        reviewed_at: new Date().toISOString()
      })
      .eq('id', id)

    return NextResponse.json({ 
      success: true, 
      action: 'approved',
      balance_after: balanceAfter 
    })
  }

  if (action === 'reject') {
    const { error: rejectError } = await db
      .from('transfer_requests')
      .update({
        status: 'rejected',
        admin_notes: admin_notes || null,
        reviewed_by_admin: true,
        reviewed_at: new Date().toISOString()
      })
      .eq('id', id)

    if (rejectError) {
      return NextResponse.json({ error: 'Failed to reject transfer request' }, { status: 500 })
    }

    return NextResponse.json({ success: true, action: 'rejected' })
  }
}
