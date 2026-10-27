import { createHash, randomUUID } from "node:crypto";
import type { PrismaService } from "../database/prisma.service";
import type { Prisma } from "../generated/prisma/client";

/**
 * Post-transition side effects for orders, ported from the Next.js services so
 * the Nest path settles the same way:
 *
 * - platform overage fee + third-party courier fee (fee-service)
 * - coupon reservation release on cancellation (coupon-service)
 * - merchant webhook enqueue (webhook-service)
 * - in-app notification (notifications)
 *
 * These run after the status/event/inventory transaction, mirroring the Next
 * `applyTransition`, and are written to be idempotent.
 */

const COURIER_FEE_RATE = 0.005;
const SUCCESSFUL_ORDER_STATUSES = ["PAID", "CONFIRMED", "PROCESSING", "SHIPPED", "DELIVERED"] as const;

type MoneyLine = { lineTotal: unknown; discountTotal: unknown; quantity: number; refundedQty: number };

// ---- money helpers (BDT, 2 decimals, integer paisa) ----

function toPaisa(value: unknown): bigint {
  const raw = typeof value === "string" ? value : String(value);
  const match = /^(-?\d+)(?:\.(\d{1,2}))?$/.exec(raw.trim());
  if (!match) return 0n;
  const rupees = BigInt(match[1]!.replace(/^-/, ""));
  const paisa = BigInt((match[2] ?? "").padEnd(2, "0"));
  const negative = match[1]!.startsWith("-");
  return (negative ? -1n : 1n) * (rupees * 100n + paisa);
}

function fromPaisa(value: bigint): string {
  const negative = value < 0n;
  const abs = negative ? -value : value;
  return `${negative ? "-" : ""}${abs / 100n}.${(abs % 100n).toString().padStart(2, "0")}`;
}

function rateOf(base: string, rate: number): string {
  return fromPaisa(BigInt(Math.round(Number(toPaisa(base)) * rate)));
}

export function computeFeeBase(items: MoneyLine[]): string {
  let base = 0n;
  for (const item of items) {
    const keep = item.quantity - item.refundedQty;
    if (keep <= 0) continue;
    const effective = toPaisa(item.lineTotal) - toPaisa(item.discountTotal);
    base += (effective * BigInt(keep)) / BigInt(item.quantity);
  }
  return fromPaisa(base < 0n ? 0n : base);
}

function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function endOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999);
}

async function feePlan(prisma: PrismaService, tenantId: string): Promise<{
  overageRate: number;
  monthlyOrders: number | null;
  periodStart: Date;
  periodEnd: Date;
}> {
  const subscription = await prisma.subscription.findUnique({
    where: { tenantId },
    include: { plan: { select: { limitsJson: true } } },
  });
  const limits = (subscription?.plan?.limitsJson ?? {}) as {
    overageRate?: unknown;
    monthlyOrders?: unknown;
  };
  const now = new Date();
  return {
    overageRate: typeof limits.overageRate === "number" ? limits.overageRate : 0,
    monthlyOrders:
      limits.monthlyOrders === null || limits.monthlyOrders === undefined
        ? null
        : Number(limits.monthlyOrders),
    periodStart: subscription?.currentPeriodStart ?? startOfMonth(now),
    periodEnd: subscription?.currentPeriodEnd ?? endOfMonth(now),
  };
}

// ---- fees ----

async function applyOverageFee(prisma: PrismaService, orderId: string): Promise<void> {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      items: true,
      store: { select: { id: true, tenantId: true } },
    },
  });
  if (!order) return;

  const existing = await prisma.feeLedger.findFirst({
    where: { orderId, feeType: "PLATFORM_OVERAGE" },
  });

  const eligible = (SUCCESSFUL_ORDER_STATUSES as readonly string[]).includes(order.status);
  if (!eligible) {
    if (existing && !existing.reversedAt) {
      await prisma.feeLedger.update({
        where: { id: existing.id },
        data: { reversedAt: new Date(), status: "VOID" },
      });
    }
    return;
  }

  const { overageRate, monthlyOrders, periodStart, periodEnd } = await feePlan(
    prisma,
    order.store.tenantId,
  );
  const baseAmount = computeFeeBase(order.items as MoneyLine[]);

  let ordinal = 1;
  if (monthlyOrders !== null) {
    const eligibleOrders = await prisma.order.findMany({
      where: {
        store: { tenantId: order.store.tenantId },
        placedAt: { gte: periodStart, lte: periodEnd },
        status: { in: [...SUCCESSFUL_ORDER_STATUSES] },
        deletedAt: null,
      },
      orderBy: [{ placedAt: "asc" }, { id: "asc" }],
      select: { id: true },
    });
    ordinal = eligibleOrders.findIndex((o) => o.id === orderId) + 1;
  }

  const withinQuota = monthlyOrders === null || ordinal <= monthlyOrders;
  if (withinQuota || overageRate <= 0) {
    if (existing && !existing.reversedAt) {
      await prisma.feeLedger.update({
        where: { id: existing.id },
        data: { reversedAt: new Date(), status: "VOID" },
      });
    }
    return;
  }

  const feeAmount = rateOf(baseAmount, overageRate);
  if (existing) {
    await prisma.feeLedger.update({
      where: { id: existing.id },
      data: {
        baseAmount: baseAmount as never,
        rate: overageRate as never,
        feeAmount: feeAmount as never,
        reversedAt: null,
      },
    });
  } else {
    await prisma.feeLedger.create({
      data: {
        tenantId: order.store.tenantId,
        storeId: order.store.id,
        orderId,
        feeType: "PLATFORM_OVERAGE",
        baseAmount: baseAmount as never,
        rate: overageRate as never,
        feeAmount: feeAmount as never,
      },
    });
  }
}

