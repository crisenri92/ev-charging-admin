import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { supabaseAdmin } from '@/lib/supabase'

const db = () => supabaseAdmin()

async function verifyAdmin(req: NextRequest): Promise<boolean> {
  const headerToken = req.headers.get('x-admin-token')
  if (headerToken && headerToken === process.env.ADMIN_SECRET) return true
  const cookieStore = await cookies()
  const cookieToken = cookieStore.get('admin_token')?.value
  return cookieToken === process.env.ADMIN_SECRET
}

export async function GET(req: NextRequest) {
  if (!(await verifyAdmin(req))) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  const { data } = await db().from('vouchers')
    .select('id, code, description, amount, max_uses, uses_count, active, expires_at, created_at')
    .order('created_at', { ascending: false })
  return NextResponse.json(data || [])
}

export async function POST(req: NextRequest) {
  if (!(await verifyAdmin(req))) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
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
  if (!(await verifyAdmin(req))) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  const { id, ...updates } = await req.json()
  const { data, error } = await db().from('vouchers').update(updates).eq('id', id).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function DELETE(req: NextRequest) {
  if (!(await verifyAdmin(req))) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  const { id } = await req.json()
  const { error } = await db().from('vouchers').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
