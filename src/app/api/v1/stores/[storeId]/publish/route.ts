import { type NextRequest } from "next/server";
import { assertCsrf } from "@/lib/auth/session";
import { ok, rateLimitForTenant, route } from "@/lib/api";
import { assertApiAccess, loadEntitlementSnapshot } from "@/lib/entitlements";
import { assertStoreAccess, authorizeApiRequest } from "@/lib/tenant";
import { publishStore } from "@/lib/services/store-service";

/** Publish a store (PRD §11.2). Readiness and plan rules live in the service. */

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type StoreRouteContext = { params: Promise<{ storeId: string }> };

export const POST = route(async (request: NextRequest, context: StoreRouteContext) => {
  const { storeId } = await context.params;
  assertCsrf(request);
  const { actor } = await authorizeApiRequest(request);
  await assertStoreAccess(actor, storeId);
  const snapshot = await loadEntitlementSnapshot(actor.tenantId);
  assertApiAccess(snapshot);
  await rateLimitForTenant(actor.tenantId, "stores:publish");

  return ok(await publishStore(actor, storeId));
});
