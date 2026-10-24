import { prisma } from "@/lib/db";
import { AppError, isAppError, NotFoundError } from "@/lib/errors";
import { createHash } from "node:crypto";
import { compareMoney, fromPaisa, toPaisa } from "@/lib/money";
import { notify, NOTIFICATION_TYPES } from "@/lib/notifications";
import { recordAudit } from "@/lib/audit";
import { getPaymentAdapter } from "@/lib/payments";
import type { PaymentProviderName } from "@/lib/payments";
import { applyTransition } from "@/lib/services/order-service";
import { applyAllOrderFees, reverseFeesForOrder } from "@/lib/services/fee-service";
import { finalizeCouponRedemption, releaseCouponReservation } from "@/lib/services/coupon-service";
import type { ActorContext } from "@/lib/rbac";
import { assertPermission } from "@/lib/rbac";
import { assertStoreAccess } from "@/lib/tenant";
import { getStorePaymentCredentials } from "@/lib/services/store-service";

/**
 * Payment orchestration: webhooks, reconciliation and refunds (FR-05).
 *
 * Webhooks are idempotent by `(provider, eventKey)`, signature-checked, and
 * amount-checked before an order is credited. A mismatch is recorded as a
 * failure rather than silently accepted, and every event is persisted so the
 * Super Admin console can show webhook health (PRD §4.5).
 */

export type WebhookOutcome = {
  received: boolean;
  duplicate: boolean;
  signatureValid: boolean;
  status: string;
  orderNo?: string;
  message?: string;
};

export async function handlePaymentWebhook(
  providerName: string,
  request: Request,
  rawBody: string,
): Promise<WebhookOutcome> {
  const adapter = getPaymentAdapter(providerName);
  const provider = adapter.provider as PaymentProviderName;

  const credentials = await callbackCredentials(provider, request, rawBody);
  const callback = await adapter.parseCallback(request, rawBody, credentials);
  const payloadHash = createHash("sha256").update(rawBody || "").digest("hex");

  // Claim the event before any payment/order side effects. A conditional update
  // prevents two gateway retries from processing the same event concurrently.
  const claim = await claimWebhookEvent({
    provider,
    eventKey: callback.eventKey,
    signatureValid: callback.signatureValid,
    payloadHash,
    payload: callback.raw,
  });
  if (claim.duplicate) {
    return {
      received: true,
      duplicate: true,
      signatureValid: claim.event.signatureValid,
      status: claim.event.status,
      message: "Already processed",
    };
  }
  const event = claim.event;

  if (!callback.signatureValid) {
    await prisma.paymentWebhookEvent.update({
      where: { id: event.id },
      data: { status: "REJECTED_SIGNATURE", processedAt: new Date(), error: "Signature invalid" },
    });
    // PRD US-05: a failed verification leaves the payment pending/failed.
    await markPaymentFailure(callback.providerTxnId, "Signature verification failed");
    return {
      received: true,
      duplicate: false,
      signatureValid: false,
      status: "REJECTED_SIGNATURE",
      message: "Signature invalid",
    };
  }

  const order = await findOrderForCallback(callback.orderNo, callback.providerTxnId);
  if (!order) {
    await prisma.paymentWebhookEvent.update({
      where: { id: event.id },
      data: { status: "ORDER_NOT_FOUND", processedAt: new Date() },
    });
    return {
      received: true,
      duplicate: false,
      signatureValid: true,
      status: "ORDER_NOT_FOUND",
      message: "No matching order",
    };
  }

  if (callback.status === "SUCCEEDED") {
    // Amount check before crediting: a tampered or mis-routed callback must not
    // settle an order for the wrong value.
    if (callback.amount && compareMoney(callback.amount, order.grandTotal) !== 0) {
      await prisma.paymentWebhookEvent.update({
        where: { id: event.id },
        data: { status: "AMOUNT_MISMATCH", processedAt: new Date(), error: "Amount mismatch" },
      });
      await markPaymentFailure(callback.providerTxnId, "Amount mismatch");
      return {
        received: true,
        duplicate: false,
        signatureValid: true,
        status: "AMOUNT_MISMATCH",
        orderNo: order.orderNo,
      };
    }

    await prisma.payment.updateMany({
      where: { orderId: order.id, status: { in: ["INITIATED", "PENDING"] } },
      data: {
        status: "SUCCEEDED",
        providerTxnId: callback.providerTxnId ?? undefined,
        rawReference: JSON.stringify(callback.raw).slice(0, 2000),
      },
    });

    if (order.status === "PENDING_PAYMENT") {
      await applyTransition({
        orderId: order.id,
        from: "PENDING_PAYMENT",
        to: "PAID",
        actorType: "SYSTEM",
        note: `${provider} callback confirmed`,
        items: order.items,
        storeId: order.storeId,
      });
      await finalizeCouponRedemption(order.id);
    } else {
      await applyAllOrderFees(order.id);
    }

    await prisma.paymentWebhookEvent.update({
      where: { id: event.id },
      data: { status: "PROCESSED", processedAt: new Date() },
    });

    return {
      received: true,
      duplicate: false,
      signatureValid: true,
      status: "PROCESSED",
      orderNo: order.orderNo,
    };
  }

  if (callback.status === "FAILED") {
    await markPaymentFailure(callback.providerTxnId, callback.failureReason ?? "Gateway declined");
    await cancelPendingPaymentOrder(order, callback.failureReason ?? "Gateway declined");
    await prisma.paymentWebhookEvent.update({
      where: { id: event.id },
      data: { status: "FAILED", processedAt: new Date(), error: callback.failureReason },
    });

    const store = await prisma.store.findUnique({
      where: { id: order.storeId },
      select: { tenantId: true, tenant: { select: { ownerUserId: true } } },
    });
    if (store) {
      await notify({
        userId: store.tenant.ownerUserId,
        type: NOTIFICATION_TYPES.PAYMENT_FAILED,
        title: `পেমেন্ট ব্যর্থ — ${order.orderNo}`,
        body: callback.failureReason ?? "Gateway declined the payment.",
        payload: { orderId: order.id, storeId: order.storeId },
      });
    }

    return {
      received: true,
      duplicate: false,
      signatureValid: true,
      status: "FAILED",
      orderNo: order.orderNo,
      message: callback.failureReason,
    };
  }

  await prisma.paymentWebhookEvent.update({
    where: { id: event.id },
    data: { status: "PENDING", processedAt: new Date() },
  });
  return {
    received: true,
    duplicate: false,
    signatureValid: true,
    status: "PENDING",
    orderNo: order.orderNo,
  };
}

