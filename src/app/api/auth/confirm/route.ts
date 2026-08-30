import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const adminDb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

export async function POST(req: NextRequest) {
  const { userId } = await req.json()
  if (!userId) return NextResponse.json({ error: 'userId required' }, { status: 400 })

  // Confirm email using admin API
  const { data, error } = await adminDb.auth.admin.updateUser(userId, { email_confirm: true })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Create wallet balance row
  await adminDb.from('user_balances').upsert(
    { user_id: userId, balance: 0 },
    { onConflict: 'user_id', ignoreDuplicates: true }
  )

  return NextResponse.json({ ok: true, email: data.user.email })
}
