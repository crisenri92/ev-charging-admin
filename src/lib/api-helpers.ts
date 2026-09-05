import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createClient } from '@supabase/supabase-js'

// ─── Response helpers ────────────────────────────────────────────────────────

export function apiOk<T>(data: T, status = 200) {
  return NextResponse.json(data, { status })
}

export function apiError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status })
}

// ─── Auth ────────────────────────────────────────────────────────────────────

/**
 * Verifies the Supabase session from cookies.
 * Returns the authenticated user, or throws a 401 NextResponse.
 */
export async function requireAuth() {
  const cookieStore = await cookies()
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: {
        storage: {
          getItem: (key: string) => cookieStore.get(key)?.value ?? null,
          setItem: () => {},
          removeItem: () => {},
        },
      },
    }
  )
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) throw apiError('No autorizado', 401)
  return { user, supabase }
}

/** Admin client with service role key (bypasses RLS). */
export function supabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

// ─── Webhook auth ─────────────────────────────────────────────────────────────

/** Verifies the CSMS webhook secret header. Throws 401 if invalid. */
export function requireWebhookSecret(req: Request) {
  const secret = req.headers.get('authorization')?.replace('Bearer ', '')
  if (!secret || secret !== process.env.CSMS_WEBHOOK_SECRET) {
    throw apiError('No autorizado', 401)
  }
}

// ─── Rate limiting ────────────────────────────────────────────────────────────

const _rlMap = new Map<string, { count: number; resetAt: number }>()

/** Returns true if the request is within the rate limit. */
export function checkRateLimit(key: string, limit = 10): boolean {
  const now = Date.now()
  const entry = _rlMap.get(key)
  if (!entry || entry.resetAt < now) {
    _rlMap.set(key, { count: 1, resetAt: now + 60_000 })
    return true
  }
  if (entry.count >= limit) return false
  entry.count++
  return true
}
