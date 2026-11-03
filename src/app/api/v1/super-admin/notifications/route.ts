import { type NextRequest } from "next/server";
import { ok, route } from "@/lib/api";
import { requireSuperAdmin } from "@/lib/auth/session";
import { platformActivitySnapshot } from "@/lib/services/platform-activity-service";

/**
 * Super Admin platform notification feed.
 *
 * Polled by the header bell and the notification page. Every item is a readable
 * AuditLog row with tenant, actor and action-specific detail, so a merchant
 * update anywhere in the panel shows up here with enough context.
 */

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export const GET = route(async (request: NextRequest) => {
  await requireSuperAdmin();

  const url = new URL(request.url);
  const rawLimit = Number(url.searchParams.get("limit") ?? 20);
  const limit = Number.isFinite(rawLimit) ? Math.min(Math.max(Math.trunc(rawLimit), 1), 100) : 20;

  const sinceRaw = url.searchParams.get("since");
  const parsedSince = sinceRaw ? new Date(sinceRaw) : null;
  const since = parsedSince && !Number.isNaN(parsedSince.getTime()) ? parsedSince : null;

  const snapshot = await platformActivitySnapshot({ limit, since });
  return ok(snapshot);
});