async function claimWebhookEvent(input: {
  provider: PaymentProviderName;
  eventKey: string;
  signatureValid: boolean;
  payloadHash: string;
  payload: Record<string, unknown>;
}) {
  const existing = await prisma.paymentWebhookEvent.findUnique({
    where: { provider_eventKey: { provider: input.provider, eventKey: input.eventKey } },
  });
  if (existing?.processedAt) return { event: existing, duplicate: true } as const;

  const staleBefore = new Date(Date.now() - 10 * 60_000);
  if (existing) {
    const claimed = await prisma.paymentWebhookEvent.updateMany({
      where: {
        id: existing.id,
        processedAt: null,
        OR: [{ status: { not: "PROCESSING" } }, { updatedAt: { lt: staleBefore } }],
      },
      data: {
        status: "PROCESSING",
        signatureValid: input.signatureValid,
        payloadHash: input.payloadHash,
        payloadJson: input.payload as never,
      },
    });
    if (claimed.count === 0) return { event: existing, duplicate: true } as const;
    return {
      event: await prisma.paymentWebhookEvent.findUniqueOrThrow({ where: { id: existing.id } }),
      duplicate: false,
    } as const;
  }

  try {
    const event = await prisma.paymentWebhookEvent.create({
      data: {
        provider: input.provider,
        eventKey: input.eventKey,
        signatureValid: input.signatureValid,
        payloadHash: input.payloadHash,
        payloadJson: input.payload as never,
        status: "PROCESSING",
      },
    });
    return { event, duplicate: false } as const;
  } catch (error) {
    // Another request may have won the unique insert race. Re-read and claim it
    // through the same conditional path instead of surfacing a 500 to the gateway.
    const raced = await prisma.paymentWebhookEvent.findUnique({
      where: { provider_eventKey: { provider: input.provider, eventKey: input.eventKey } },
    });
    if (!raced) throw error;
    if (raced.processedAt) return { event: raced, duplicate: true } as const;
    const claimed = await prisma.paymentWebhookEvent.updateMany({
      where: { id: raced.id, processedAt: null, status: { not: "PROCESSING" } },
      data: {
        status: "PROCESSING",
        signatureValid: input.signatureValid,
        payloadHash: input.payloadHash,
        payloadJson: input.payload as never,
      },
    });
    return {
      event: raced,
      duplicate: claimed.count === 0,
    } as const;
  }
}

