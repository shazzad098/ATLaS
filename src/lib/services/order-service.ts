import { prisma } from "@/lib/db";
import { AppError, ConflictError, NotFoundError } from "@/lib/errors";
import { addMoney, formatBdt, fromPaisa, toPaisa, type MoneyInput } from "@/lib/money";
import type { ActorContext } from "@/lib/rbac";
import { assertPermission } from "@/lib/rbac";
import { assertStoreAccess } from "@/lib/tenant";
import { recordAudit } from "@/lib/audit";
import { notify, NOTIFICATION_TYPES } from "@/lib/notifications";
import {
  commitReservedSale,
  releaseReservation,
  restockVariant,
} from "@/lib/services/inventory-service";
import { applyAllOrderFees, reverseFeesForOrder } from "@/lib/services/fee-service";
import { releaseCouponReservation } from "@/lib/services/coupon-service";
import { isSuccessfulSaleStatus } from "@/lib/order-status";

/**
 * Orders (FR-04).
 *
 * Status is a guarded state machine; every transition writes an `OrderEvent`
 * with actor + timestamp. Line data is snapshotted onto the order, so later
 * catalog edits cannot rewrite history (PRD FR-04 "Immutable order snapshot").
 */

export const ORDER_STATUSES = [
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
] as const;

export type OrderStatusValue = (typeof ORDER_STATUSES)[number];

/** PRD FR-04 transition table. Anything not listed here is rejected. */
export const ORDER_TRANSITIONS: Record<OrderStatusValue, OrderStatusValue[]> = {
  PENDING_PAYMENT: ["PAID", "CONFIRMED", "CANCELLED"],
  PAID: ["CONFIRMED", "CANCELLED", "REFUNDED"],
  CONFIRMED: ["PROCESSING", "SHIPPED", "CANCELLED", "REFUNDED"],
  PROCESSING: ["SHIPPED", "CANCELLED", "REFUNDED"],
  SHIPPED: ["DELIVERED", "RETURN_REQUESTED", "REFUNDED"],
  DELIVERED: ["RETURN_REQUESTED", "REFUNDED"],
  RETURN_REQUESTED: ["RETURNED", "DELIVERED", "REFUNDED"],
  RETURNED: ["REFUNDED"],
  CANCELLED: [],
  REFUNDED: [],
};

export const ORDER_STATUS_LABELS: Record<OrderStatusValue, string> = {
  PENDING_PAYMENT: "পেমেন্টের অপেক্ষায়",
  PAID: "পরিশোধিত",
  CONFIRMED: "নিশ্চিত",
  PROCESSING: "প্রস্তুত হচ্ছে",
  SHIPPED: "পাঠানো হয়েছে",
  DELIVERED: "ডেলিভার হয়েছে",
  CANCELLED: "বাতিল",
  REFUNDED: "ফেরত দেওয়া হয়েছে",
  RETURN_REQUESTED: "ফেরতের অনুরোধ",
  RETURNED: "ফেরত এসেছে",
};

/** Statuses where the merchant has taken ownership of the order. */
const COMMITTED_STATUSES: OrderStatusValue[] = ["CONFIRMED", "PROCESSING", "SHIPPED", "DELIVERED"];

export function canTransition(from: string, to: string): boolean {
  const allowed = ORDER_TRANSITIONS[from as OrderStatusValue];
  return Boolean(allowed?.includes(to as OrderStatusValue));
}

export function allowedNextStatuses(from: string): OrderStatusValue[] {
  return ORDER_TRANSITIONS[from as OrderStatusValue] ?? [];
}

export async function listOrders(
  storeId: string,
  options: {
    status?: string;
    paymentStatus?: string;
    q?: string;
    cursor?: string | null;
    limit?: number;
    from?: Date;
    to?: Date;
  } = {},
) {
  const limit = options.limit ?? 20;
  const rows = await prisma.order.findMany({
    where: {
      storeId,
      deletedAt: null,
      ...(options.status ? { status: options.status as never } : {}),
      ...(options.paymentStatus ? { paymentStatus: options.paymentStatus as never } : {}),
      ...(options.from || options.to
        ? {
            placedAt: {
              ...(options.from ? { gte: options.from } : {}),
              ...(options.to ? { lte: options.to } : {}),
            },
          }
        : {}),
      ...(options.q
        ? {
            OR: [
              { orderNo: { contains: options.q, mode: "insensitive" as const } },
              { customerName: { contains: options.q, mode: "insensitive" as const } },
              { customerPhone: { contains: options.q } },
            ],
          }
        : {}),
    },
    orderBy: [{ placedAt: "desc" }, { id: "desc" }],
    take: limit + 1,
    ...(options.cursor ? { cursor: { id: options.cursor }, skip: 1 } : {}),
    include: { _count: { select: { items: true } } },
  });

  const hasMore = rows.length > limit;
  const items = hasMore ? rows.slice(0, limit) : rows;
  return { items, nextCursor: hasMore ? items[items.length - 1].id : null, hasMore };
}

