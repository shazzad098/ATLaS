import { type NextRequest } from "next/server";
import { z } from "zod";
import { assertCsrf } from "@/lib/auth/session";
import { ok, parseBody, rateLimit, route } from "@/lib/api";
import { assertPermission } from "@/lib/rbac";
import { assertStoreAccess, authenticateRequest, resolveApiActor } from "@/lib/tenant";
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

  const user = await authenticateRequest(request);
  const actor = await resolveApiActor(request, user);
  assertPermission(actor, "orders:read");
  await assertStoreAccess(actor, storeId);
  await rateLimit(`orders:get:${actor.tenantId}`, 240);

  const order = await getOrderDetail(storeId, orderId);
  return ok(order);
});

export const PATCH = route(async (request: NextRequest, context: OrderRouteContext) => {
  const { storeId, orderId } = await context.params;

  assertCsrf(request);
  const user = await authenticateRequest(request);
  const actor = await resolveApiActor(request, user);
  await rateLimit(`orders:update:${actor.tenantId}`, 120);

  const input = await parseBody(request, patchSchema);
  const order = await updateOrderStatus(actor, storeId, orderId, {
    status: input.status,
    note: input.note,
  });

  return ok(order);
});
