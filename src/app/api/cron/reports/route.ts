import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { env } from "@/lib/env";
import { aggregateAllStores, runDueExportSchedules } from "@/lib/services/report-service";

/**
 * Daily reporting job: rolls yesterday's orders into `DailyStoreMetric` and
 * turns due Pro export schedules into queued CSV jobs. Idempotent, so a retry
 * after a timeout is safe.
 */

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

function equals(expected: string, received: string): boolean {
  const a = Buffer.from(expected);
  const b = Buffer.from(received);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

function authorized(request: Request): boolean {
  if (!env.cronSecret) return env.isDev;
  const authorization = request.headers.get("authorization") ?? "";
  const bearer = authorization.startsWith("Bearer ") ? authorization.slice(7).trim() : "";
  const supplied = bearer || request.headers.get("x-cron-secret") || "";
  return supplied.length > 0 && equals(env.cronSecret, supplied);
}

async function run(request: Request) {
  if (!authorized(request)) {
    return NextResponse.json(
      { ok: false, error: "Unauthorized" },
      { status: env.cronSecret ? 401 : 503 },
    );
  }

  const startedAt = Date.now();
  try {
    const [aggregation, schedules] = await Promise.all([
      aggregateAllStores(),
      runDueExportSchedules(10),
    ]);
    return NextResponse.json({
      ok: true,
      aggregation,
      schedules,
      durationMs: Date.now() - startedAt,
      ranAt: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Report job failed" },
      { status: 500 },
    );
  }
}

export const GET = run;
export const POST = run;
