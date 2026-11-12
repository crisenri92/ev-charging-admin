import { NextRequest, NextResponse } from 'next/server'

const CSMS = process.env.OCPP_SERVER_URL || ''
const SECRET = process.env.OCPP_API_SECRET || 'admin'

export async function GET() {
  if (!CSMS) return NextResponse.json({ error: 'OCPP_SERVER_URL not set' }, { status: 500 })
  try {
    const res = await fetch(`${CSMS}/api/chargers`, { cache: 'no-store' })
    const data = await res.json()
    return NextResponse.json(data)
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  if (!CSMS) return NextResponse.json({ error: 'OCPP_SERVER_URL not set' }, { status: 500 })
  const { chargerId, action, payload } = await req.json()

  const paths: Record<string, string> = {
    'remote-start': `/api/admin/chargers/${chargerId}/remote-start`,
    'remote-stop':  `/api/admin/chargers/${chargerId}/remote-stop`,
    'reset':        `/api/admin/chargers/${chargerId}/reset`,
    'unlock':       `/api/admin/chargers/${chargerId}/unlock`,
  }
  const path = paths[action]
  if (!path) return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 })

  try {
    const res = await fetch(`${CSMS}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${SECRET}` },
      body: JSON.stringify(payload || {}),
    })
    const data = await res.json().catch(() => ({}))
    return NextResponse.json({ ok: res.ok, status: res.status, data })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
