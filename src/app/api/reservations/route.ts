import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

function getToken(req: NextRequest) {
  return req.headers.get('authorization')?.replace('Bearer ', '').trim() || null
}

// GET: active reservations for a charger or for the user
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const chargerId = searchParams.get('chargerId')
  const token = getToken(req)

  // Expire old reservations first
  await db.from('charger_reservations')
    .update({ status: 'expired' })
    .eq('status', 'active')
    .lt('expires_at', new Date().toISOString())

  if (chargerId) {
    const { data } = await db.from('charger_reservations')
      .select('id, user_id, charger_id, charger_name, status, reserved_at, expires_at, duration_minutes')
      .eq('charger_id', chargerId)
      .eq('status', 'active')
      .gt('expires_at', new Date().toISOString())
      .limit(1)
    return NextResponse.json(data?.[0] || null)
  }

  if (token) {
    const { data: { user } } = await db.auth.getUser(token)
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    const { data } = await db.from('charger_reservations')
      .select('*')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .gt('expires_at', new Date().toISOString())
      .order('expires_at', { ascending: true })
    return NextResponse.json(data || [])
  }

  return NextResponse.json([])
}

// POST: create reservation
export async function POST(req: NextRequest) {
  const token = getToken(req)
  if (!token) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  const { data: { user } } = await db.auth.getUser(token)
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const { chargerId, durationMinutes = 30 } = await req.json()
  if (!chargerId) return NextResponse.json({ error: 'chargerId requerido' }, { status: 400 })

  // Check charger exists and is available
  const { data: charger } = await db.from('chargers').select('id, name, status').eq('id', chargerId).single()
  if (!charger) return NextResponse.json({ error: 'Cargador no encontrado' }, { status: 404 })
  if ((charger.status || '').toLowerCase() !== 'available') {
    return NextResponse.json({ error: 'Cargador no disponible' }, { status: 409 })
  }

  // Check if charger already has an active reservation
  await db.from('charger_reservations').update({ status: 'expired' })
    .eq('status', 'active').lt('expires_at', new Date().toISOString())

  const { data: existing } = await db.from('charger_reservations')
    .select('id, user_id').eq('charger_id', chargerId).eq('status', 'active')
    .gt('expires_at', new Date().toISOString()).limit(1)

  if (existing && existing.length > 0) {
    if (existing[0].user_id === user.id) return NextResponse.json({ error: 'Ya tienes una reserva activa en este cargador' }, { status: 409 })
    return NextResponse.json({ error: 'Este cargador ya está reservado' }, { status: 409 })
  }

  // Check user doesn't have another active reservation
  const { data: userRes } = await db.from('charger_reservations')
    .select('id').eq('user_id', user.id).eq('status', 'active')
    .gt('expires_at', new Date().toISOString()).limit(1)
  if (userRes && userRes.length > 0) {
    return NextResponse.json({ error: 'Ya tienes una reserva activa. Cancélala primero.' }, { status: 409 })
  }

  const now = new Date()
  const expiresAt = new Date(now.getTime() + durationMinutes * 60 * 1000)

  const { data: reservation, error } = await db.from('charger_reservations').insert({
    user_id: user.id,
    charger_id: chargerId,
    charger_name: charger.name || chargerId,
    status: 'active',
    reserved_at: now.toISOString(),
    expires_at: expiresAt.toISOString(),
    duration_minutes: durationMinutes,
  }).select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(reservation)
}

// DELETE: cancel reservation
export async function DELETE(req: NextRequest) {
  const token = getToken(req)
  if (!token) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  const { data: { user } } = await db.auth.getUser(token)
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const { id } = await req.json()
  const { error } = await db.from('charger_reservations')
    .update({ status: 'cancelled' })
    .eq('id', id)
    .eq('user_id', user.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
