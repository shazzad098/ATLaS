import { type NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { NotFoundError } from "@/lib/errors";
import { assertCsrf } from "@/lib/auth/session";
import { ok, parseBody, rateLimitForTenant, route } from "@/lib/api";
import { assertApiAccess, loadEntitlementSnapshot } from "@/lib/entitlements";
import { assertPermission } from "@/lib/rbac";
import { assertStoreAccess, authorizeApiRequest } from "@/lib/tenant";
import { getProduct, patchProduct, productInputSchema } from "@/lib/services/catalog-service";

/**
 * PRD §11.3 `PATCH /products/{productId}`.
 * The store is resolved from the product row, then the normal tenant guard runs.
 */

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type ProductRouteContext = { params: Promise<{ productId: string }> };

async function resolveStoreId(productId: string): Promise<string> {
  const product = await prisma.product.findFirst({
    where: { id: productId, deletedAt: null },
    select: { storeId: true },
  });
  if (!product) throw new NotFoundError("Product");
  return product.storeId;
}

export const GET = route(async (request: NextRequest, context: ProductRouteContext) => {
  const { productId } = await context.params;
  const { actor } = await authorizeApiRequest(request);
  const storeId = await resolveStoreId(productId);
  assertPermission(actor, "catalog:read");
  await assertStoreAccess(actor, storeId);
  const snapshot = await loadEntitlementSnapshot(actor.tenantId);
  assertApiAccess(snapshot);
  await rateLimitForTenant(actor.tenantId, "products:read");

  return ok(await getProduct(storeId, productId));
});

export const PATCH = route(async (request: NextRequest, context: ProductRouteContext) => {
  const { productId } = await context.params;
  assertCsrf(request);
  const { actor } = await authorizeApiRequest(request);
  const storeId = await resolveStoreId(productId);
  await assertStoreAccess(actor, storeId);
  const snapshot = await loadEntitlementSnapshot(actor.tenantId);
  assertApiAccess(snapshot);
  await rateLimitForTenant(actor.tenantId, "products:update");

  // Partial schema: omitted fields keep their current value.
  const body = await parseBody(request, productInputSchema.partial());
  const product = await patchProduct(actor, storeId, productId, body);
  return ok(product);
});