async function applyCourierFee(prisma: PrismaService, orderId: string): Promise<void> {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { items: true, store: { select: { id: true, tenantId: true, settings: true } } },
  });
  if (!order) return;

  const checkout = (order.store.settings?.checkoutJson ?? {}) as Record<string, unknown>;
  const thirdParty = checkout.courierMode === "THIRD_PARTY";
  const eligible = (SUCCESSFUL_ORDER_STATUSES as readonly string[]).includes(order.status);

  const existing = await prisma.feeLedger.findFirst({
    where: { orderId, feeType: "COURIER_THIRD_PARTY" },
  });

  if (!thirdParty || !eligible) {
    if (existing && !existing.reversedAt) {
      await prisma.feeLedger.update({
        where: { id: existing.id },
        data: { reversedAt: new Date(), status: "VOID" },
      });
    }
    return;
  }

  const baseAmount = computeFeeBase(order.items as MoneyLine[]);
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
}

export async function applyAllOrderFees(prisma: PrismaService, orderId: string): Promise<void> {
  await applyOverageFee(prisma, orderId);
  await applyCourierFee(prisma, orderId);
}

export async function reverseFeesForOrder(prisma: PrismaService, orderId: string): Promise<void> {
  await prisma.feeLedger.updateMany({
    where: { orderId, reversedAt: null },
    data: { status: "VOID", reversedAt: new Date() },
  });
}

// ---- coupon ----

export async function releaseCouponReservation(prisma: PrismaService, orderId: string): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const order = await tx.order.findUnique({
      where: { id: orderId },
      select: { storeId: true, couponCode: true, couponRedeemedAt: true, couponReleasedAt: true },
    });
    if (!order?.couponCode || order.couponRedeemedAt || order.couponReleasedAt) return;

    const claimed = await tx.order.updateMany({
      where: { id: orderId, couponRedeemedAt: null, couponReleasedAt: null },
      data: { couponReleasedAt: new Date() },
    });
    if (claimed.count === 0) return;

    await tx.$executeRaw`
      UPDATE "Coupon"
         SET "reservedCount" = GREATEST("reservedCount" - 1, 0)
       WHERE "storeId" = ${order.storeId} AND "code" = ${order.couponCode}
    `;
  });
}

// ---- merchant webhook ----

export async function enqueueMerchantWebhook(
  prisma: PrismaService,
  tenantId: string,
  eventType: string,
  data: Record<string, unknown>,
): Promise<void> {
  const endpoints = await prisma.webhookEndpoint.findMany({
    where: { tenantId, isActive: true },
  });
  const subscribed = endpoints.filter(
    (endpoint) => endpoint.eventTypes.length === 0 || endpoint.eventTypes.includes(eventType),
  );
  if (subscribed.length === 0) return;

  const payload = {
    id: `evt_${randomUUID()}`,
    event: eventType,
    createdAt: new Date().toISOString(),
    data,
  };
  const payloadHash = createHash("sha256").update(JSON.stringify(payload)).digest("hex");

  await prisma.$transaction(
    subscribed.map((endpoint) =>
      prisma.webhookDelivery.create({
        data: {
          tenantId,
          endpointId: endpoint.id,
          eventType,
          endpoint: endpoint.url,
          payloadJson: payload as Prisma.InputJsonValue,
          payloadHash,
          status: "PENDING",
        },
      }),
    ),
  );
}

// ---- notification ----

export async function notifyInApp(
  prisma: PrismaService,
  userId: string,
  type: string,
  title: string,
  body?: string,
  payload: Record<string, unknown> = {},
): Promise<void> {
  await prisma.notification.create({
    data: {
      userId,
      type,
      title,
      body,
      payloadJson: payload as Prisma.InputJsonValue,
    },
  });
}
