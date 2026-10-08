import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Bug #3 fix: middleware already validated admin_token — no need for requireAdminUser() here.
// Bug #4 fix: sends RemoteStopTransaction to CSMS before closing session in DB.

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: NextRequest) {
  try {
    const { sessionId } = await req.json()
    if (!sessionId) {
      return NextResponse.json({ error: 'sessionId is required' }, { status: 400 })
    }

    // Fetch the active session
    const { data: session, error: fetchError } = await supabase
      .from('charging_sessions')
      .select('id, user_id, charger_id, transaction_id, status')
      .eq('id', sessionId)
      .single()

    if (fetchError || !session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 })
    }

    if (session.status !== 'active') {
      return NextResponse.json({ error: `Session is not active (status: ${session.status})` }, { status: 409 })
    }

    // Bug #4: Send RemoteStopTransaction to CSMS before closing in DB
    const ocppUrl = process.env.OCPP_BACKEND_URL
    if (ocppUrl && session.charger_id) {
      try {
        await fetch(`${ocppUrl}/remote-stop`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chargerId: session.charger_id,
            transactionId: session.transaction_id,
          }),
          signal: AbortSignal.timeout(5000),
        })
        console.log(`[ForceStop] RemoteStopTransaction sent for charger ${session.charger_id}`)
      } catch (e) {
        // Non-blocking: log error but continue with DB closure
        console.error('[ForceStop] Failed to send RemoteStopTransaction:', e)
      }
    }

    // Close session using the atomic RPC (consistent with /api/charging/stop)
    const now = new Date().toISOString()
    const { error: rpcError } = await supabase.rpc('close_charging_session', {
      p_session_id: session.id,
      p_user_id: session.user_id,
      p_energy_kwh: 0,
      p_cost: 0,
      p_stop_meter: null,
      p_stop_time: now,
      p_stop_reason: 'AdminForceStop',
    })

    if (rpcError) {
      console.error('[ForceStop] close_charging_session RPC failed:', rpcError)
      return NextResponse.json({ error: rpcError.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true, sessionId: session.id, stoppedAt: now })
  } catch (err: any) {
    console.error('[ForceStop] Error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
