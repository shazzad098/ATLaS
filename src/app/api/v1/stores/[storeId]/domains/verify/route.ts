import { type NextRequest } from "next/server";
import { z } from "zod";
import { assertCsrf } from "@/lib/auth/session";
import { ok, parseBody, rateLimitForTenant, route } from "@/lib/api";
import { assertApiAccess, loadEntitlementSnapshot } from "@/lib/entitlements";
import { assertStoreAccess, authorizeApiRequest } from "@/lib/tenant";
import { verifyDomain } from "@/lib/services/domain-service";

/**
 * PRD §11.2 `POST /stores/{storeId}/domains/verify`.
 * The TXT/CNAME record is resolved server-side; a failure throws with the exact
 * record name/value the merchant must add.
 */

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type StoreRouteContext = { params: Promise<{ storeId: string }> };

const verifySchema = z.object({ domainId: z.string().min(1).max(60) });

export const POST = route(async (request: NextRequest, context: StoreRouteContext) => {
  const { storeId } = await context.params;
  assertCsrf(request);
  const { actor } = await authorizeApiRequest(request);
  await assertStoreAccess(actor, storeId);
  const snapshot = await loadEntitlementSnapshot(actor.tenantId);
  assertApiAccess(snapshot);
  await rateLimitForTenant(actor.tenantId, "domains:verify");

  const { domainId } = await parseBody(request, verifySchema);
  return ok(await verifyDomain(actor, storeId, domainId));
});
