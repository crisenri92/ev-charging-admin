import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const OCPP_URL = 'https://ev-charging-csms-production.up.railway.app/api/chargers'

export async function GET() {
  try {
    const res = await fetch(OCPP_URL, { next: { revalidate: 0 } })
    if (!res.ok) return NextResponse.json({ error: 'OCPP server unreachable' }, { status: 502 })

    const ocppChargers: any[] = await res.json()

    const updates = await Promise.all(ocppChargers.map(async (oc) => {
      // Normalize ID: CHARGER_001 → CHARGER001
      const normalId = oc.id.replace(/_/g, '')

      // Determine status
      const now = Date.now()
      const lastHb = oc.lastHeartbeat ? new Date(oc.lastHeartbeat).getTime() : 0
      const sinceHb = (now - lastHb) / 1000 // seconds
      // If heartbeat received within last 5 minutes → treat as Available (unless charger says otherwise)
      const effectiveStatus = sinceHb < 300 && oc.status !== 'Faulted' ? 'Available' : (oc.status || 'Offline')

      const { error } = await supabase.from('chargers').update({
        status: effectiveStatus,
        last_heartbeat: oc.lastHeartbeat || null,
      }).eq('id', normalId)

      return { id: normalId, ocppId: oc.id, status: effectiveStatus, error: error?.message }
    }))

    return NextResponse.json({ synced: updates })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