export async function getOrderDetail(storeId: string, idOrNo: string) {
  const order = await prisma.order.findFirst({
    where: { storeId, OR: [{ id: idOrNo }, { orderNo: idOrNo }] },
    include: {
      items: true,
      events: { orderBy: { createdAt: "asc" } },
      payments: { orderBy: { createdAt: "desc" } },
      returns: { orderBy: { requestedAt: "desc" } },
      customer: true,
      feeLedger: true,
    },
  });
  if (!order) throw new NotFoundError("Order");
  return order;
}

export async function countsByStatus(storeId: string) {
  const rows = await prisma.order.groupBy({
    by: ["status"],
    where: { storeId, deletedAt: null },
    _count: { _all: true },
    _sum: { grandTotal: true },
  });
  return rows;
}

export type TransitionInput = {
  status: OrderStatusValue;
  note?: string;
  /** SYSTEM for payment callbacks and automated sweeps. */
  actorType?: "STAFF" | "SYSTEM" | "CUSTOMER";
};

/**
 * Applies a status change plus all of its side effects:
 * inventory, platform fees, notifications and audit.
 */
export async function updateOrderStatus(
  actor: ActorContext,
  storeId: string,
  orderId: string,
  input: TransitionInput,
) {
  assertPermission(actor, "orders:write");
  await assertStoreAccess(actor, storeId);

  const order = await prisma.order.findFirst({
    where: { id: orderId, storeId },
    include: { items: true },
  });
  if (!order) throw new NotFoundError("Order");

  if (!canTransition(order.status, input.status)) {
    throw new AppError(
      "VALIDATION_FAILED",
      `${ORDER_STATUS_LABELS[order.status as OrderStatusValue]} থেকে ${ORDER_STATUS_LABELS[input.status]}-এ যাওয়া যাবে না।`,
      422,
      { from: order.status, to: input.status, allowed: allowedNextStatuses(order.status) },
    );
  }

  await applyTransition({
    orderId,
    from: order.status as OrderStatusValue,
    to: input.status,
    actorType: input.actorType ?? "STAFF",
    actorId: actor.userId,
    note: input.note,
    items: order.items,
    storeId,
  });

  await recordAudit({
    action: "order.status_changed",
    tenantId: actor.tenantId,
    actorId: actor.userId,
    resourceType: "Order",
    resourceId: orderId,
    metadata: { from: order.status, to: input.status, note: input.note },
  });

  return getOrderDetail(storeId, orderId);
}

