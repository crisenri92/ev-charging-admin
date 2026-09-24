import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

export async function POST(req: NextRequest) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '').trim()
  if (!token) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  const { data: { user } } = await db.auth.getUser(token)
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const { code } = await req.json()
  if (!code?.trim()) return NextResponse.json({ error: 'Código requerido' }, { status: 400 })

  const { data: voucher } = await db.from('vouchers')
    .select('*').eq('code', code.trim().toUpperCase()).eq('active', true).single()

  if (!voucher) return NextResponse.json({ error: 'Código inválido o expirado' }, { status: 404 })
  if (voucher.expires_at && new Date(voucher.expires_at) < new Date()) {
    return NextResponse.json({ error: 'Este código ha expirado' }, { status: 410 })
  }
  if (voucher.max_uses > 0 && voucher.uses_count >= voucher.max_uses) {
    return NextResponse.json({ error: 'Código agotado' }, { status: 410 })
  }

  // FIX C-1: Atomic guard against race conditions (double-tap / concurrent requests).
  // INSERT with ON CONFLICT DO NOTHING — the UNIQUE(voucher_id, user_id) constraint
  // ensures only one request wins, even if two arrive simultaneously.
  // ignoreDuplicates:true generates: INSERT ... ON CONFLICT (voucher_id,user_id) DO NOTHING
  const { data: inserted, error: insertError } = await db
    .from('voucher_redemptions')
    .upsert(
      { voucher_id: voucher.id, user_id: user.id, amount: Number(voucher.amount) },
      { onConflict: 'voucher_id,user_id', ignoreDuplicates: true }
    )
    .select()

  if (insertError) {
    return NextResponse.json({ error: 'Error interno al registrar canje' }, { status: 500 })
  }

  if (!inserted || inserted.length === 0) {
    // Unique constraint fired: this user already redeemed this voucher
    return NextResponse.json({ error: 'Ya canjeaste este código' }, { status: 409 })
  }

  // INSERT succeeded — safe to credit balance (only one request reaches here per user+voucher)
  const { data: balanceRow } = await db.from('user_balances').select('balance').eq('user_id', user.id).single()
  const currentBalance = balanceRow?.balance || 0
  const newBalance = parseFloat((currentBalance + Number(voucher.amount)).toFixed(2))

  await db.from('user_balances').upsert({ user_id: user.id, balance: newBalance }, { onConflict: 'user_id' })
  await db.from('balance_transactions').insert({
    user_id: user.id, amount: Number(voucher.amount), type: 'voucher',
    description: `Voucher canjeado: ${voucher.code}${voucher.description ? ' — ' + voucher.description : ''}`,
    balance_after: newBalance, reference_id: voucher.id,
  })
  await db.from('vouchers').update({ uses_count: voucher.uses_count + 1 }).eq('id', voucher.id)

  return NextResponse.json({ ok: true, amount: Number(voucher.amount), newBalance, description: voucher.description })
}
