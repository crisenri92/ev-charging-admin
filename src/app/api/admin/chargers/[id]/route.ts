import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, supabaseAdmin } from '@/lib/api-helpers'

// PATCH /api/admin/chargers/[id] - update a charger (server-side auth)
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAuth()
  } catch (e) {
    return e as NextResponse
  }
  const { id } = await params
  const body = await req.json()
  const allowed = ['name', 'price_per_kwh', 'status', 'firmware', 'serial_number']
  const patch = Object.fromEntries(
    Object.entries(body).filter(([k]) => allowed.includes(k))
  )
  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: 'Sin campos validos para actualizar' }, { status: 400 })
  }
  const db = supabaseAdmin()
  const { data, error } = await db
    .from('chargers')
    .update(patch)
    .eq('id', id)
    .select()
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

// DELETE /api/admin/chargers/[id] - delete a charger (server-side auth)
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAuth()
  } catch (e) {
    return e as NextResponse
  }
  const { id } = await params
  const db = supabaseAdmin()

  // M-6: Prevent deleting charger with active charging sessions
  const { data: activeSessions } = await db
    .from('charging_sessions')
    .select('id')
    .eq('charger_id', id)
    .is('ended_at', null)
    .limit(1)

  if (activeSessions && activeSessions.length > 0) {
    return NextResponse.json(
      { error: 'No se puede eliminar un cargador con sesiones de carga activas' },
      { status: 409 }
    )
  }

  const { error } = await db.from('chargers').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
