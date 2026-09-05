import { NextRequest, NextResponse } from 'next/server'
import { checkRateLimit, supabaseAdmin } from '@/lib/api-helpers'
import { getCurrentPrice } from '@/lib/pricing'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://ev-charging-admin-production.up.railway.app'

export async function POST(req: NextRequest) {
  // Validate webhook secret
  const secret = request.headers.get('authorization')?.replace('Bearer ', '');
  if (!secret || secret !== process.env.CSMS_WEBHOOK_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Rate limit
  const ip = request.headers.get('x-forwarded-for') ?? 'unknown';
  if (!checkRateLimit(ip)) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
  }

    const supabase = supabaseAdmin()

  try {
    const body = await req.json()
    const { chargerId, sessionId, meterStart, meterStop, reason } = body

    let sessionQuery = supabase.from('charging_sessions').select('*').eq('status', 'active')
    if (sessionId) {
      sessionQuery = sessionQuery.eq('id', sessionId)
    } else if (chargerId) {
      const normalizedId = (chargerId as string).replace(/_/g, '')
      sessionQuery = sessionQuery.eq('charger_id', normalizedId).order('started_at', { ascending: false }).limit(1)
    }
    const { data: sessions } = await sessionQuery
    if (!sessions || sessions.length === 0) return NextResponse.json({ message: 'No active session found' })

    const session = sessions[0]
    const energyKwh = (meterStop != null && (meterStart ?? session.meter_start) != null)
      ? (meterStop - (meterStart ?? session.meter_start)) / 1000
      : 0
    const { price: pricePerKwh } = await getCurrentPrice(process.env.SUPABASE_SERVICE_ROLE_KEY!)
    const cost = parseFloat((energyKwh * pricePerKwh).toFixed(4))
    const now = new Date().toISOString()

    // Atomic RPC: closes session + deducts balance + inserts transaction in one DB transaction
    // Validate chargerId has an active session
    const { data: activeSession } = await supabase
      .from('charging_sessions')
      .select('id')
      .eq('charger_id', chargerId)
      .eq('status', 'Active')
      .maybeSingle();
    if (!activeSession) {
      return NextResponse.json({ error: 'No active session for this charger' }, { status: 404 });
    }

    const { data: rpcData, error: rpcError } = await supabase.rpc('close_charging_session', {
      p_session_id: session.id,
      p_user_id: session.user_id,
      p_energy_kwh: energyKwh,
      p_cost: cost,
      p_stop_meter: meterStop ?? null,
      p_stop_time: now,
      p_stop_reason: reason || 'Remote',
    })

    if (rpcError) {
      console.error('close_charging_session RPC failed:', rpcError)
      return NextResponse.json({ error: rpcError.message }, { status: 500 })
    }

    const balanceAfter: number = (rpcData as any)?.balance_after ?? 0

    // Send push notification (non-blocking)
    if (cost > 0) {
      try {
        await fetch(`${APP_URL}/api/push/send`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: session.user_id,
            title: '⚡ Carga completada',
            body: `${energyKwh.toFixed(2)} kWh Â· $${cost.toFixed(2)} descontado Â· Saldo: $${balanceAfter.toFixed(2)}`,
            url: '/mobile/historial',
          }),
        })
      } catch {} // non-blocking
    }

    return NextResponse.json({ ok: true, sessionId: session.id, cost, energyKwh })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
