import { prisma } from "@/lib/db";
import { feeBase as feeBaseOf, fromPaisa, rateOf, toPaisa, type MoneyInput } from "@/lib/money";
import { loadEntitlementSnapshot } from "@/lib/entitlements";
import { isSuccessfulSaleStatus, SUCCESSFUL_ORDER_STATUSES } from "@/lib/order-status";

/**
 * Platform fee ledger (PRD §5.1 "Important fee semantics", US-03).
 *
 * Rules implemented here:
 *  - A fee is only created for a *successful* order: paid, or a COD order the
 *    merchant confirmed. Cancelled and fully refunded orders create no fee.
 *  - The fee base is the discount-adjusted merchandise subtotal, excluding
 *    delivery and refunded lines (PRD Appendix B).
 *  - Overage applies only once the order count for the billing period exceeds
 *    the plan's included quota, and the fee is 2.5% / 2% / 1% / 0% accordingly.
 *  - Gateway processing fees are never mixed into this ledger: they are a
 *    separate `GATEWAY_PASSTHROUGH` type, and the third-party courier charge is
 *    its own `COURIER_THIRD_PARTY` type so nothing is double counted.
 *  - The ledger is append-only. Reversals set `reversedAt`, they never delete.
 */

export type Tx = Omit<
  typeof prisma,
  "$connect" | "$disconnect" | "$on" | "$transaction" | "$extends"
>;

/** Statuses that count as a completed sale for fee purposes. */
export const FEE_ELIGIBLE_STATUSES = SUCCESSFUL_ORDER_STATUSES;

/** Third-party courier payment charge (PRD §5.1). */
export const COURIER_FEE_RATE = 0.005;

function isFeeEligible(status: string): boolean {
  return isSuccessfulSaleStatus(status);
}

/**
 * Merchandise base for fee purposes, derived from immutable order line
 * snapshots so that later catalog edits cannot change a historical fee.
 */
export function computeFeeBase(
  items: Array<{
    lineTotal: MoneyInput;
    discountTotal: MoneyInput;
    quantity: number;
    refundedQty: number;
  }>,
): string {
  let basePaisa = 0n;
  for (const item of items) {
    const keep = item.quantity - item.refundedQty;
    if (keep <= 0) continue;
    const effective = toPaisa(item.lineTotal) - toPaisa(item.discountTotal);
    // Integer division keeps this deterministic; the remainder is truncated.
    basePaisa += (effective * BigInt(keep)) / BigInt(item.quantity);
  }
  return fromPaisa(basePaisa < 0n ? 0n : basePaisa);
}

export type OrderFeeOutcome = {
  applied: boolean;
  reason: string;
  feeAmount?: string;
  rate?: number;
  baseAmount?: string;
};

/**
 * Idempotently (re)calculate the platform overage fee for one order.
 * Safe to call on every status transition, payment confirmation and refund.
 */
export async function applyOrderFees(orderId: string): Promise<OrderFeeOutcome> {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      items: true,
      store: { select: { id: true, tenantId: true } },
    },
  });
  if (!order) return { applied: false, reason: "ORDER_NOT_FOUND" };

  const existing = await prisma.feeLedger.findFirst({
    where: { orderId, feeType: "PLATFORM_OVERAGE" },
  });

  if (!isFeeEligible(order.status)) {
    if (existing && !existing.reversedAt) {
      await prisma.feeLedger.update({
        where: { id: existing.id },
        data: { reversedAt: new Date(), status: "VOID" },
      });
    }
    return { applied: false, reason: `STATUS_${order.status}_NOT_FEE_ELIGIBLE` };
  }

  const snapshot = await loadEntitlementSnapshot(order.store.tenantId);
  const included = snapshot.limits.monthlyOrders;
  const baseAmount = computeFeeBase(order.items);

  // Position of this order among eligible orders in the current billing period.
  let ordinal = 1;
  if (included !== null) {
    const eligible = await prisma.order.findMany({
      where: {
        store: { tenantId: order.store.tenantId },
        placedAt: { gte: snapshot.currentPeriodStart, lte: snapshot.currentPeriodEnd },
        status: { in: [...FEE_ELIGIBLE_STATUSES] },
        deletedAt: null,
      },
      orderBy: [{ placedAt: "asc" }, { id: "asc" }],
      select: { id: true },
    });
    ordinal = eligible.findIndex((o) => o.id === orderId) + 1;
  }

  const withinQuota = included === null || ordinal <= included;
  const rate = snapshot.overageRate;

  if (withinQuota || rate <= 0) {
    if (existing && !existing.reversedAt) {
      await prisma.feeLedger.update({
        where: { id: existing.id },
        data: { reversedAt: new Date(), status: "VOID" },
      });
    }
    return { applied: false, reason: withinQuota ? "WITHIN_INCLUDED_QUOTA" : "ZERO_RATE" };
  }

  const feeAmount = rateOf(baseAmount, rate);

  if (existing) {
    await prisma.feeLedger.update({
      where: { id: existing.id },
      data: {
        baseAmount: baseAmount as never,
        rate: rate as never,
        feeAmount: feeAmount as never,
        status: existing.status === "INVOICED" ? "INVOICED" : "PENDING",
        reversedAt: null,
      },
    });
    return { applied: true, reason: "RECALCULATED", feeAmount, rate, baseAmount };
  }

  await prisma.feeLedger.create({
    data: {
      tenantId: order.store.tenantId,
      storeId: order.store.id,
      orderId,
      feeType: "PLATFORM_OVERAGE",
      baseAmount: baseAmount as never,
      rate: rate as never,
      feeAmount: feeAmount as never,
    },
  });

  return { applied: true, reason: "CREATED", feeAmount, rate, baseAmount };
}

