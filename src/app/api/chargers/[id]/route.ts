import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

function parseLocation(input: string): { lat: number; lng: number } | null {
  const s = input.trim()
  // Google Maps URL with @lat,lng
  let m = s.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/)
  if (m) return { lat: parseFloat(m[1]), lng: parseFloat(m[2]) }
  // URL with ?q=lat,lng
  m = s.match(/[?&]q=(-?\d+\.\d+),(-?\d+\.\d+)/)
  if (m) return { lat: parseFloat(m[1]), lng: parseFloat(m[2]) }
  // Plain coordinates: -0.2295, -78.5243
  m = s.match(/^(-?\d+\.\d+)\s*,\s*(-?\d+\.\d+)$/)
  if (m) return { lat: parseFloat(m[1]), lng: parseFloat(m[2]) }
  return null
}

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const { location_input } = await request.json()
  const coords = parseLocation(location_input)
  if (!coords) {
    return NextResponse.json({ error: 'Formato inválido. Usa URL de Google Maps o coordenadas: -0.2295, -78.5243' }, { status: 400 })
  }
  const { error } = await supabase
    .from('chargers')
    .update({ latitude: coords.lat, longitude: coords.lng })
    .eq('id', params.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, lat: coords.lat, lng: coords.lng })
}