/** Shared transition engine used by staff actions, payment callbacks and jobs. */
export async function applyTransition(params: {
  orderId: string;
  from: OrderStatusValue;
  to: OrderStatusValue;
  actorType: "STAFF" | "SYSTEM" | "CUSTOMER";
  actorId?: string | null;
  note?: string;
  items: Array<{ variantId: string | null; quantity: number }>;
  storeId: string;
}): Promise<void> {
  const { orderId, from, to, items } = params;

  await prisma.$transaction(async (tx) => {
    const changed = await tx.order.updateMany({
      where: { id: orderId, status: from },
      data: {
        status: to,
        ...(to === "PAID" ? { paymentStatus: "PAID" } : {}),
        ...(to === "CONFIRMED" ? { confirmedAt: new Date() } : {}),
        ...(to === "DELIVERED"
          ? { deliveredAt: new Date(), fulfillmentStatus: "FULFILLED" }
          : {}),
        ...(to === "CANCELLED" ? { cancelledAt: new Date() } : {}),
        ...(to === "REFUNDED" ? { paymentStatus: "REFUNDED" } : {}),
        ...(to === "RETURN_REQUESTED" ? { fulfillmentStatus: "PARTIAL" } : {}),
        ...(to === "RETURNED" ? { fulfillmentStatus: "RETURNED" } : {}),
        ...(to === "PROCESSING" || to === "SHIPPED" ? { fulfillmentStatus: "PARTIAL" } : {}),
      },
    });
    if (changed.count !== 1) {
      throw new ConflictError("অর্ডারটি অন্য একটি request দ্বারা পরিবর্তিত হয়েছে।", {
        orderId,
        expectedStatus: from,
        requestedStatus: to,
      });
    }

    await tx.orderEvent.create({
      data: {
        orderId,
        fromStatus: from,
        toStatus: to,
        actorType: params.actorType,
        actorId: params.actorId ?? null,
        note: params.note,
      },
    });

    // Inventory side effects.
    if (to === "CONFIRMED") {
      for (const item of items) {
        if (!item.variantId) continue;
        await commitReservedSale(tx, item.variantId, item.quantity, { type: "Order", id: orderId });
      }
    }

    if (to === "CANCELLED") {
      const alreadyCommitted = COMMITTED_STATUSES.includes(from);
      for (const item of items) {
        if (!item.variantId) continue;
        if (alreadyCommitted) {
          await restockVariant(tx, item.variantId, item.quantity, "Order cancelled", {
            type: "Order",
            id: orderId,
          });
        } else {
          await releaseReservation(tx, item.variantId, item.quantity);
        }
      }
    }

    if (to === "RETURNED") {
      for (const item of items) {
        if (!item.variantId) continue;
        await restockVariant(tx, item.variantId, item.quantity, "Return received", {
          type: "Order",
          id: orderId,
        });
      }
    }
  });

  // Fee ledger is outside the transaction because it re-reads the order.
  if (to === "CANCELLED" || to === "REFUNDED") {
    await reverseFeesForOrder(orderId, `Order ${to.toLowerCase()}`);
  } else {
    await applyAllOrderFees(orderId);
  }
  if (to === "CANCELLED") await releaseCouponReservation(orderId);

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: {
      orderNo: true,
      grandTotal: true,
      storeId: true,
      store: { select: { tenantId: true, tenant: { select: { ownerUserId: true } } } },
    },
  });

  if (order) {
    await notifyStoreOwner(order, to);
  }
}

async function notifyStoreOwner(
  order: {
    orderNo: string;
    grandTotal: MoneyInput;
    storeId: string;
    store: { tenantId: string; tenant: { ownerUserId: string } };
  },
  status: OrderStatusValue,
) {
  const userId = order.store.tenant.ownerUserId;

  if (status === "PAID") {
    await notify({
      userId,
      type: NOTIFICATION_TYPES.PAYMENT_RECEIVED,
      title: `পেমেন্ট পাওয়া গেছে — ${order.orderNo}`,
      body: `${formatBdt(order.grandTotal)} পরিশোধিত হয়েছে।`,
      payload: { orderNo: order.orderNo, storeId: order.storeId },
    });
    return;
  }

  if (status === "CANCELLED") {
    await notify({
      userId,
      type: "order.cancelled",
      title: `অর্ডার বাতিল — ${order.orderNo}`,
      payload: { orderNo: order.orderNo, storeId: order.storeId },
    });
  }
}

/** Public order tracking for the storefront success/tracking page. */
export async function findPublicOrder(storeId: string, orderNo: string, phone?: string) {
  const order = await prisma.order.findFirst({
    where: {
      storeId,
      orderNo,
      ...(phone ? { customerPhone: phone } : {}),
    },
    include: {
      items: true,
      events: { orderBy: { createdAt: "asc" } },
    },
  });
  return order;
}

// ── Returns ─────────────────────────────────────────────────────────────────

export async function requestReturn(
  actor: ActorContext,
  storeId: string,
  orderId: string,
  input: { reason: string },
) {
  assertPermission(actor, "orders:write");
  await assertStoreAccess(actor, storeId);
  const order = await prisma.order.findFirst({ where: { id: orderId, storeId }, include: { items: true } });
  if (!order) throw new NotFoundError("Order");

  await prisma.$transaction(async (tx) => {
    await tx.return.create({
      data: { orderId, status: "REQUESTED", reason: input.reason },
    });
  });

  if (order.status === "DELIVERED" || order.status === "SHIPPED") {
    await updateOrderStatus(actor, storeId, orderId, {
      status: "RETURN_REQUESTED",
      note: input.reason,
    });
  } else {
    await applyAllOrderFees(orderId);
  }

  await recordAudit({
    action: "order.return_requested",
    tenantId: actor.tenantId,
    actorId: actor.userId,
    resourceType: "Order",
    resourceId: orderId,
    metadata: { reason: input.reason },
  });

  return getOrderDetail(storeId, orderId);
}

