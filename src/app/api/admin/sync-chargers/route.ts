import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
const OCPP_URL = process.env.OCPP_SERVER_URL || 'https://ev-charging-csms-production.up.railway.app'

export async function GET(req: NextRequest) {
  try {
    const res = await fetch(`${OCPP_URL}/api/chargers`, { next: { revalidate: 0 } })
    if (!res.ok) return NextResponse.json({ error: 'OCPP server error' }, { status: 502 })
    const ocppChargers = await res.json()

    const updates = await Promise.all(ocppChargers.map(async (oc: any) => {
      const normalizedId = oc.id.replace(/_/g, '')
      const lastHeartbeatMs = oc.lastHeartbeat ? Date.now() - new Date(oc.lastHeartbeat).getTime() : Infinity
      const isOnline = lastHeartbeatMs < 300_000
      const status = isOnline ? 'Available' : 'Offline'

      await supabase.from('chargers').update({
        status,
        last_heartbeat: oc.lastHeartbeat || null,
      }).eq('id', normalizedId)

      // Sync connectors if OCPP provides them
      if (oc.connectors && Array.isArray(oc.connectors)) {
        await Promise.all(oc.connectors.map(async (conn: any) => {
          await supabase.from('charger_connectors').upsert({
            charger_id: normalizedId,
            connector_id: conn.connectorId ?? conn.id ?? 1,
            status: conn.status || (isOnline ? 'Available' : 'Offline'),
            error_code: conn.errorCode || null,
            updated_at: new Date().toISOString(),
          }, { onConflict: 'charger_id,connector_id' })
        }))
      } else {
        // Default: assume 1 connector
        await supabase.from('charger_connectors').upsert({
          charger_id: normalizedId,
          connector_id: 1,
          status,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'charger_id,connector_id' })
      }

      return { id: normalizedId, status }
    }))

    return NextResponse.json({ synced: updates })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
