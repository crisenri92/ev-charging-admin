import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { createClient } from '@supabase/supabase-js'
import { analyzeReceipt } from '@/lib/analyze-receipt'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  // Auth: Bearer token del usuario móvil
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

  const body = await req.json()
  const { amount, reference_number, receipt_url } = body

  if (!amount || typeof amount !== 'number' || amount <= 0 || amount > 10000) {
    return NextResponse.json({ error: 'Invalid amount. Must be between 0 and 10000 USD' }, { status: 400 })
  }
  if (!reference_number && !receipt_url) {
    return NextResponse.json({ error: 'Must provide reference_number or receipt_url' }, { status: 400 })
  }

  const db = supabaseAdmin()

  // Create the transfer request as pending initially
  const { data: tr, error: insertErr } = await db
    .from('transfer_requests')
    .insert({
      user_id: user.id,
      amount,
      currency: 'USD',
      reference_number: reference_number || null,
      receipt_url: receipt_url || null,
      status: 'pending',
    })
    .select()
    .single()

  if (insertErr) {
    console.error('[TransferRequest] Insert error:', insertErr)
    return NextResponse.json({ error: 'Failed to create transfer request' }, { status: 500 })
  }

  // Auto-analyze receipt if provided
  let analysis = null
  if (receipt_url) {
    try {
      analysis = await analyzeReceipt(receipt_url, amount)
      console.log(`[TransferRequest] Análisis IA: ${analysis.auto_decision} (confidence: ${analysis.confidence})`)

      // Apply automatic decision
      if (analysis.auto_decision === 'approved') {
        // Credit the balance
        const { data: current } = await db
          .from('user_balances')
          .select('balance')
          .eq('user_id', user.id)
          .single()

        const balanceBefore = Number(current?.balance ?? 0)
        const balanceAfter = parseFloat((balanceBefore + amount).toFixed(2))

        await db.from('user_balances').upsert(
          { user_id: user.id, balance: balanceAfter, currency: 'USD', updated_at: new Date().toISOString() },
          { onConflict: 'user_id' }
        )
        await db.from('balance_transactions').insert({
          user_id: user.id,
          amount,
          type: 'transfer',
          description: `Transferencia aprobada automáticamente — banco: ${analysis.bank_detected || 'N/A'}`,
          balance_before: balanceBefore,
          balance_after: balanceAfter,
        })

        await db
          .from('transfer_requests')
          .update({
            status: 'approved',
            admin_notes: `Auto-aprobado por IA. Banco: ${analysis.bank_detected || 'N/A'}. Confianza: ${Math.round(analysis.confidence * 100)}%. ${analysis.reason}`,
            updated_at: new Date().toISOString(),
          })
          .eq('id', tr.id)

      } else if (analysis.auto_decision === 'rejected') {
        await db
          .from('transfer_requests')
          .update({
            status: 'rejected',
            admin_notes: `Auto-rechazado por IA. Razón: ${analysis.reason}`,
            updated_at: new Date().toISOString(),
          })
          .eq('id', tr.id)
      }
      // If 'pending', leave as is for manual admin review

    } catch (analysisErr: any) {
      // If analysis fails, keep request as pending for manual review
      console.error('[TransferRequest] Error en análisis IA:', analysisErr.message)
    }
  }

  // Return result
  const finalStatus = analysis?.auto_decision === 'approved' ? 'approved'
    : analysis?.auto_decision === 'rejected' ? 'rejected'
    : 'pending'

  return NextResponse.json({
    success: true,
    transfer_request: { ...tr, status: finalStatus },
    analysis: analysis ? {
      auto_decision: analysis.auto_decision,
      confidence: analysis.confidence,
      bank_detected: analysis.bank_detected,
      reason: analysis.reason,
    } : null,
  }, { status: 201 })
}

export async function GET(req: NextRequest) {
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