async function findOrderForCallback(orderNo: string | null, providerTxnId: string | null) {
  if (orderNo) {
    const byNo = await prisma.order.findFirst({
      where: { orderNo },
      include: { items: true },
    });
    if (byNo) return byNo;
  }
  if (providerTxnId) {
    const payment = await prisma.payment.findFirst({
      where: { providerTxnId },
      include: { order: { include: { items: true } } },
    });
    if (payment) return payment.order;
  }
  return null;
}

async function callbackCredentials(provider: PaymentProviderName, request: Request, rawBody: string) {
  let payload: Record<string, unknown> = {};
  try {
    const parsed = JSON.parse(rawBody || "{}");
    if (parsed && typeof parsed === "object") payload = parsed as Record<string, unknown>;
  } catch {
    payload = Object.fromEntries(new URLSearchParams(rawBody).entries());
  }
  const params = new URL(request.url).searchParams;
  const orderNo =
    params.get("merchantInvoiceNumber") ??
    params.get("order_id") ??
    (typeof payload.tran_id === "string" ? payload.tran_id : null) ??
    (typeof payload.orderNo === "string" ? payload.orderNo : null) ??
    (typeof payload.order_no === "string" ? payload.order_no : null);
  if (!orderNo) return {};
  const order = await prisma.order.findFirst({ where: { orderNo }, select: { storeId: true } });
  return order ? getStorePaymentCredentials(order.storeId, provider) : {};
}

async function markPaymentFailure(providerTxnId: string | null, reason: string) {
  if (!providerTxnId) return;
  await prisma.payment.updateMany({
    where: { providerTxnId, status: { in: ["INITIATED", "PENDING"] } },
    data: { status: "FAILED", failureReason: reason.slice(0, 300) },
  });
}

async function cancelPendingPaymentOrder(
  order: { id: string; status: string; storeId: string; items: Array<{ variantId: string | null; quantity: number }> },
  note: string,
) {
  if (order.status !== "PENDING_PAYMENT") return;
  try {
    await applyTransition({
      orderId: order.id,
      from: "PENDING_PAYMENT",
      to: "CANCELLED",
      actorType: "SYSTEM",
      note,
      items: order.items,
      storeId: order.storeId,
    });
  } catch (error) {
    if (!isAppError(error) || error.code !== "CONFLICT") throw error;
    const current = await prisma.order.findUnique({ where: { id: order.id }, select: { status: true } });
    if (current?.status !== "CANCELLED") return;
  } finally {
    await releaseCouponReservation(order.id);
  }
}

/**
 * Reconciliation sweep (FR-05). Finds payments that have sat in a pending state
 * past a threshold so Finance can re-query the gateway or settle manually.
 */
export async function reconcilePayments(storeId?: string, olderThanMinutes = 30) {
  const threshold = new Date(Date.now() - olderThanMinutes * 60_000);
  const pending = await prisma.payment.findMany({
    where: {
      status: { in: ["INITIATED", "PENDING"] },
      createdAt: { lt: threshold },
      ...(storeId ? { order: { storeId } } : {}),
    },
    include: { order: { select: { id: true, orderNo: true, storeId: true, grandTotal: true } } },
    take: 200,
  });

  return pending.map((payment) => ({
    paymentId: payment.id,
    provider: payment.provider,
    orderNo: payment.order.orderNo,
    amount: fromPaisa(toPaisa(payment.amount)),
    ageMinutes: Math.round((Date.now() - payment.createdAt.getTime()) / 60_000),
    action: payment.provider === "COD" ? "AWAITING_COLLECTION" : "REQUERY_GATEWAY",
  }));
}

/** Cancel expired online checkouts, release stock and return coupon capacity. */
export async function expirePendingPayments(now = new Date(), limit = 200) {
  const orders = await prisma.order.findMany({
    where: {
      status: "PENDING_PAYMENT",
      paymentProvider: { not: "COD" },
      paymentExpiresAt: { lte: now },
    },
    include: { items: true },
    orderBy: { paymentExpiresAt: "asc" },
    take: limit,
  });
  let expired = 0;
  for (const order of orders) {
    await cancelPendingPaymentOrder(order, "Payment window expired");
    await prisma.payment.updateMany({
      where: { orderId: order.id, status: { in: ["INITIATED", "PENDING"] } },
      data: { status: "EXPIRED", failureReason: "Payment window expired" },
    });
    expired += 1;
  }
  return { expired };
}

