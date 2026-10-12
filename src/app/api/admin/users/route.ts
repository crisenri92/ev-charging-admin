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

export async function GET(req: NextRequest) {
  if (!requireAdmin(req)) {
    return NextResponse.json({ error: 'Se requiere rol admin' }, { status: 403 })
  }
  try {
    const { data: { users }, error } = await supabase.auth.admin.listUsers()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    const userIds = (users ?? []).map(u => u.id)
    const { data: balances } = await supabase
      .from('user_balances').select('*').in('user_id', userIds)
    const { data: profiles } = await supabase
      .from('profiles').select('id, role').in('id', userIds)

    const profileMap = new Map((profiles ?? []).map((p: any) => [p.id, p]))
    const balanceMap = new Map((balances ?? []).map((b: any) => [b.user_id, b]))

    const result = (users ?? []).map(u => {
      const profile: any = profileMap.get(u.id) ?? {}
      const bal: any = balanceMap.get(u.id) ?? {}
      return {
        id: u.id,
        email: u.email,
        balance: bal.balance ?? 0,
        currency: bal.currency ?? 'USD',
        role: profile.role ?? 'user',
        created_at: u.created_at,
        last_sign_in_at: u.last_sign_in_at,
      }
    })

    return NextResponse.json({ users: result })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
