import { ok, rateLimit, route } from "@/lib/api";
import { assertPermission } from "@/lib/rbac";
import { assertStoreAccess, authenticateRequest, resolveApiActor } from "@/lib/tenant";
import { listPaymentMethods } from "@/lib/services/store-service";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type StoreRouteContext = { params: Promise<{ storeId: string }> };

export const GET = route(async (request: Request, context: StoreRouteContext) => {
  const { storeId } = await context.params;
  const user = await authenticateRequest(request);
  const actor = await resolveApiActor(request, user);
  assertPermission(actor, "payments:read");
  await assertStoreAccess(actor, storeId);
  await rateLimit(`payments:list:${actor.tenantId}`, 120);
  return ok(await listPaymentMethods(storeId));
});
