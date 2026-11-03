import { type NextRequest } from "next/server";
import { assertCsrf } from "@/lib/auth/session";
import { ok, parseBody, rateLimitForTenant, route } from "@/lib/api";
import { assertApiAccess, loadEntitlementSnapshot } from "@/lib/entitlements";
import { assertPermission } from "@/lib/rbac";
import { assertStoreAccess, authorizeApiRequest } from "@/lib/tenant";
import { getStoreDetail, storeSettingsSchema, updateStoreSettings } from "@/lib/services/store-service";

/** Single store (PRD §11.2). Tenant membership is re-checked on every call. */

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type StoreRouteContext = { params: Promise<{ storeId: string }> };

export const GET = route(async (request: NextRequest, context: StoreRouteContext) => {
  const { storeId } = await context.params;
  const { actor } = await authorizeApiRequest(request);
  assertPermission(actor, "store:read");
  await assertStoreAccess(actor, storeId);
  const snapshot = await loadEntitlementSnapshot(actor.tenantId);
  assertApiAccess(snapshot);
  await rateLimitForTenant(actor.tenantId, "stores:read");

  return ok(await getStoreDetail(storeId));
});

export const PATCH = route(async (request: NextRequest, context: StoreRouteContext) => {
  const { storeId } = await context.params;
  assertCsrf(request);
  const { actor } = await authorizeApiRequest(request);
  const snapshot = await loadEntitlementSnapshot(actor.tenantId);
  assertApiAccess(snapshot);
  await rateLimitForTenant(actor.tenantId, "stores:update");

  // `storeSettingsSchema` is already partial: omitted fields keep their value.
  const body = await parseBody(request, storeSettingsSchema);
  const store = await updateStoreSettings(actor, storeId, body);
  return ok(store);
});
