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
    if (!res.ok) return NextResponse.json({ error: 'OCPP server error' }, { status: 502 })
    const ocppChargers = await res.json()

    const updates = await Promise.all(ocppChargers.map(async (oc: any) => {
      const ocppId = oc.id
      const lastHeartbeatMs = oc.lastHeartbeat ? Date.now() - new Date(oc.lastHeartbeat).getTime() : Infinity
      const isOnline = lastHeartbeatMs < 300_000
      const status = isOnline ? 'Available' : 'Offline'

      // Buscar por ID exacto primero; fallback a ID sin guiones bajos
      let { data: existing } = await supabase.from('chargers').select('id').eq('id', ocppId).single()
      let resolvedId = ocppId

      if (!existing) {
        const normalizedId = ocppId.replace(/_/g, '')
        const { data: fallback } = await supabase.from('chargers').select('id').eq('id', normalizedId).single()
        if (fallback) {
          console.log(`[sync-chargers] ID mismatch: OCPP=${ocppId}, Supabase=${normalizedId}`)
          existing = fallback
          resolvedId = normalizedId
        }
      }

      if (!existing) {
        console.warn(`[sync-chargers] Charger ${ocppId} not found in Supabase`)
        return { id: ocppId, status: 'not_registered' }
      }

      await supabase.from('chargers').update({
        status,
        last_heartbeat: oc.lastHeartbeat || null,
      }).eq('id', resolvedId)

      // Sync connectors
      if (oc.connectors && Array.isArray(oc.connectors)) {
        await Promise.all(oc.connectors.map(async (conn: any) => {
          await supabase.from('charger_connectors').upsert({
            charger_id: resolvedId,
            connector_id: conn.connectorId ?? conn.id ?? 1,
            status: conn.status || (isOnline ? 'Available' : 'Offline'),
            error_code: conn.errorCode || null,
            updated_at: new Date().toISOString(),
          }, { onConflict: 'charger_id,connector_id' })
        }))
      } else {
        await supabase.from('charger_connectors').upsert({
          charger_id: resolvedId,
          connector_id: 1,
          status,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'charger_id,connector_id' })
      }

      return { id: resolvedId, ocppId, status }
    }))

    return NextResponse.json({ synced: updates })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
