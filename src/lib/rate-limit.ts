import { log } from "@/lib/logger";

/**
 * Rate limiting with a pluggable store.
 *
 * Two gates exist in ATLaS:
 *
 *  1. **Edge gate** (`src/proxy.ts`) — per-IP limits for `/api/*` and the auth
 *     mutations. This runs on every request and is the one that must hold when
 *     the app runs as more than one instance, so it is awaited and uses
 *     `checkRateLimit()`.
 *  2. **Action gate** (`rateLimit()` in `src/lib/api.ts`) — a per-instance
 *     burst limiter inside individual handlers, where an extra round trip to a
 *     remote store would cost more than it protects.
 *
 * `RATE_LIMIT_DRIVER=redis` switches the edge gate to any Upstash-compatible
 * Redis REST endpoint (`UPSTASH_REDIS_REST_URL` / `…_TOKEN`). Without it the
 * in-memory store is used, which is correct for a single instance and for
 * tests, and degrades to per-instance windows otherwise. A failing remote store
 * falls back to memory rather than taking the site down.
 */

type Bucket = { count: number; resetAt: number };

export type RateLimitResult = {
  ok: boolean;
  limit: number;
  /** Seconds until the window resets. `0` when the request is allowed. */
  retryAfterSeconds: number;
};

export type RateLimitStore = {
  readonly name: string;
  hit(key: string, windowMs: number): Promise<{ count: number; resetAt: number }>;
  reset(): void;
};

/** Bounds memory if a flood of unique keys (spoofed IPs) arrives. */
const MAX_BUCKETS = 20_000;

function sweep(buckets: Map<string, Bucket>, now: number): void {
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }
  if (buckets.size >= MAX_BUCKETS) {
    let drop = Math.ceil(buckets.size / 2);
    for (const key of buckets.keys()) {
      buckets.delete(key);
      if (--drop <= 0) break;
    }
  }
}

export function createMemoryStore(): RateLimitStore {
  const buckets = new Map<string, Bucket>();
  return {
    name: "memory",
    async hit(key, windowMs) {
      const now = Date.now();
      const bucket = buckets.get(key);
      if (!bucket || bucket.resetAt <= now) {
        if (buckets.size >= MAX_BUCKETS) sweep(buckets, now);
        const fresh = { count: 1, resetAt: now + windowMs };
        buckets.set(key, fresh);
        return { ...fresh };
      }
      bucket.count += 1;
      return { count: bucket.count, resetAt: bucket.resetAt };
    },
    reset() {
      buckets.clear();
    },
  };
}

export type RedisRestOptions = { url: string; token: string };

/**
 * Upstash-compatible REST store: `INCR` + `PEXPIRE … NX` + `PTTL` in one
 * pipeline. No SDK is required, so no dependency is added for one feature.
 */
export function createRedisRestStore(options: RedisRestOptions): RateLimitStore {
  const base = options.url.replace(/\/$/, "");
  return {
    name: "redis-rest",
    async hit(key, windowMs) {
      const redisKey = `atlas:rl:${key}`;
      const response = await fetch(`${base}/pipeline`, {
        method: "POST",
        headers: {
          authorization: `Bearer ${options.token}`,
          "content-type": "application/json",
        },
        body: JSON.stringify([
          ["INCR", redisKey],
          ["PEXPIRE", redisKey, windowMs, "NX"],
          ["PTTL", redisKey],
        ]),
        signal: AbortSignal.timeout(1_000),
      });
      if (!response.ok) {
        throw new Error(`rate-limit store responded ${response.status}`);
      }
      const payload = (await response.json()) as Array<{ result?: unknown; error?: string }>;
      const count = Number(payload[0]?.result ?? 0);
      const ttl = Number(payload[2]?.result ?? -1);
      if (!Number.isFinite(count) || count <= 0) {
        throw new Error("rate-limit store returned an invalid count");
      }
      return {
        count,
        resetAt: Date.now() + (Number.isFinite(ttl) && ttl > 0 ? ttl : windowMs),
      };
    },
    reset() {
      // Remote keys expire on their own; a test reset cannot clear a shared
      // Redis without a scan, so this is intentionally a no-op.
    },
  };
}

let memory = createMemoryStore();
let remote: RateLimitStore | null = null;
let resolved = false;

function store(): RateLimitStore {
  if (resolved) return remote ?? memory;
  resolved = true;

  const driver = (process.env.RATE_LIMIT_DRIVER ?? "").toLowerCase();
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (driver === "redis" && url && token) {
    remote = createRedisRestStore({ url, token });
  }
  return remote ?? memory;
}

/**
 * Consume one unit for `key`. Never throws: a broken remote store degrades to
 * the local window instead of failing the request it is meant to protect.
 */
export async function checkRateLimit(
  key: string,
  limit: number,
  windowMs: number,
): Promise<RateLimitResult> {
  let bucket: { count: number; resetAt: number };
  try {
    bucket = await store().hit(key, windowMs);
  } catch (error) {
    log("warn", "rate limit store unavailable; falling back to memory", {
      error: error instanceof Error ? error.message : String(error),
    });
    bucket = await memory.hit(key, windowMs);
  }

  const now = Date.now();
  if (bucket.count <= limit) return { ok: true, limit, retryAfterSeconds: 0 };
  return {
    ok: false,
    limit,
    retryAfterSeconds: Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)),
  };
}

/** Synchronous per-instance limiter, used inside individual handlers. */
export function checkRateLimitLocal(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now();
  const bucket = memoryBucket(key, windowMs, now);
  if (bucket.count <= limit) return { ok: true, limit, retryAfterSeconds: 0 };
  return {
    ok: false,
    limit,
    retryAfterSeconds: Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)),
  };
}

const localBuckets = new Map<string, Bucket>();

function memoryBucket(key: string, windowMs: number, now: number): Bucket {
  const existing = localBuckets.get(key);
  if (!existing || existing.resetAt <= now) {
    if (localBuckets.size >= MAX_BUCKETS) sweep(localBuckets, now);
    const fresh = { count: 1, resetAt: now + windowMs };
    localBuckets.set(key, fresh);
    return fresh;
  }
  existing.count += 1;
  return existing;
}

/** Test/ops helper: forget every local window and re-read the driver env. */
export function resetRateLimits(): void {
  memory = createMemoryStore();
  remote = null;
  resolved = false;
  localBuckets.clear();
}
