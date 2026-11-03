import { type NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { NotFoundError } from "@/lib/errors";
import { assertCsrf } from "@/lib/auth/session";
import { ok, parseBody, rateLimitForTenant, route } from "@/lib/api";
import { assertApiAccess, loadEntitlementSnapshot } from "@/lib/entitlements";
import { assertStoreAccess, authorizeApiRequest } from "@/lib/tenant";
import { updateOrderStatus, type OrderStatusValue } from "@/lib/services/order-service";

/**
 * PRD §11.4 `PATCH /orders/{orderId}/status`.
 * The transition table is enforced in the service; invalid jumps return 422 with
 * the allowed next states.
 */

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type OrderRouteContext = { params: Promise<{ orderId: string }> };

const statusSchema = z.object({
  status: z.enum([
    "PENDING_PAYMENT",
    "PAID",
    "CONFIRMED",
    "PROCESSING",
    "SHIPPED",
    "DELIVERED",
    "CANCELLED",
    "REFUNDED",
    "RETURN_REQUESTED",
    "RETURNED",
  ]),
  note: z.string().max(500).optional(),
});

export const PATCH = route(async (request: NextRequest, context: OrderRouteContext) => {
  const { orderId } = await context.params;
  assertCsrf(request);
  const { actor } = await authorizeApiRequest(request);

  const order = await prisma.order.findFirst({
    where: { id: orderId, deletedAt: null },
    select: { storeId: true },
  });
  if (!order) throw new NotFoundError("Order");
  await assertStoreAccess(actor, order.storeId);
  const snapshot = await loadEntitlementSnapshot(actor.tenantId);
  assertApiAccess(snapshot);
  await rateLimitForTenant(actor.tenantId, "orders:status");

  const input = await parseBody(request, statusSchema);
  return ok(
    await updateOrderStatus(actor, order.storeId, orderId, {
      status: input.status as OrderStatusValue,
      note: input.note,
    }),
  );
});
