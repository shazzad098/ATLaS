/**
 * In-memory fixed-window rate limiter shared by the proxy (edge request gate)
 * and API helpers. Single-instance deployments get exact counts; multi-instance
 * deployments get per-instance windows, which is still a hard ceiling per
 * instance and the interface is intentionally identical to a Redis backend.
 */

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

/** Bounds memory if a flood of unique keys (spoofed IPs) arrives. */
const MAX_BUCKETS = 20_000;

export type RateLimitResult = {
  ok: boolean;
  limit: number;
  /** Seconds until the window resets. `0` when the request is allowed. */
  retryAfterSeconds: number;
};

function sweep(now: number): void {
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }
  // Still full of live windows: drop the oldest entries so new keys fit.
  if (buckets.size >= MAX_BUCKETS) {
    let drop = Math.ceil(buckets.size / 2);
    for (const key of buckets.keys()) {
      buckets.delete(key);
      if (--drop <= 0) break;
    }
  }
}

/** Consume one unit for `key`. Never throws; callers decide how to respond. */
export function checkRateLimit(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now();
  const bucket = buckets.get(key);

  if (!bucket || bucket.resetAt <= now) {
    if (buckets.size >= MAX_BUCKETS) sweep(now);
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true, limit, retryAfterSeconds: 0 };
  }

  bucket.count += 1;
  if (bucket.count > limit) {
    return {
      ok: false,
      limit,
      retryAfterSeconds: Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)),
    };
  }

  return { ok: true, limit, retryAfterSeconds: 0 };
}

/** Test/ops helper: forget every window (e.g. after a deploy or in unit tests). */
export function resetRateLimits(): void {
  buckets.clear();
}
