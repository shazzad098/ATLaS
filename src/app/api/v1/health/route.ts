import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { ok, route } from "@/lib/api";

/**
 * Liveness probe (PRD §13). Public and unauthenticated on purpose: uptime
 * monitors must be able to reach it without a token. It reports dependency
 * health separately from process health so a degraded database is visible.
 */

export const dynamic = "force-dynamic";

export const GET = route(async () => {
  let database: "up" | "down" = "up";
  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch {
    database = "down";
  }

  return ok({
    status: database === "up" ? "ok" : "degraded",
    app: env.appName,
    version: "v1",
    database,
    time: new Date().toISOString(),
  });
});