/** Staff-recorded COD collection (COD is a first-class method, FR-05). */
export async function recordCodCollection(
  actor: ActorContext,
  storeId: string,
  orderId: string,
) {
  assertPermission(actor, "orders:write");
  await assertStoreAccess(actor, storeId);

  const order = await prisma.order.findFirst({
    where: { id: orderId, storeId },
    include: { items: true },
  });
  if (!order) throw new NotFoundError("Order");
  if (order.paymentProvider !== "COD") {
    throw new AppError("VALIDATION_FAILED", "এই অর্ডারটি COD নয়।", 422);
  }

  await prisma.payment.updateMany({
    where: { orderId, provider: "COD" },
    data: { status: "SUCCEEDED" },
  });

  if (order.paymentStatus !== "PAID") {
    await prisma.order.update({ where: { id: orderId }, data: { paymentStatus: "PAID" } });
  }
  await finalizeCouponRedemption(orderId);
  await applyAllOrderFees(orderId);

  await recordAudit({
    action: "payment.cod_collected",
    tenantId: actor.tenantId,
    actorId: actor.userId,
    resourceType: "Order",
    resourceId: orderId,
    metadata: { amount: fromPaisa(toPaisa(order.grandTotal)) },
  });

  return { ok: true, amount: fromPaisa(toPaisa(order.grandTotal)) };
}

/** Refund through the gateway, then void the platform fees for that order. */
export async function refundOrder(
  actor: ActorContext,
  storeId: string,
  orderId: string,
  input: { amount: string; reason: string },
) {
  assertPermission(actor, "orders:refund");
  await assertStoreAccess(actor, storeId);

  const order = await prisma.order.findFirst({
    where: { id: orderId, storeId },
    include: { items: true, payments: { orderBy: { createdAt: "desc" } } },
  });
  if (!order) throw new NotFoundError("Order");

  const paid = order.payments.find((p) => p.status === "SUCCEEDED");
  const amount = input.amount;

  if (paid && paid.provider !== "COD") {
    const adapter = getPaymentAdapter(paid.provider);
    const credentials = await getStorePaymentCredentials(storeId, paid.provider);
    const result = await adapter.refund({
      providerTxnId: paid.providerTxnId ?? order.orderNo,
      amount,
      credentials,
    });
    if (!result.ok) {
      throw new AppError(
        "PAYMENT_FAILED",
        result.message ?? "Gateway refund ব্যর্থ হয়েছে।",
        502,
        { provider: paid.provider },
      );
    }
  }

  await prisma.payment.create({
    data: {
      orderId,
      provider: order.paymentProvider,
      providerTxnId: `REFUND-${order.orderNo}-${Date.now().toString(36)}`,
      amount: amount as never,
      status: "REFUNDED",
      rawReference: input.reason,
    },
  });

  await reverseFeesForOrder(orderId, `Refund: ${input.reason}`);

  if (order.status !== "REFUNDED" && order.status !== "CANCELLED") {
    await applyTransition({
      orderId,
      from: order.status as never,
      to: "REFUNDED",
      actorType: "STAFF",
      actorId: actor.userId,
      note: input.reason,
      items: order.items,
      storeId,
    });
  }

  await recordAudit({
    action: "payment.refunded",
    tenantId: actor.tenantId,
    actorId: actor.userId,
    resourceType: "Order",
    resourceId: orderId,
    metadata: { amount, reason: input.reason },
  });

  return { ok: true, amount };
}

export async function listWebhookEvents(provider?: string, limit = 50) {
  return prisma.paymentWebhookEvent.findMany({
    where: provider ? { provider: provider as never } : {},
    orderBy: { createdAt: "desc" },
    take: limit,
  });
}

export async function webhookHealth() {
  const rows = await prisma.paymentWebhookEvent.groupBy({
    by: ["provider", "status"],
    _count: { _all: true },
  });
  return rows.map((row) => ({
    provider: row.provider,
    status: row.status,
    count: row._count._all,
  }));
}
