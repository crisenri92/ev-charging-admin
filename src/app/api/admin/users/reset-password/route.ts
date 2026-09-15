import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function verifyAdmin(req: NextRequest): Promise<boolean> {
  const headerToken = req.headers.get('x-admin-token')
  if (headerToken && headerToken === process.env.ADMIN_SECRET) return true
  const cookieStore = await cookies()
  const cookieToken = cookieStore.get('admin_token')?.value
  return cookieToken === process.env.ADMIN_SECRET
}

export async function POST(req: NextRequest) {
  if (!(await verifyAdmin(req))) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }
  try {
    const { email } = await req.json()
    if (!email) return NextResponse.json({ error: 'email requerido' }, { status: 400 })
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: 'https://ev-charging-admin-production.up.railway.app/mobile/reset-password',
    })
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
