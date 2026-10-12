import { NextRequest } from 'next/server'
import { createClient } from "@supabase/supabase-js"
import { NextResponse } from "next/server"

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
    if (error) throw error
    const { data: profiles } = await supabase.from('profiles').select('id, balance, role')
    const profileMap = new Map((profiles ?? []).map((p: any) => [p.id, p]))

    const result = (users ?? []).map(u => {
      const profile: any = profileMap.get(u.id) ?? {}
      return {
        id: u.id,
        email: u.email,
        balance: profile.balance ?? 0,
        role: profile.role ?? 'user',
        created_at: u.created_at,
        last_sign_in_at: u.last_sign_in_at,
      }
    })

    return NextResponse.json({ users: result })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
