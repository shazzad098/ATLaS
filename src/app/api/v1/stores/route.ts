import { assertCsrf } from "@/lib/auth/session";
import { clientIp, ok, parseBody, rateLimitForTenant, route } from "@/lib/api";
import { authorizeApiRequest } from "@/lib/tenant";
import { createStore, listStores, storeInputSchema } from "@/lib/services/store-service";
import { recordAudit } from "@/lib/audit";

/**
 * Tenant stores (PRD §11.2). A store always belongs to the caller's own tenant;
 * the tenant id is taken from the resolved actor, never from the request body
 * (FR-02 — a payload-supplied tenant id is never trusted).
 */

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export const GET = route(async (request: Request) => {
  const { actor } = await authorizeApiRequest(request);
  await rateLimitForTenant(actor.tenantId, "stores:list");

  const stores = await listStores(actor.tenantId);
  return ok(stores);
});

export const POST = route(async (request: Request) => {
  assertCsrf(request);
  const { actor } = await authorizeApiRequest(request);
  await rateLimitForTenant(actor.tenantId, "stores:create");

  const input = await parseBody(request, storeInputSchema);
  const store = await createStore(actor, input);

  await recordAudit({
    action: "store.created",
    tenantId: actor.tenantId,
    actorId: actor.userId,
    resourceType: "Store",
    resourceId: store.id,
    metadata: { via: "api", slug: store.slug },
    ip: clientIp(request),
  });

  return ok(store, { status: 201 });
});
