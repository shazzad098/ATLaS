import { type NextRequest } from "next/server";
import { z } from "zod";
import { cursorPage, ok, parsePagination, rateLimitForTenant, route } from "@/lib/api";
import { assertApiAccess, loadEntitlementSnapshot } from "@/lib/entitlements";
import { assertPermission } from "@/lib/rbac";
import { assertStoreAccess, authorizeApiRequest } from "@/lib/tenant";
import { prisma } from "@/lib/db";
import { fromPaisa, toPaisa } from "@/lib/money";

/**
 * Customer directory (PRD §11.2 "commerce", FR-09).
 *
 * Cursor-paginated on `createdAt desc` with the row id as the cursor. Lifetime
 * value is summed in integer paisa so the API never returns a float for money.
 * PII stays behind `customers:read`, which the viewer/support roles do not get
 * beyond their own store.
 */

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type StoreRouteContext = { params: Promise<{ storeId: string }> };

const querySchema = z.object({
  q: z.string().trim().max(120).optional(),
  blacklisted: z.enum(["true", "false"]).optional(),
});

export const GET = route(async (request: NextRequest, context: StoreRouteContext) => {
  const { storeId } = await context.params;

  const { actor } = await authorizeApiRequest(request);
  assertPermission(actor, "customers:read");
  await assertStoreAccess(actor, storeId);
  const snapshot = await loadEntitlementSnapshot(actor.tenantId);
  assertApiAccess(snapshot);
  await rateLimitForTenant(actor.tenantId, "customers:read");

  const pagination = parsePagination(request.nextUrl.searchParams);
  const query = querySchema.parse(Object.fromEntries(request.nextUrl.searchParams));

  const rows = await prisma.customer.findMany({
    where: {
      storeId,
      ...(query.blacklisted ? { isBlacklisted: query.blacklisted === "true" } : {}),
      ...(query.q
        ? {
            OR: [
              { name: { contains: query.q, mode: "insensitive" as const } },
              { phone: { contains: query.q } },
              { email: { contains: query.q, mode: "insensitive" as const } },
            ],
          }
        : {}),
    },
    orderBy: { createdAt: "desc" },
    take: pagination.limit + 1,
    ...(pagination.cursor ? { cursor: { id: pagination.cursor }, skip: 1 } : {}),
    include: {
      orders: {
        where: { deletedAt: null },
        select: { grandTotal: true, status: true, placedAt: true },
      },
    },
  });

  const page = cursorPage(rows, pagination.limit);

  return ok(
    page.items.map((customer) => {
      const valid = customer.orders.filter((order) => order.status !== "CANCELLED");
      const spend = valid.reduce((sum, order) => sum + toPaisa(order.grandTotal), 0n);
      const lastOrderAt = valid.reduce<Date | null>((latest, order) => {
        return !latest || order.placedAt > latest ? order.placedAt : latest;
      }, null);

      return {
        id: customer.id,
        name: customer.name,
        phone: customer.phone,
        email: customer.email,
        isBlacklisted: customer.isBlacklisted,
        createdAt: customer.createdAt,
        orders: valid.length,
        lifetimeValue: fromPaisa(spend),
        currency: "BDT",
        lastOrderAt,
      };
    }),
    { meta: { nextCursor: page.nextCursor, hasMore: page.hasMore } },
  );
});
