import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

const db = () => supabaseAdmin()

export async function GET() {
  const { data } = await db().from('vouchers')
    .select('id, code, description, amount, max_uses, uses_count, active, expires_at, created_at')
    .order('created_at', { ascending: false })
  return NextResponse.json(data || [])
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { data, error } = await db().from('vouchers').insert({
    code: body.code.trim().toUpperCase(),
    description: body.description || null,
    amount: body.amount,
    max_uses: body.max_uses ?? 1,
    active: body.active ?? true,
    expires_at: body.expires_at || null,
  }).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function PATCH(req: NextRequest) {
  const { id, ...updates } = await req.json()
  const { data, error } = await db().from('vouchers').update(updates).eq('id', id).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function DELETE(req: NextRequest) {
  const { id } = await req.json()
  const { error } = await db().from('vouchers').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
