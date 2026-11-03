import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { env } from "@/lib/env";
import { retryDueWebhooks } from "@/lib/services/webhook-service";

/**
 * Outbound webhook retry job. Runs more often than billing (Vercel Cron supports
 * per-minute schedules on paid plans); the query only picks rows whose backoff
 * window has elapsed, so it is safe to call repeatedly.
 */

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

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
    const result = await retryDueWebhooks(50);
    return NextResponse.json({
      ok: true,
      result,
      durationMs: Date.now() - startedAt,
      ranAt: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Webhook retry failed",
      },
      { status: 500 },
    );
  }
}

export const GET = run;
export const POST = run;