/** The 0.5% third-party courier charge, kept as its own ledger type. */
export async function applyCourierFee(orderId: string): Promise<OrderFeeOutcome> {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      items: true,
      store: { select: { id: true, tenantId: true, settings: true } },
    },
  });
  if (!order) return { applied: false, reason: "ORDER_NOT_FOUND" };

  const checkout = (order.store.settings?.checkoutJson ?? {}) as Record<string, unknown>;
  const usesThirdPartyCourier = checkout.courierMode === "THIRD_PARTY";

  const existing = await prisma.feeLedger.findFirst({
    where: { orderId, feeType: "COURIER_THIRD_PARTY" },
  });

  if (!usesThirdPartyCourier || !isFeeEligible(order.status)) {
    if (existing && !existing.reversedAt) {
      await prisma.feeLedger.update({
        where: { id: existing.id },
        data: { reversedAt: new Date(), status: "VOID" },
      });
    }
    return { applied: false, reason: usesThirdPartyCourier ? "NOT_ELIGIBLE" : "NO_THIRD_PARTY_COURIER" };
  }

  const baseAmount = computeFeeBase(order.items ?? []);
  const feeAmount = rateOf(baseAmount, COURIER_FEE_RATE);

  if (existing) {
    await prisma.feeLedger.update({
      where: { id: existing.id },
      data: { baseAmount: baseAmount as never, feeAmount: feeAmount as never, reversedAt: null },
    });
  } else {
    await prisma.feeLedger.create({
      data: {
        tenantId: order.store.tenantId,
        storeId: order.store.id,
        orderId,
        feeType: "COURIER_THIRD_PARTY",
        baseAmount: baseAmount as never,
        rate: COURIER_FEE_RATE as never,
        feeAmount: feeAmount as never,
      },
    });
  }

  return { applied: true, reason: "CREATED", feeAmount, rate: COURIER_FEE_RATE, baseAmount };
}

/** Both fee types, in the order the PRD presents them. */
export async function applyAllOrderFees(orderId: string) {
  const overage = await applyOrderFees(orderId);
  const courier = await applyCourierFee(orderId);
  return { overage, courier };
}

export async function reverseFeesForOrder(orderId: string, reason: string): Promise<number> {
  const result = await prisma.feeLedger.updateMany({
    where: { orderId, reversedAt: null },
    data: { status: "VOID", reversedAt: new Date() },
  });
  if (result.count > 0) {
    console.info(`[fees] reversed ${result.count} ledger rows for order ${orderId}: ${reason}`);
  }
  return result.count;
}

export type FeeSummary = {
  pending: string;
  invoiced: string;
  reversed: string;
  byType: Array<{ feeType: string; amount: string; count: number }>;
};

export async function feeSummary(
  tenantId: string,
  range: { from?: Date; to?: Date } = {},
): Promise<FeeSummary> {
  const rows = await prisma.feeLedger.findMany({
    where: {
      tenantId,
      createdAt: {
        ...(range.from ? { gte: range.from } : {}),
        ...(range.to ? { lte: range.to } : {}),
      },
    },
    select: { feeType: true, feeAmount: true, status: true, reversedAt: true },
  });

  let pending = 0n;
  let invoiced = 0n;
  let reversed = 0n;
  const byType = new Map<string, { amount: bigint; count: number }>();

  for (const row of rows) {
    const amount = toPaisa(row.feeAmount);
    if (row.reversedAt) {
      reversed += amount;
      continue;
    }
    if (row.status === "INVOICED") invoiced += amount;
    else pending += amount;

    const bucket = byType.get(row.feeType) ?? { amount: 0n, count: 0 };
    byType.set(row.feeType, { amount: bucket.amount + amount, count: bucket.count + 1 });
  }

  return {
    pending: fromPaisa(pending),
    invoiced: fromPaisa(invoiced),
    reversed: fromPaisa(reversed),
    byType: [...byType.entries()].map(([feeType, value]) => ({
      feeType,
      amount: fromPaisa(value.amount),
      count: value.count,
    })),
  };
}

export async function listFeeLedger(
  tenantId: string,
  options: { limit?: number; status?: "PENDING" | "INVOICED" | "VOID" } = {},
) {
  return prisma.feeLedger.findMany({
    where: { tenantId, ...(options.status ? { status: options.status } : {}) },
    orderBy: { createdAt: "desc" },
    take: options.limit ?? 100,
    include: {
      order: { select: { id: true, orderNo: true, grandTotal: true } },
      store: { select: { name: true, slug: true } },
    },
  });
}

/**
 * Attach all PENDING fee rows in a period to an invoice. Called during monthly
 * billing so the merchant's invoice shows the order references behind each fee.
 */
export async function attachPendingFeesToInvoice(
  tx: Tx,
  tenantId: string,
  invoiceId: string,
  periodStart: Date,
  periodEnd: Date,
): Promise<{ total: string; count: number }> {
  const rows = await tx.feeLedger.findMany({
    where: {
      tenantId,
      status: "PENDING",
      reversedAt: null,
      createdAt: { gte: periodStart, lte: periodEnd },
    },
    select: { id: true, feeAmount: true },
  });

  if (rows.length === 0) return { total: "0.00", count: 0 };

  const total = rows.reduce((acc, row) => acc + toPaisa(row.feeAmount), 0n);

  await tx.feeLedger.updateMany({
    where: { id: { in: rows.map((row) => row.id) } },
    data: { status: "INVOICED", invoiceId },
  });

  return { total: fromPaisa(total), count: rows.length };
}

export { feeBaseOf };
