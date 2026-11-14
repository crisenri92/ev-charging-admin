/**
 * GET /api/admin/cron/stop-expired
 * Cierra automáticamente sesiones de carga que han expirado.
 * Llamado por Railway Cron cada minuto.
 * Protegido por CRON_SECRET en env (opcional).
 *
 * Configura en Railway: Cron Job -> GET https://recargat.app/api/admin/cron/stop-expired
 * Header: Authorization: Bearer <CRON_SECRET>
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function supabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

async function sendRemoteStop(
  chargerId: string,
  supabase: ReturnType<typeof supabaseAdmin>
): Promise<void> {
  const ocppServerUrl = process.env.OCPP_SERVER_URL
  if (!ocppServerUrl) return

  try {
    let csmsChargerId = chargerId
    let transactionId: number | null = null

    // 1. Intentar obtener transactionId del estado en memoria del CSMS
    const chargerRes = await fetch(`${ocppServerUrl}/api/chargers`, {
      headers: { Authorization: `Bearer ${process.env.OCPP_API_SECRET || 'ev-admin-2024'}` },
    })
    if (chargerRes.ok) {
      const chargers = await chargerRes.json()
      const csmsCharger = chargers.find(
        (c: any) =>
          c.id === chargerId ||
          c.id.replace(/_/g, '') === chargerId.replace(/_/g, '')
      )
      if (csmsCharger) {
        csmsChargerId = csmsCharger.id
        transactionId = csmsCharger.activeSession?.transactionId ?? null
      }
    }

    // 2. Fallback: buscar en tabla sessions de Supabase
    if (!transactionId) {
      const { data: csmsSession } = await supabase
        .from('sessions')
        .select('transaction_id, charger_id')
        .eq('status', 'Active')
        .or(`charger_id.eq.${chargerId},charger_id.eq.${chargerId.replace(/_/g, '')}`)
        .order('start_time', { ascending: false })
        .limit(1)
        .single()

      if (csmsSession?.transaction_id) {
        transactionId = csmsSession.transaction_id
        csmsChargerId = csmsSession.charger_id
      }
    }

    // Si no hay transactionId, intentar con 0 (best-effort)
    if (!transactionId) transactionId = 0

    await fetch(`${ocppServerUrl}/api/admin/chargers/${csmsChargerId}/remote-stop`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.OCPP_API_SECRET || 'ev-admin-2024'}`,
      },
      body: JSON.stringify({ transactionId }),
    })
  } catch (e: any) {
    console.warn(`[stop-expired] RemoteStop fallido para ${chargerId}:`, e.message)
  }
}

export async function GET(req: NextRequest) {
  // Verificar autorización si CRON_SECRET está configurado
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret) {
    const authHeader = req.headers.get('authorization')
    const secretParam = new URL(req.url).searchParams.get('secret')
    if (authHeader !== `Bearer ${cronSecret}` && secretParam !== cronSecret) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

  const supabase = supabaseAdmin()
  const now = new Date().toISOString()

  // Buscar sesiones activas que ya expiraron
  const { data: expiredSessions, error } = await supabase
    .from('charging_sessions')
    .select('id, charger_id, user_id, expires_at')
    .eq('status', 'active')
    .is('ended_at', null)
    .not('expires_at', 'is', null)
    .lte('expires_at', now)

  if (error) {
    console.error('[stop-expired] Error buscando sesiones:', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  if (!expiredSessions || expiredSessions.length === 0) {
    return NextResponse.json({ stopped: 0, message: 'No hay sesiones expiradas' })
  }

  console.log(`[stop-expired] Encontradas ${expiredSessions.length} sesiones expiradas`)

  const results: { id: string; charger_id: string; status: string }[] = []

  for (const session of expiredSessions) {
    try {
      // 1. Enviar RemoteStopTransaction al cargador físico
      await sendRemoteStop(session.charger_id, supabase)

      // 2. Cerrar sesión en DB
      await supabase
        .from('charging_sessions')
        .update({
          status: 'completed',
          ended_at: now,
        })
        .eq('id', session.id)

      // 3. Restaurar estado del cargador
      await supabase
        .from('chargers')
        .update({ status: 'Available' })
        .eq('id', session.charger_id)

      results.push({ id: session.id, charger_id: session.charger_id, status: 'stopped' })
      console.log(`[stop-expired] Sesión ${session.id} (${session.charger_id}) cerrada automáticamente`)
    } catch (e: any) {
      console.error(`[stop-expired] Error cerrando sesión ${session.id}:`, e.message)
      results.push({ id: session.id, charger_id: session.charger_id, status: 'error' })
    }
  }

  return NextResponse.json({
    stopped: results.filter(r => r.status === 'stopped').length,
    results,
  })
}
