import { NextRequest } from 'next/server'
import { createClient } from "@supabase/supabase-js"
import { NextResponse } from "next/server"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)


async function requireAdminUser(req: NextRequest) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '') ??
                req.cookies.get('sb-access-token')?.value ?? ''
  if (!token) return null
  const { data: { user }, error } = await supabase.auth.getUser(token)
  if (error || !user) return null
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  return profile?.role === 'admin' ? user : null
}

export async function GET(req: NextRequest) {
  const adminUser = await requireAdminUser(req)
  if (!adminUser) return NextResponse.json({ error: 'Se requiere rol admin' }, { status: 403 })

  try {
    const { data: { users }, error } = await supabase.auth.admin.listUsers()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    const userIds = users.map(u => u.id)
    const { data: balances } = await supabase
      .from("user_balances").select("*").in("user_id", userIds)
    const usersWithBalances = users.map(user => ({
      id: user.id, email: user.email, created_at: user.created_at,
      last_sign_in_at: user.last_sign_in_at, user_metadata: user.user_metadata,
      role: user.user_metadata?.role || "client",
      balance: balances?.find(b => b.user_id === user.id)?.balance ?? 0,
      currency: balances?.find(b => b.user_id === user.id)?.currency ?? "USD",
    }))
    return NextResponse.json({ users: usersWithBalances })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
