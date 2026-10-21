export interface RateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  /** Seconds until the current window resets */
  retryAfter: number;
}

export interface RateLimiterOptions {
  limit: number;
  windowMs: number;
  /** Injectable clock, useful for tests */
  now?: () => number;
  /** Prune expired keys once the map grows past this size */
  maxKeys?: number;
}

/**
 * Fixed-window rate limiter kept in memory.
 *
 * State lives in the server process, so with several instances (e.g. serverless)
 * each one counts separately. That is enough to stop accidental floods from a
 * single user; for a strict global limit, back it with a shared store (Redis).
 */
export function createRateLimiter({
  limit,
  windowMs,
  now = Date.now,
  maxKeys = 10_000,
}: RateLimiterOptions) {
  const windows = new Map<string, { count: number; resetAt: number }>();

  function prune(time: number) {
    for (const [key, entry] of windows) {
      if (entry.resetAt <= time) windows.delete(key);
    }
  }

  return {
    check(key: string): RateLimitResult {
      const time = now();
      let entry = windows.get(key);

      if (!entry || entry.resetAt <= time) {
        if (windows.size >= maxKeys) prune(time);
        entry = { count: 0, resetAt: time + windowMs };
        windows.set(key, entry);
      }

      const retryAfter = Math.ceil((entry.resetAt - time) / 1000);

      if (entry.count >= limit) {
        return { allowed: false, limit, remaining: 0, retryAfter };
      }

      entry.count += 1;
      return { allowed: true, limit, remaining: limit - entry.count, retryAfter };
    },
  };
}

export function rateLimitHeaders(result: RateLimitResult): HeadersInit {
  return {
    "X-RateLimit-Limit": String(result.limit),
    "X-RateLimit-Remaining": String(result.remaining),
    ...(!result.allowed && { "Retry-After": String(result.retryAfter) }),
  };
}
