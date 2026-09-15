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

export async function GET() {
  const { data, error } = await db().from('pricing_rules').select('*').order('priority', { ascending: false })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(req: NextRequest) {
  if (!(await verifyAdmin(req))) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  const body = await req.json()
  const { data, error } = await db().from('pricing_rules').insert({
    name: body.name,
    price_per_kwh: body.price_per_kwh,
    start_hour: body.start_hour,
    end_hour: body.end_hour,
    days_of_week: body.days_of_week || [0,1,2,3,4,5,6],
    priority: body.priority || 0,
    active: body.active ?? true,
  }).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function PATCH(req: NextRequest) {
  if (!(await verifyAdmin(req))) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  const body = await req.json()
  const { id, ...updates } = body
  const { data, error } = await db().from('pricing_rules')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function DELETE(req: NextRequest) {
  if (!(await verifyAdmin(req))) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  const { id } = await req.json()
  const { error } = await db().from('pricing_rules').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
