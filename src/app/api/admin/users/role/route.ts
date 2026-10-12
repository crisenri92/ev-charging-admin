import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

function requireAdmin(req: NextRequest): boolean {
  const token = req.cookies.get('admin_token')?.value
  const secret = process.env.ADMIN_SECRET || 'ev-admin-secret-2024'
  return !!token && token === secret
}

export async function POST(req: NextRequest) {
  if (!requireAdmin(req)) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }
  try {
    const { userId, role } = await req.json()
    if (!userId || !role) {
      return NextResponse.json({ error: 'userId y role son requeridos' }, { status: 400 })
    }
    if (role !== 'admin' && role !== 'user') {
      return NextResponse.json({ error: 'Rol inválido. Use admin o user' }, { status: 400 })
    }
    const { error } = await supabase
      .from('profiles')
      .upsert({ id: userId, role }, { onConflict: 'id' })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true, role })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
