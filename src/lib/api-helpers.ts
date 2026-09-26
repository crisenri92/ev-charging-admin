import { NextRequest, NextResponse } from 'next/server'
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

/**
 * Verifies auth from Bearer token (mobile) OR cookies (web).
 * Use this in API routes that must support both mobile and web clients.
 */
export async function requireAuthFromRequest(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.replace('Bearer ', '')
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
    const { data: { user }, error } = await supabase.auth.getUser(token)
    if (error || !user) throw apiError('No autorizado', 401)
    return { user }
  }
  // Fallback to cookie-based auth
  const { user } = await requireAuth()
  return { user }
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
// M-2: Removed duplicate checkRateLimit implementation.
// Use @/lib/rate-limit instead — it has sliding window, proper cleanup,
// and a richer return type { ok, remaining, resetIn }.
export { checkRateLimit } from '@/lib/rate-limit'
