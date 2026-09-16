import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
const OCPP_URL = process.env.OCPP_SERVER_URL || 'https://ev-charging-csms-production.up.railway.app'

async function verifyAdmin(req: NextRequest): Promise<boolean> {
  const headerToken = req.headers.get('x-admin-token')
  if (headerToken && headerToken === process.env.ADMIN_SECRET) return true
  const { cookies } = await import('next/headers')
  const cookieStore = await cookies()
  const cookieToken = cookieStore.get('admin_token')?.value
  return cookieToken === process.env.ADMIN_SECRET
}

export async function GET(req: NextRequest) {
  if (!(await verifyAdmin(req))) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }
  try {
    const res = await fetch(`${OCPP_URL}/api/chargers`, { next: { revalidate: 0 } })
    if (!res.ok) return NextResponse.json({ error: 'Error del servidor OCPP' }, { status: 502 })
    const ocppChargers = await res.json()

    const updates = await Promise.all(ocppChargers.map(async (charger: any) => {
      // Use the ID as-is from OCPP — no normalization
      const ocppId = charger.id
      const lastHeartbeatMs = charger.lastHeartbeat ? Date.now() - new Date(charger.lastHeartbeat).getTime() : Infinity
      const isOnline = lastHeartbeatMs < 300_000 // 5 minutes
      const status = isOnline ? 'Available' : 'Offline'

      // Try exact match first
      let { data: existing } = await supabase
        .from('chargers')
        .select('id')
        .eq('id', ocppId)
        .single()

      // Fallback: try without underscores (legacy IDs)
      if (!existing) {
        const normalizedId = ocppId.replace(/_/g, '')
        const { data: fallback } = await supabase
          .from('chargers')
          .select('id')
          .eq('id', normalizedId)
          .single()
        if (fallback) {
          console.log(`[sync-chargers] ID mismatch: OCPP=${ocppId}, Supabase=${normalizedId}. Consider registering with the same ID.`)
          existing = fallback
        }
      }

      if (!existing) {
        console.warn(`[sync-chargers] Charger ${ocppId} not found in Supabase — register it first`)
        return { id: ocppId, status: 'not_registered' }
      }

      await supabase
        .from('chargers')
        .update({
          status,
          last_heartbeat: charger.lastHeartbeat || null,
        })
        .eq('id', existing.id)

      // Sync connectors
      if (charger.connectors && Array.isArray(charger.connectors)) {
        await Promise.all(charger.connectors.map(async (conn: any) => {
          await supabase
            .from('charger_connectors')
            .upsert({
              charger_id: existing!.id,
              connector_id: conn.connectorId ?? conn.id ?? 1,
              status: conn.status || (isOnline ? 'Available' : 'Offline'),
              error_code: conn.errorCode || null,
              updated_at: new Date().toISOString(),
            }, { onConflict: 'charger_id,connector_id' })
        }))
      } else {
        await supabase
          .from('charger_connectors')
          .upsert({
            charger_id: existing.id,
            connector_id: 1,
            status,
            updated_at: new Date().toISOString(),
          }, { onConflict: 'charger_id,connector_id' })
      }

      return { id: existing.id, status }
    }))

    return NextResponse.json({ synced: updates })
  } catch (err: any) {
    console.error('[sync-chargers] Error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
