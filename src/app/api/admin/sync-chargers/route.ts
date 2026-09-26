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

    // M-4: Pre-fetch ALL charger IDs from Supabase in ONE query (eliminates N+1)
    const { data: supabaseChargers } = await supabase.from('chargers').select('id')
    const chargerIdSet = new Set((supabaseChargers || []).map((c: any) => c.id))
    // Build normalized lookup: 'CHARGER001' -> 'CHARGER_001' (or exact match)
    const normalizedMap = new Map<string, string>()
    for (const c of supabaseChargers || []) {
      normalizedMap.set(c.id.replace(/_/g, ''), c.id)
    }

    // Resolve OCPP -> Supabase IDs without per-charger DB queries
    const resolved: Array<{ ocppId: string; resolvedId: string; status: string; lastHeartbeat: string | null; connectors: any[] }> = []
    const notFound: string[] = []

    for (const oc of ocppChargers) {
      const ocppId = oc.id
      const lastHeartbeatMs = oc.lastHeartbeat ? Date.now() - new Date(oc.lastHeartbeat).getTime() : Infinity
      const isOnline = lastHeartbeatMs < 300_000
      const status = isOnline ? 'Available' : 'Offline'

      let resolvedId: string | null = null
      if (chargerIdSet.has(ocppId)) {
        resolvedId = ocppId
      } else {
        const normalized = ocppId.replace(/_/g, '')
        if (normalizedMap.has(normalized)) {
          resolvedId = normalizedMap.get(normalized)!
          console.log(`[sync-chargers] ID mismatch: OCPP=${ocppId}, Supabase=${resolvedId}`)
        }
      }

      if (!resolvedId) {
        console.warn(`[sync-chargers] Charger ${ocppId} not found in Supabase`)
        notFound.push(ocppId)
        continue
      }

      resolved.push({ ocppId, resolvedId, status, lastHeartbeat: oc.lastHeartbeat || null, connectors: oc.connectors || [] })
    }

    // M-4: Batch update chargers in ONE upsert instead of N individual updates
    if (resolved.length > 0) {
      await supabase.from('chargers').upsert(
        resolved.map(r => ({
          id: r.resolvedId,
          status: r.status,
          last_heartbeat: r.lastHeartbeat,
        })),
        { onConflict: 'id' }
      )
    }

    // M-4: Batch upsert connectors
    const connectorRows: any[] = []
    for (const r of resolved) {
      const isOnline = r.status === 'Available'
      if (r.connectors.length > 0) {
        for (const conn of r.connectors) {
          connectorRows.push({
            charger_id: r.resolvedId,
            connector_id: conn.connectorId ?? conn.id ?? 1,
            status: conn.status || (isOnline ? 'Available' : 'Offline'),
            error_code: conn.errorCode || null,
            updated_at: new Date().toISOString(),
          })
        }
      } else {
        connectorRows.push({
          charger_id: r.resolvedId,
          connector_id: 1,
          status: r.status,
          updated_at: new Date().toISOString(),
        })
      }
    }

    if (connectorRows.length > 0) {
      await supabase.from('charger_connectors').upsert(connectorRows, { onConflict: 'charger_id,connector_id' })
    }

    const synced = [
      ...resolved.map(r => ({ id: r.resolvedId, ocppId: r.ocppId, status: r.status })),
      ...notFound.map(id => ({ id, status: 'not_registered' })),
    ]
    return NextResponse.json({ synced })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
