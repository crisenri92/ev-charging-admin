import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

function requireAdmin(req: NextRequest): boolean {
  const adminToken = req.headers.get('x-admin-token') || req.cookies.get('admin_token')?.value
  const secret = process.env.ADMIN_SECRET || 'ev-admin-secret-2024'
  return !!adminToken && adminToken === secret
}

export async function DELETE(req: NextRequest) {
  if (!requireAdmin(req)) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }
  try {
    const { userId } = await req.json()
    if (!userId) {
      return NextResponse.json({ error: 'userId es requerido' }, { status: 400 })
    }
    const { error } = await supabase.auth.admin.deleteUser(userId)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
