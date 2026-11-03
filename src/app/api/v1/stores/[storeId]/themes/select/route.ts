import { type NextRequest } from "next/server";
import { z } from "zod";
import { assertCsrf } from "@/lib/auth/session";
import { ok, parseBody, rateLimitForTenant, route } from "@/lib/api";
import { assertApiAccess, loadEntitlementSnapshot } from "@/lib/entitlements";
import { assertStoreAccess, authorizeApiRequest } from "@/lib/tenant";
import { selectTheme } from "@/lib/services/theme-service";

/**
 * PRD §11.2 `POST /stores/{storeId}/themes/select`.
 * Kept as its own route so clients following the blueprint do not have to know
 * that the dashboard reuses `POST /themes`.
 */

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type StoreRouteContext = { params: Promise<{ storeId: string }> };

const selectSchema = z.object({ themeCode: z.string().trim().min(2).max(40) });

export const POST = route(async (request: NextRequest, context: StoreRouteContext) => {
  const { storeId } = await context.params;
  assertCsrf(request);
  const { actor } = await authorizeApiRequest(request);
  await assertStoreAccess(actor, storeId);
  const snapshot = await loadEntitlementSnapshot(actor.tenantId);
  assertApiAccess(snapshot);
  await rateLimitForTenant(actor.tenantId, "themes:select");

  const { themeCode } = await parseBody(request, selectSchema);
  return ok(await selectTheme(actor, storeId, themeCode));
});
