import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { ok, route } from "@/lib/api";

/**
 * Liveness + lightweight metrics probe (PRD §13). Public and unauthenticated on
 * purpose: uptime monitors must reach it without a token. It reports dependency
 * health and process metrics separately, so a degraded database is visible.
 */

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export const GET = route(async () => {
  const startedAt = Date.now();
  let database: "up" | "down" = "up";
  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch {
    database = "down";
  }
  const databaseLatencyMs = Date.now() - startedAt;
  const memory = process.memoryUsage();

  return ok({
    status: database === "up" ? "ok" : "degraded",
    app: env.appName,
    version: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? "v1",
    database,
    metrics: {
      databaseLatencyMs,
      uptimeSeconds: Math.round(process.uptime()),
      memoryRssMb: Math.round(memory.rss / 1024 / 1024),
      heapUsedMb: Math.round(memory.heapUsed / 1024 / 1024),
      nodeVersion: process.version,
    },
    time: new Date().toISOString(),
  });
});
