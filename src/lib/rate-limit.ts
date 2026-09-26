/**
 * In-memory sliding window rate limiter for Next.js API routes.
 *
 * WARNING (M-2): This does NOT work correctly in multi-instance serverless
 * deployments — each instance has its own Map in memory, so limits are
 * per-instance rather than global. For production multi-instance setups,
 * replace with a Redis-based solution (e.g. Upstash Redis + @upstash/ratelimit).
 *
 * Acceptable for single-instance Railway deployments.
 *
 * This is the canonical rate-limit implementation. The api-helpers.ts
 * module re-exports this function so all routes use the same logic.
 */

interface RateLimitEntry {
  count: number
  windowStart: number
}

const store = new Map<string, RateLimitEntry>()

// Cleanup old entries every 5 minutes to prevent memory leaks
setInterval(() => {
  const now = Date.now()
  for (const [key, entry] of store.entries()) {
    if (now - entry.windowStart > 5 * 60 * 1000) {
      store.delete(key)
    }
  }
}, 5 * 60 * 1000)

/**
 * Check if a key has exceeded the rate limit.
 * @param key Unique identifier (userId or IP)
 * @param limit Max requests allowed in the window
 * @param windowMs Window size in milliseconds (default 60s)
 * @returns { ok: boolean, remaining: number, resetIn: number }
 */
export function checkRateLimit(
  key: string,
  limit: number = 10,
  windowMs: number = 60_000
): { ok: boolean; remaining: number; resetIn: number } {
  if (store.size > 10_000) {
    console.warn('[rate-limit] Store size exceeded 10k entries — consider switching to Redis for multi-instance deployments')
  }

  const now = Date.now()
  const entry = store.get(key)

  if (!entry || now - entry.windowStart >= windowMs) {
    // New window
    store.set(key, { count: 1, windowStart: now })
    return { ok: true, remaining: limit - 1, resetIn: windowMs }
  }

  if (entry.count >= limit) {
    const resetIn = windowMs - (now - entry.windowStart)
    return { ok: false, remaining: 0, resetIn }
  }

  entry.count++
  return { ok: true, remaining: limit - entry.count, resetIn: windowMs - (now - entry.windowStart) }
}
