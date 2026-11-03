import { type NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { NotFoundError } from "@/lib/errors";
import { assertCsrf } from "@/lib/auth/session";
import { idempotencyKeyFrom, ok, parseBody, rateLimitForTenant, route } from "@/lib/api";
import { assertApiAccess, loadEntitlementSnapshot } from "@/lib/entitlements";
import { assertStoreAccess, authorizeApiRequest } from "@/lib/tenant";
import { refundOrder } from "@/lib/services/payment-service";
import { requestReturn } from "@/lib/services/order-service";

/**
 * PRD §11.4 `POST /orders/{orderId}/refund-request`.
 *
 * Two modes: `{ "mode": "return", reason }` opens a return workflow, while
 * `{ "mode": "refund", amount, reason }` refunds through the original gateway
 * and voids the platform fee. Both require `orders:refund`/`orders:write`.
 */

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type OrderRouteContext = { params: Promise<{ orderId: string }> };

const refundSchema = z.discriminatedUnion("mode", [
  z.object({ mode: z.literal("return"), reason: z.string().trim().min(3).max(500) }),
  z.object({
    mode: z.literal("refund"),
    amount: z.string().trim().regex(/^\d+(\.\d{1,2})?$/, "amount দুই দশমিক পর্যন্ত হতে হবে।"),
    reason: z.string().trim().min(3).max(500),
  }),
]);

export const POST = route(async (request: NextRequest, context: OrderRouteContext) => {
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
  await rateLimitForTenant(actor.tenantId, "orders:refund");

  const input = await parseBody(request, refundSchema);
  if (input.mode === "return") {
    return ok(await requestReturn(actor, order.storeId, orderId, { reason: input.reason }));
  }
  return ok(
    await refundOrder(actor, order.storeId, orderId, {
      amount: input.amount,
      reason: input.reason,
      idempotencyKey: idempotencyKeyFrom(request),
    }),
  );
});
