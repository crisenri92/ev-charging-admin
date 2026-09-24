/**
 * In-memory rate limiter for Next.js API routes.
 * Tracks requests per key (user ID or IP) within a sliding window.
 * Safe for single-instance deployments (Railway).
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
 * @param key     Unique identifier (userId or IP)
 * @param limit   Max requests allowed in the window
 * @param windowMs Window size in milliseconds (default 60s)
 * @returns { ok: boolean, remaining: number, resetIn: number }
 */
export function checkRateLimit(
    key: string,
    limit: number = 10,
    windowMs: number = 60_000
  ): { ok: boolean; remaining: number; resetIn: number } {
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
