import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { ok, route } from "@/lib/api";
import { env } from "@/lib/env";
import { runBillingSweep } from "@/lib/services/billing-service";
import { expirePendingPayments } from "@/lib/services/payment-service";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function hasValidCronToken(request: Request): boolean {
  const authorization = request.headers.get("authorization") ?? "";
  const supplied = authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
  const expected = env.cronSecret;
  const left = Buffer.from(supplied);
  const right = Buffer.from(expected);
  return left.length === right.length && timingSafeEqual(left, right);
}

/**
 * Idempotent scheduler entrypoint for billing lifecycle and expired checkouts.
 * Configure a platform scheduler to POST this endpoint once per day/minute.
 */
export const POST = route(async (request: Request) => {
  if (!hasValidCronToken(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const [billing, payments] = await Promise.all([
    runBillingSweep(),
    expirePendingPayments(),
  ]);
  return ok({ billing, payments });
});
