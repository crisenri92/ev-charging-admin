import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

function parseLocation(input: string): { lat: number; lng: number } | null {
  const s = input.trim()
  let m = s.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/)
  if (m) return { lat: parseFloat(m[1]), lng: parseFloat(m[2]) }
  m = s.match(/[?&]q=(-?\d+\.\d+),(-?\d+\.\d+)/)
  if (m) return { lat: parseFloat(m[1]), lng: parseFloat(m[2]) }
  m = s.match(/^(-?\d+\.\d+)\s*,\s*(-?\d+\.\d+)$/)
  if (m) return { lat: parseFloat(m[1]), lng: parseFloat(m[2]) }
  return null
}

async function verifyAdmin(request: Request): Promise<boolean> {
  const adminToken = request.headers.get('x-admin-token')
  if (adminToken && adminToken === process.env.ADMIN_SECRET) return true
  const cookieStore = await cookies()
  const cookieToken = cookieStore.get('admin_token')?.value
  return cookieToken === process.env.ADMIN_SECRET
}

// PATCH: acepta { location } — usado desde el panel admin
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const isAdmin = await verifyAdmin(request)
  if (!isAdmin) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }
  const body = await request.json()
  const locationInput = body.location || body.location_input
  if (!locationInput) {
    return NextResponse.json({ error: 'Campo location requerido' }, { status: 400 })
  }
  const coords = parseLocation(locationInput)
  if (!coords) {
    return NextResponse.json({ error: 'Formato inv\u00e1lido. Usa URL de Google Maps o coordenadas: -0.2295, -78.5243' }, { status: 400 })
  }
  const { error } = await supabase
    .from('chargers')
    .update({ latitude: coords.lat, longitude: coords.lng })
    .eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, lat: coords.lat, lng: coords.lng })
}

// POST: mantiene compatibilidad con { location_input }
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const isAdmin = await verifyAdmin(request)
  if (!isAdmin) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }
  const { location_input } = await request.json()
  const coords = parseLocation(location_input)
  if (!coords) {
    return NextResponse.json({ error: 'Formato inv\u00e1lido. Usa URL de Google Maps o coordenadas: -0.2295, -78.5243' }, { status: 400 })
  }
  const { error } = await supabase
    .from('chargers')
    .update({ latitude: coords.lat, longitude: coords.lng })
    .eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, lat: coords.lat, lng: coords.lng })
}
