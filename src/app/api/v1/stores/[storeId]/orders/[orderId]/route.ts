import { type NextRequest } from "next/server";
import { z } from "zod";
import { assertCsrf } from "@/lib/auth/session";
import { ok, parseBody, rateLimitForTenant, route } from "@/lib/api";
import { assertApiAccess, loadEntitlementSnapshot } from "@/lib/entitlements";
import { assertPermission } from "@/lib/rbac";
import { assertStoreAccess, authorizeApiRequest } from "@/lib/tenant";
import { getOrderDetail, ORDER_STATUSES, updateOrderStatus } from "@/lib/services/order-service";

/**
 * Single order (PRD §11.2 / FR-04). Status changes go through the service so the
 * transition table, inventory, platform fees and notifications all stay in sync.
 */

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type OrderRouteContext = { params: Promise<{ storeId: string; orderId: string }> };

const patchSchema = z.object({
  status: z.enum(ORDER_STATUSES),
  note: z.string().max(600).optional(),
});

export const GET = route(async (request: NextRequest, context: OrderRouteContext) => {
  const { storeId, orderId } = await context.params;

  const { actor } = await authorizeApiRequest(request);
  assertPermission(actor, "orders:read");
  await assertStoreAccess(actor, storeId);
  const snapshot = await loadEntitlementSnapshot(actor.tenantId);
  assertApiAccess(snapshot);
  await rateLimitForTenant(actor.tenantId, "orders:get");

  const order = await getOrderDetail(storeId, orderId);
  return ok(order);
});

export const PATCH = route(async (request: NextRequest, context: OrderRouteContext) => {
  const { storeId, orderId } = await context.params;

  assertCsrf(request);
  const { actor } = await authorizeApiRequest(request);
  const snapshot = await loadEntitlementSnapshot(actor.tenantId);
  assertApiAccess(snapshot);
  await rateLimitForTenant(actor.tenantId, "orders:update");

  const input = await parseBody(request, patchSchema);
  const order = await updateOrderStatus(actor, storeId, orderId, {
    status: input.status,
    note: input.note,
  });

  return ok(order);
});
