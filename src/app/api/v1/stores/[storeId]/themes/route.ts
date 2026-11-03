import { type NextRequest } from "next/server";
import { z } from "zod";
import { assertCsrf } from "@/lib/auth/session";
import { ok, parseBody, rateLimitForTenant, route } from "@/lib/api";
import { assertApiAccess, loadEntitlementSnapshot } from "@/lib/entitlements";
import { assertPermission } from "@/lib/rbac";
import { assertStoreAccess, authorizeApiRequest } from "@/lib/tenant";
import { getStoreThemeState, listThemeOptions, selectTheme } from "@/lib/services/theme-service";

/**
 * Store themes (FR-06, PRD §11.2 "stores & themes").
 *
 * `GET` returns the catalog annotated with plan access and the current
 * selection; `POST` changes the selected theme. Both rules that matter —
 * per-plan allow-list and the Basic/Free switching lock — are enforced inside
 * `theme-service`, so a client cannot bypass them by calling the API directly.
 */

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type StoreRouteContext = { params: Promise<{ storeId: string }> };

const selectSchema = z.object({
  themeCode: z.string().trim().min(2).max(40),
});

export const GET = route(async (request: NextRequest, context: StoreRouteContext) => {
  const { storeId } = await context.params;

  const { actor } = await authorizeApiRequest(request);
  assertPermission(actor, "design:read");
  await assertStoreAccess(actor, storeId);
  const snapshot = await loadEntitlementSnapshot(actor.tenantId);
  assertApiAccess(snapshot);
  await rateLimitForTenant(actor.tenantId, "themes:read");

  const [options, state] = await Promise.all([
    listThemeOptions(storeId, actor.tenantId),
    getStoreThemeState(storeId, actor.tenantId),
  ]);

  return ok({
    selected: state.themeCode,
    canSwitch: state.canSwitch,
    switchBlockedReason: state.switchBlockedReason,
    isPublished: state.isPublished,
    themes: options,
  });
});

export const POST = route(async (request: NextRequest, context: StoreRouteContext) => {
  const { storeId } = await context.params;

  assertCsrf(request);
  const { actor } = await authorizeApiRequest(request);
  const snapshot = await loadEntitlementSnapshot(actor.tenantId);
  assertApiAccess(snapshot);
  await rateLimitForTenant(actor.tenantId, "themes:select");

  const { themeCode } = await parseBody(request, selectSchema);
  const result = await selectTheme(actor, storeId, themeCode);

  return ok(result);
});