export async function resolveReturn(
  actor: ActorContext,
  storeId: string,
  returnId: string,
  input: { status: "APPROVED" | "REJECTED" | "RECEIVED" | "REFUNDED"; resolution?: string },
) {
  assertPermission(actor, "orders:refund");
  await assertStoreAccess(actor, storeId);

  const record = await prisma.return.findFirst({
    where: { id: returnId, order: { storeId } },
    include: { order: true },
  });
  if (!record) throw new NotFoundError("Return");

  await prisma.return.update({
    where: { id: returnId },
    data: {
      status: input.status,
      resolution: input.resolution,
      ...(input.status === "REFUNDED" ? { resolvedAt: new Date() } : {}),
    },
  });

  if (input.status === "RECEIVED") {
    await updateOrderStatus(actor, storeId, record.orderId, {
      status: "RETURNED",
      note: "Return received",
    });
  }
  if (input.status === "REFUNDED") {
    await updateOrderStatus(actor, storeId, record.orderId, {
      status: "REFUNDED",
      note: input.resolution ?? "Refund issued",
    });
  }

  return getOrderDetail(storeId, record.orderId);
}

// ── Reporting ───────────────────────────────────────────────────────────────

export async function orderMetrics(storeId: string, range: { from: Date; to: Date }) {
  const orders = await prisma.order.findMany({
    where: { storeId, deletedAt: null, placedAt: { gte: range.from, lte: range.to } },
    select: {
      status: true,
      paymentStatus: true,
      paymentProvider: true,
      grandTotal: true,
      subtotal: true,
      discountTotal: true,
      shippingTotal: true,
      placedAt: true,
      items: { select: { quantity: true, nameSnapshot: true, lineTotal: true } },
    },
  });

  let revenue = 0n;
  let revenueOrderCount = 0;
  let refunded = 0n;
  const byStatus = new Map<string, number>();
  const byProvider = new Map<string, number>();
  const byProduct = new Map<string, { qty: number; revenue: bigint }>();
  const byDay = new Map<string, bigint>();

  for (const order of orders) {
    byStatus.set(order.status, (byStatus.get(order.status) ?? 0) + 1);
    byProvider.set(order.paymentProvider, (byProvider.get(order.paymentProvider) ?? 0) + 1);

    if (order.status === "REFUNDED") {
      refunded += toPaisa(order.grandTotal);
      continue;
    }
    if (!isSuccessfulSaleStatus(order.status)) continue;

    revenueOrderCount += 1;
    revenue += toPaisa(order.grandTotal);
    const day = order.placedAt.toISOString().slice(0, 10);
    byDay.set(day, (byDay.get(day) ?? 0n) + toPaisa(order.grandTotal));
    for (const item of order.items) {
      const bucket = byProduct.get(item.nameSnapshot) ?? { qty: 0, revenue: 0n };
      byProduct.set(item.nameSnapshot, {
        qty: bucket.qty + item.quantity,
        revenue: bucket.revenue + toPaisa(item.lineTotal),
      });
    }
  }

  return {
    orderCount: orders.length,
    revenue: fromPaisa(revenue),
    refunded: fromPaisa(refunded),
    averageOrderValue: revenueOrderCount > 0 ? fromPaisa(revenue / BigInt(revenueOrderCount)) : "0.00",
    byStatus: [...byStatus.entries()].map(([status, count]) => ({ status, count })),
    byProvider: [...byProvider.entries()].map(([provider, count]) => ({ provider, count })),
    topProducts: [...byProduct.entries()]
      .map(([name, value]) => ({ name, qty: value.qty, revenue: fromPaisa(value.revenue) }))
      .sort((a, b) => toPaisa(b.revenue) > toPaisa(a.revenue) ? 1 : -1)
      .slice(0, 10),
    byDay: [...byDay.entries()]
      .map(([date, value]) => ({ date, revenue: fromPaisa(value) }))
      .sort((a, b) => a.date.localeCompare(b.date)),
  };
}

export async function recentOrders(storeId: string, limit = 8) {
  return prisma.order.findMany({
    where: { storeId, deletedAt: null },
    orderBy: { placedAt: "desc" },
    take: limit,
    select: {
      id: true,
      orderNo: true,
      customerName: true,
      status: true,
      paymentProvider: true,
      grandTotal: true,
      placedAt: true,
    },
  });
}

export { addMoney };
