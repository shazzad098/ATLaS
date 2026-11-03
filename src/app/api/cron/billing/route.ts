import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { env } from "@/lib/env";
import { runBillingSweep } from "@/lib/services/billing-service";

/**
 * Daily billing lifecycle job (PRD §5.2).
 *
 * Deploy this route behind a scheduler (Vercel Cron, GitHub Actions, or a
 * systemd timer) with `Authorization: Bearer $CRON_SECRET`. The sweep itself is
 * idempotent, so overlapping runs are safe.
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
  const bearer = authorization.startsWith("Bearer ")
    ? authorization.slice(7).trim()
    : "";
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
    const result = await runBillingSweep();
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
        error: error instanceof Error ? error.message : "Billing sweep failed",
      },
      { status: 500 },
    );
  }
}

export const GET = run;
export const POST = run;
