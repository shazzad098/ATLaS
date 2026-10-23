import { type NextRequest } from "next/server";
import { z } from "zod";
import { assertCsrf } from "@/lib/auth/session";
import { clientIp, ok, parseBody, parsePagination, rateLimit, route } from "@/lib/api";
import { assertPermission } from "@/lib/rbac";
import { assertStoreAccess, authenticateRequest, resolveApiActor } from "@/lib/tenant";
import { createProduct, listProducts, productInputSchema } from "@/lib/services/catalog-service";

/**
 * Store catalog API (PRD §11.2 / FR-03).
 *
 * `listProducts` already applies the `take: limit + 1` cursor pattern, so the
 * handler only has to map the result into the standard envelope. Quota checks
 * and the `catalog:write` gate live in the service, not here.
 */

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type StoreRouteContext = { params: Promise<{ storeId: string }> };

const listQuerySchema = z.object({
  q: z.string().max(120).optional(),
  categoryId: z.string().max(40).optional(),
  status: z.enum(["DRAFT", "ACTIVE", "ARCHIVED"]).optional(),
});

export const GET = route(async (request: NextRequest, context: StoreRouteContext) => {
  const { storeId } = await context.params;

  const user = await authenticateRequest(request);
  const actor = await resolveApiActor(request, user);
  assertPermission(actor, "catalog:read");
  await assertStoreAccess(actor, storeId);
  rateLimit(`products:list:${actor.tenantId}`, 240);

  const pagination = parsePagination(request.nextUrl.searchParams);
  const query = listQuerySchema.parse(Object.fromEntries(request.nextUrl.searchParams));

  const page = await listProducts(storeId, {
    q: query.q,
    categoryId: query.categoryId,
    status: query.status,
    cursor: pagination.cursor,
    limit: pagination.limit,
  });

  return ok(page.items, { meta: { nextCursor: page.nextCursor, hasMore: page.hasMore } });
});

export const POST = route(async (request: NextRequest, context: StoreRouteContext) => {
  const { storeId } = await context.params;

  assertCsrf(request);
  const user = await authenticateRequest(request);
  const actor = await resolveApiActor(request, user);
  rateLimit(`products:create:${actor.tenantId}`, 60);

  const input = await parseBody(request, productInputSchema);
  const product = await createProduct(actor, storeId, input, { ip: clientIp(request) });

  return ok(product, { status: 201 });
});
