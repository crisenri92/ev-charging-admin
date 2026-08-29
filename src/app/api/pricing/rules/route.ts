import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

const db = () => supabaseAdmin()

export async function GET() {
  const { data, error } = await db().from('pricing_rules').select('*').order('priority', { ascending: false })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(req: NextRequest) {
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
  const body = await req.json()
  const { id, ...updates } = body
  const { data, error } = await db().from('pricing_rules')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function DELETE(req: NextRequest) {
  const { id } = await req.json()
  const { error } = await db().from('pricing_rules').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
