import type { Request } from "express";
import { db } from "../db";
import { rateLimitEvents } from "../../drizzle/schema";

type Bucket = { count: number; resetAt: number; logged: boolean };
const buckets = new Map<string, Bucket>();

/** Fixed-window in-memory limiter. Returns remaining quota or null when blocked (block is logged once per window). */
export function consume(scope: string, key: string, limit: number, windowMs: number, ip?: string): { allowed: boolean; remaining: number; resetAt: number } {
  const id = `${scope}:${key}`;
  const now = Date.now();
  let b = buckets.get(id);
  if (!b || b.resetAt <= now) {
    b = { count: 0, resetAt: now + windowMs, logged: false };
    buckets.set(id, b);
  }
  b.count += 1;
  if (b.count > limit) {
    if (!b.logged) {
      b.logged = true;
      db()
        .insert(rateLimitEvents)
        .values({ scope, key: key.slice(0, 160), ip: ip ?? null })
        .catch(() => undefined);
    }
    return { allowed: false, remaining: 0, resetAt: b.resetAt };
  }
  return { allowed: true, remaining: limit - b.count, resetAt: b.resetAt };
}

setInterval(() => {
  const now = Date.now();
  for (const [k, b] of Array.from(buckets.entries())) if (b.resetAt <= now) buckets.delete(k);
}, 60_000).unref();

export function clientIp(req: Request): string {
  const fwd = req.headers["x-forwarded-for"];
  const raw = Array.isArray(fwd) ? fwd[0] : fwd;
  return (raw?.split(",")[0].trim() || req.socket.remoteAddress || "unknown").slice(0, 64);
}

/* Lightweight API health metrics (ring buffer). */
type Sample = { at: number; ms: number; status: number; kind: string };
const samples: Sample[] = [];
export function recordRequest(kind: string, ms: number, status: number) {
  samples.push({ at: Date.now(), ms, status, kind });
  if (samples.length > 5000) samples.splice(0, samples.length - 5000);
}
export function apiHealthSummary() {
  const since = Date.now() - 60 * 60 * 1000;
  const recent = samples.filter(s => s.at >= since);
  const sorted = recent.map(s => s.ms).sort((a, b) => a - b);
  const p = (q: number) => (sorted.length ? sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))] : 0);
  const errors = recent.filter(s => s.status >= 500).length;
  return {
    requestsLastHour: recent.length,
    errorRate: recent.length ? errors / recent.length : 0,
    p50Ms: p(0.5),
    p95Ms: p(0.95),
    byKind: Object.entries(
      recent.reduce<Record<string, number>>((acc, s) => {
        acc[s.kind] = (acc[s.kind] ?? 0) + 1;
        return acc;
      }, {})
    ).map(([kind, count]) => ({ kind, count })),
  };
}
