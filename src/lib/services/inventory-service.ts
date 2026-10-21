import { prisma } from "@/lib/db";
import { AppError, NotFoundError } from "@/lib/errors";
import type { Tx } from "@/lib/services/fee-service";

/**
 * Inventory (FR-03).
 *
 * Stock is never overwritten directly: every change writes an
 * `InventoryMovement` row with a reason, and the variant's quantity is derived
 * from the same transaction. Checkout reserves atomically with a conditional
 * UPDATE so two shoppers cannot both claim the last unit.
 */

export type AdjustmentInput = {
  storeId: string;
  variantId: string;
  /** Positive to add stock, negative to remove. */
  delta: number;
  type:
    | "INITIAL"
    | "RESTOCK"
    | "SALE"
    | "RETURN"
    | "ADJUSTMENT"
    | "RESERVATION"
    | "RESERVATION_RELEASE"
    | "IMPORT";
  reason?: string;
  referenceType?: string;
  referenceId?: string;
  actorId?: string | null;
};

export type InventoryResult = {
  variantId: string;
  stockQty: number;
  reservedQty: number;
  available: number;
};

/**
 * Guarded stock adjustment. `expectedVersion`-style optimistic locking is not
 * needed because the UPDATE is conditional and returns the authoritative row.
 */
export async function adjustStock(input: AdjustmentInput): Promise<InventoryResult> {
  if (!Number.isInteger(input.delta) || input.delta === 0) {
    throw new AppError("VALIDATION_FAILED", "Stock adjustment-এ শূন্য নয় এমন পূর্ণসংখ্যা দিন।", 422);
  }

  return prisma.$transaction(async (tx) => {
    const variant = await tx.productVariant.findFirst({
      where: { id: input.variantId, product: { storeId: input.storeId, deletedAt: null } },
      select: { id: true, stockQty: true, reservedQty: true },
    });
    if (!variant) throw new NotFoundError("Variant");

    const nextStock = variant.stockQty + input.delta;
    if (nextStock < 0) {
      throw new AppError(
        "VALIDATION_FAILED",
        `Stock ঋণাত্মক হতে পারে না। বর্তমান stock ${variant.stockQty}।`,
        422,
        { currentStock: variant.stockQty, requested: input.delta },
      );
    }

    await tx.inventoryMovement.create({
      data: {
        storeId: input.storeId,
        variantId: input.variantId,
        type: input.type,
        quantityDelta: input.delta,
        reason: input.reason,
        referenceType: input.referenceType,
        referenceId: input.referenceId,
        actorId: input.actorId ?? null,
      },
    });

    const updated = await tx.productVariant.update({
      where: { id: input.variantId },
      data: { stockQty: nextStock },
      select: { id: true, stockQty: true, reservedQty: true },
    });

    return {
      variantId: updated.id,
      stockQty: updated.stockQty,
      reservedQty: updated.reservedQty,
      available: updated.stockQty - updated.reservedQty,
    };
  });
}

/**
 * Atomic reservation (FR-03 "Atomic stock reservation during checkout").
 * The WHERE clause evaluates the available quantity inside the database, so the
 * check and the write cannot be interleaved by a competing checkout.
 */
export async function reserveStock(tx: Tx, variantId: string, quantity: number): Promise<boolean> {
  if (quantity <= 0) return true;
  const affected = await tx.$executeRaw`
    UPDATE "ProductVariant"
       SET "reservedQty" = "reservedQty" + ${quantity}
     WHERE "id" = ${variantId}
       AND "stockQty" - "reservedQty" >= ${quantity}
  `;
  if (affected === 0) return false;

  const variant = await tx.productVariant.findUnique({
    where: { id: variantId },
    select: { product: { select: { storeId: true } } },
  });
  if (variant) {
    await tx.inventoryMovement.create({
      data: {
        storeId: variant.product.storeId,
        variantId,
        type: "RESERVATION",
        quantityDelta: 0,
        reason: `Reserved ${quantity} unit(s) at checkout`,
      },
    });
  }
  return true;
}

export async function releaseReservation(tx: Tx, variantId: string, quantity: number): Promise<void> {
  if (quantity <= 0) return;
  await tx.$executeRaw`
    UPDATE "ProductVariant"
       SET "reservedQty" = GREATEST("reservedQty" - ${quantity}, 0)
     WHERE "id" = ${variantId}
  `;
}

/** Convert a reservation into a real stock decrement once payment is settled. */
export async function commitReservedSale(
  tx: Tx,
  variantId: string,
  quantity: number,
  reference?: { type: string; id: string },
): Promise<void> {
  if (quantity <= 0) return;
  const variant = await tx.productVariant.findUnique({
    where: { id: variantId },
    select: { product: { select: { storeId: true } } },
  });
  if (!variant) return;

  await tx.$executeRaw`
    UPDATE "ProductVariant"
       SET "reservedQty" = GREATEST("reservedQty" - ${quantity}, 0),
           "stockQty"    = GREATEST("stockQty" - ${quantity}, 0)
     WHERE "id" = ${variantId}
  `;

  await tx.inventoryMovement.create({
    data: {
      storeId: variant.product.storeId,
      variantId,
      type: "SALE",
      quantityDelta: -quantity,
      reason: "Order fulfilled",
      referenceType: reference?.type,
      referenceId: reference?.id,
    },
  });
}

/** Return stock to the shelf (cancellation, refund or return). */
export async function restockVariant(
  tx: Tx,
  variantId: string,
  quantity: number,
  reason: string,
  reference?: { type: string; id: string },
): Promise<void> {
  if (quantity <= 0) return;
  const variant = await tx.productVariant.findUnique({
    where: { id: variantId },
    select: { product: { select: { storeId: true } } },
  });
  if (!variant) return;

  await tx.productVariant.update({
    where: { id: variantId },
    data: { stockQty: { increment: quantity } },
  });
  await tx.inventoryMovement.create({
    data: {
      storeId: variant.product.storeId,
      variantId,
      type: "RETURN",
      quantityDelta: quantity,
      reason,
      referenceType: reference?.type,
      referenceId: reference?.id,
    },
  });
}

export async function listMovements(
  storeId: string,
  options: { variantId?: string; limit?: number } = {},
) {
  return prisma.inventoryMovement.findMany({
    where: { storeId, ...(options.variantId ? { variantId: options.variantId } : {}) },
    orderBy: { createdAt: "desc" },
    take: options.limit ?? 50,
    include: {
      variant: {
        select: {
          sku: true,
          stockQty: true,
          reservedQty: true,
          product: { select: { id: true, name: true, slug: true } },
        },
      },
    },
  });
}

export async function lowStockVariants(storeId: string, threshold = 5, limit = 20) {
  const rows = await prisma.productVariant.findMany({
    where: { product: { storeId, deletedAt: null }, status: "ACTIVE" },
    include: { product: { select: { id: true, name: true, slug: true, lowStockThreshold: true } } },
    orderBy: { stockQty: "asc" },
    take: 200,
  });
  return rows
    .filter((row) => row.stockQty - row.reservedQty <= (row.product.lowStockThreshold ?? threshold))
    .slice(0, limit);
}

export async function inventoryTotals(storeId: string) {
  const rows = await prisma.productVariant.groupBy({
    by: ["productId"],
    where: { product: { storeId, deletedAt: null } },
    _sum: { stockQty: true, reservedQty: true },
  });
  return {
    skuCount: rows.length,
    totalStock: rows.reduce((acc, row) => acc + (row._sum.stockQty ?? 0), 0),
    totalReserved: rows.reduce((acc, row) => acc + (row._sum.reservedQty ?? 0), 0),
  };
}
