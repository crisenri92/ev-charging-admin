import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, supabaseAdmin } from '@/lib/api-helpers'

// GET /api/admin/chargers — list all chargers (server-side auth)
export async function GET() {
  try {
    await requireAuth()
  } catch (e) {
    return e as NextResponse
  }
  const db = supabaseAdmin()
  const { data, error } = await db
    .from('chargers')
    .select('*')
    .order('created_at', { ascending: false })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

// POST /api/admin/chargers — create a charger (server-side auth)
export async function POST(req: NextRequest) {
  try {
    await requireAuth()
  } catch (e) {
    return e as NextResponse
  }
  const body = await req.json()
  if (!body.id?.trim()) {
    return NextResponse.json({ error: 'id requerido' }, { status: 400 })
  }
  const db = supabaseAdmin()
  const { data, error } = await db
    .from('chargers')
    .insert({ id: body.id.trim(), status: body.status ?? 'Offline' })
    .select()
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
