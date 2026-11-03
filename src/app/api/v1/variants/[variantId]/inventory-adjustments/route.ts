import { type NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { NotFoundError } from "@/lib/errors";
import { assertCsrf } from "@/lib/auth/session";
import { ok, parseBody, rateLimitForTenant, route } from "@/lib/api";
import { assertApiAccess, loadEntitlementSnapshot } from "@/lib/entitlements";
import { assertStoreAccess, authorizeApiRequest } from "@/lib/tenant";
import { getProduct, adjustVariantStock } from "@/lib/services/catalog-service";

/**
 * PRD §11.3 `POST /variants/{variantId}/inventory-adjustments`.
 *
 * Stock is never overwritten directly: a signed delta + reason produces an
 * inventory movement row, so the ledger explains every unit (FR-03).
 */

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type VariantRouteContext = { params: Promise<{ variantId: string }> };

const adjustmentSchema = z.object({
  delta: z.number().int().min(-1_000_000).max(1_000_000).refine((value) => value !== 0, {
    message: "delta শূন্য হতে পারে না।",
  }),
  reason: z.string().trim().min(3).max(240),
});

export const POST = route(async (request: NextRequest, context: VariantRouteContext) => {
  const { variantId } = await context.params;
  assertCsrf(request);
  const { actor } = await authorizeApiRequest(request);

  const variant = await prisma.productVariant.findFirst({
    where: { id: variantId, product: { deletedAt: null } },
    select: { productId: true, product: { select: { storeId: true } } },
  });
  if (!variant) throw new NotFoundError("Variant");
  const storeId = variant.product.storeId;
  await assertStoreAccess(actor, storeId);
  const snapshot = await loadEntitlementSnapshot(actor.tenantId);
  assertApiAccess(snapshot);
  await rateLimitForTenant(actor.tenantId, "inventory:adjust");

  const input = await parseBody(request, adjustmentSchema);
  const result = await adjustVariantStock(actor, storeId, variantId, input);
  return ok({ ...result, variantId, storeId });
});

/** Convenience read of the parent product, useful to clients after a failure. */
export const GET = route(async (request: NextRequest, context: VariantRouteContext) => {
  const { variantId } = await context.params;
  const { actor } = await authorizeApiRequest(request);
  const variant = await prisma.productVariant.findFirst({
    where: { id: variantId, product: { deletedAt: null } },
    select: { productId: true, product: { select: { storeId: true } } },
  });
  if (!variant) throw new NotFoundError("Variant");
  await assertStoreAccess(actor, variant.product.storeId);
  const snapshot = await loadEntitlementSnapshot(actor.tenantId);
  assertApiAccess(snapshot);
  await rateLimitForTenant(actor.tenantId, "inventory:read");

  return ok(await getProduct(variant.product.storeId, variant.productId));
});
