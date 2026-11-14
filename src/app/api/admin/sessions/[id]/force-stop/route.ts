import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { logAuditEvent } from '@/lib/audit-log'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function requireAdminUser(req: NextRequest) {
  const token =
    req.headers.get('authorization')?.replace('Bearer ', '') ??
    req.cookies.get('sb-access-token')?.value ??
    ''
  if (!token) return null
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser(token)
  if (error || !user) return null
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()
  return profile?.role === 'admin' ? user : null
}

/** EnvÃ­a RemoteStopTransaction al CSMS. Best-effort, no lanza si falla. */
async function sendRemoteStop(chargerId: string): Promise<void> {
  const ocppServerUrl = process.env.OCPP_SERVER_URL
  if (!ocppServerUrl) return
  try {
    let csmsChargerId = chargerId
    let transactionId: number | null = null

    // Step 1: obtener transactionId desde el estado en memoria del CSMS
    const chargerRes = await fetch(`${ocppServerUrl}/api/chargers`, {
      headers: { Authorization: `Bearer ${process.env.OCPP_API_SECRET || 'ev-admin-2024'}` },
    })
    if (chargerRes.ok) {
      const chargers: Array<{ id: string; activeSession: { transactionId: number } | null }> =
        await chargerRes.json()
      const csmsCharger = chargers.find(
        (c) =>
          c.id === chargerId ||
          c.id.replace(/_/g, '') === chargerId.replace(/_/g, '')
      )
      if (csmsCharger) {
        csmsChargerId = csmsCharger.id
        transactionId = csmsCharger.activeSession?.transactionId ?? null
      }
    }

    // Step 2: fallback â buscar transactionId en tabla sessions del CSMS
    if (!transactionId) {
      const { data: csmsSession } = await supabase
        .from('sessions')
        .select('transaction_id, charger_id')
        .eq('status', 'Active')
        .or(
          `charger_id.eq.${chargerId},charger_id.eq.${chargerId.replace(/_/g, '')}`
        )
        .order('start_time', { ascending: false })
        .limit(1)
        .single()
      if (csmsSession?.transaction_id) {
        transactionId = csmsSession.transaction_id
        csmsChargerId = csmsSession.charger_id
      }
    }

    if (!transactionId) return // sin transacciÃ³n activa â nada que detener

    await fetch(
      `${ocppServerUrl}/api/admin/chargers/${csmsChargerId}/remote-stop`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${process.env.OCPP_API_SECRET || 'ev-admin-2024'}`,
        },
        body: JSON.stringify({ transactionId }),
      }
    )
  } catch {
    /* best-effort: no bloquear el force-stop si el CSMS falla */
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const adminUser = await requireAdminUser(req)
  if (!adminUser)
    return NextResponse.json({ error: 'Se requiere rol admin' }, { status: 403 })

  const { id } = params

  // Fetch session to validate state and get balance/charger data
  const { data: session, error: fetchError } = await supabase
    .from('charging_sessions')
    .select('user_id, charger_id, amount_charged, ended_at')
    .eq('id', id)
    .single()

  if (fetchError || !session) {
    return NextResponse.json({ error: 'SesiÃ³n no encontrada' }, { status: 404 })
  }

  if (session.ended_at) {
    return NextResponse.json({ error: 'La sesiÃ³n ya estÃ¡ cerrada' }, { status: 409 })
  }

  // Force-stop: mark session as ended in DB
  const { error: updateError } = await supabase
    .from('charging_sessions')
    .update({ ended_at: new Date().toISOString(), status: 'completed' })
    .eq('id', id)

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 })
  }

  // Restore charger status to Available
  if (session.charger_id) {
    await supabase
      .from('chargers')
      .update({ status: 'Available' })
      .eq('id', session.charger_id)
  }

  // Send OCPP RemoteStopTransaction to physical charger (best-effort)
  if (session.charger_id) {
    await sendRemoteStop(session.charger_id)
  }

  // Restore wallet balance if a charge was deducted
  const amountToRestore = Number(session.amount_charged ?? 0)
  if (amountToRestore > 0 && session.user_id) {
    const { data: existing } = await supabase
      .from('user_balances')
      .select('balance')
      .eq('user_id', session.user_id)
      .single()
    const currentBalance = Number(existing?.balance ?? 0)
    const newBalance = currentBalance + amountToRestore
    await supabase.from('user_balances').upsert(
      {
        user_id: session.user_id,
        balance: newBalance,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id' }
    )
  }

  // Log the forced stop for audit trail
  logAuditEvent(
    adminUser.id,
    'charging.stop',
    'charging_session',
    id,
    {
      forced: true,
      admin_id: adminUser.id,
      balance_restored: amountToRestore,
    }
  )

  return NextResponse.json({
    success: true,
    message: 'SesiÃ³n cerrada forzosamente, saldo restaurado y cargador detenido',
  })
}
