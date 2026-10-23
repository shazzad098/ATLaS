import { type NextRequest } from "next/server";
import { z } from "zod";
import { ok, parsePagination, rateLimit, route } from "@/lib/api";
import { assertPermission } from "@/lib/rbac";
import { assertStoreAccess, authenticateRequest, resolveApiActor } from "@/lib/tenant";
import { listOrders } from "@/lib/services/order-service";

/**
 * Order list API (PRD §11.2 / FR-04). Same cursor contract as products; the
 * status filter is validated against the transition table's vocabulary.
 */

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type StoreRouteContext = { params: Promise<{ storeId: string }> };

const listQuerySchema = z.object({
  status: z
    .enum([
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
    ])
    .optional(),
  paymentStatus: z.enum(["PENDING", "PAID", "PARTIALLY_REFUNDED", "REFUNDED", "FAILED", "CANCELLED"]).optional(),
  q: z.string().max(120).optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
});

export const GET = route(async (request: NextRequest, context: StoreRouteContext) => {
  const { storeId } = await context.params;

  const user = await authenticateRequest(request);
  const actor = await resolveApiActor(request, user);
  assertPermission(actor, "orders:read");
  await assertStoreAccess(actor, storeId);
  await rateLimit(`orders:list:${actor.tenantId}`, 240);

  const pagination = parsePagination(request.nextUrl.searchParams);
  const query = listQuerySchema.parse(Object.fromEntries(request.nextUrl.searchParams));

  const page = await listOrders(storeId, {
    status: query.status,
    paymentStatus: query.paymentStatus,
    q: query.q,
    from: query.from,
    to: query.to,
    cursor: pagination.cursor,
    limit: pagination.limit,
  });

  return ok(page.items, { meta: { nextCursor: page.nextCursor, hasMore: page.hasMore } });
});
