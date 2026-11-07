import { prisma } from "@/lib/db";
import { AppError, ConflictError, NotFoundError, ValidationError } from "@/lib/errors";
import { createHash, randomUUID } from "node:crypto";
import { compareMoney, fromPaisa, toPaisa } from "@/lib/money";
import { notify, NOTIFICATION_TYPES } from "@/lib/notifications";
import { recordAudit } from "@/lib/audit";
import { getPaymentAdapter } from "@/lib/payments";
import type { PaymentProviderName } from "@/lib/payments";
import { applyTransition } from "@/lib/services/order-service";
import { applyAllOrderFees, reverseFeesForOrder } from "@/lib/services/fee-service";
import type { ActorContext } from "@/lib/rbac";
import { assertPermission } from "@/lib/rbac";
import { assertStoreAccess } from "@/lib/tenant";
import { requireWritableTenant } from "@/lib/entitlements";
import { emitWebhookEvent } from "@/lib/services/webhook-service";

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

  const callback = await adapter.parseCallback(request, rawBody);
  const payloadHash = createHash("sha256").update(rawBody || "").digest("hex");

  // Idempotency guard. The unique index is the source of truth, so a concurrent
  // duplicate cannot be processed twice.
  const existing = await prisma.paymentWebhookEvent.findUnique({
    where: { provider_eventKey: { provider, eventKey: callback.eventKey } },
  });

  if (existing?.processedAt) {
    return {
      received: true,
      duplicate: true,
      signatureValid: existing.signatureValid,
      status: existing.status,
      message: "Already processed",
    };
  }

  const event = existing
    ? await prisma.paymentWebhookEvent.update({
        where: { id: existing.id },
        data: {
          signatureValid: callback.signatureValid,
          payloadHash,
          payloadJson: callback.raw as never,
        },
      })
    : await prisma.paymentWebhookEvent.create({
        data: {
          provider,
          eventKey: callback.eventKey,
          signatureValid: callback.signatureValid,
          payloadHash,
          payloadJson: callback.raw as never,
          status: "RECEIVED",
        },
      });

  if (!callback.signatureValid) {
    await prisma.paymentWebhookEvent.update({
      where: { id: event.id },
      data: { status: "REJECTED_SIGNATURE", processedAt: new Date(), error: "Signature invalid" },
    });
    // A forged callback must never be able to fail a real pending payment. The
    // payment is left untouched and the rejected event is kept for forensics.
    return {
      received: true,
      duplicate: false,
      signatureValid: false,
      status: "REJECTED_SIGNATURE",
      message: "Signature invalid",
    };
  }

  if (callback.status === "SUCCEEDED" && !callback.providerTxnId) {
    await prisma.paymentWebhookEvent.update({
      where: { id: event.id },
      data: {
        status: "TXN_MISSING",
        processedAt: new Date(),
        error: "Successful callback has no provider transaction id",
      },
    });
    return {
      received: true,
      duplicate: false,
      signatureValid: true,
      status: "TXN_MISSING",
      message: "Provider transaction id missing",
    };
  }

  const match = await findOrderForCallback(provider, {
    orderId: callback.orderId,
    providerTxnId: callback.providerTxnId,
    verifiedOrderReference: callback.verifiedOrderReference === true,
  });
  if (!match) {
    await prisma.paymentWebhookEvent.update({
      where: { id: event.id },
      data: { status: "ORDER_NOT_FOUND", processedAt: new Date() },
    });
    return {
      received: true,
      duplicate: false,
      signatureValid: true,
      status: "ORDER_NOT_FOUND",
      message: "No matching order/payment attempt",
    };
  }
  const { order, paymentId } = match;

  // The gateway's verified order reference must agree with the order that owns
  // the payment attempt. A callback cannot re-route another transaction to this
  // order by swapping the order number in the payload.
  if (callback.orderNo && callback.orderNo !== order.orderNo) {
    await prisma.paymentWebhookEvent.update({
      where: { id: event.id },
      data: {
        storeId: order.storeId,
        status: "ORDER_MISMATCH",
        processedAt: new Date(),
        error: "Callback order reference does not match the payment attempt",
      },
    });
    return {
      received: true,
      duplicate: false,
      signatureValid: true,
      status: "ORDER_MISMATCH",
      message: "Order reference mismatch",
    };
  }

  // Store the tenant scope on the event as soon as the order is known. This is
  // what lets Admin → Payments list only its own tenant's webhooks.
  await prisma.paymentWebhookEvent.update({
    where: { id: event.id },
    data: { storeId: order.storeId },
  });

  if (callback.status === "SUCCEEDED") {
    // Amount is mandatory for a successful settlement. A provider that omits it
    // is treated as unverified instead of being credited.
    if (!callback.amount) {
      await prisma.paymentWebhookEvent.update({
        where: { id: event.id },
        data: { status: "AMOUNT_MISSING", processedAt: new Date(), error: "Amount missing" },
      });
      return {
        received: true,
        duplicate: false,
        signatureValid: true,
        status: "AMOUNT_MISSING",
        orderNo: order.orderNo,
      };
    }

    // Amount check before crediting: a tampered or mis-routed callback must not
    // settle an order for the wrong value.
    if (compareMoney(callback.amount, order.grandTotal) !== 0) {
      await prisma.paymentWebhookEvent.update({
        where: { id: event.id },
        data: { status: "AMOUNT_MISMATCH", processedAt: new Date(), error: "Amount mismatch" },
      });
      await markPaymentFailure(paymentId, "Amount mismatch");
      return {
        received: true,
        duplicate: false,
        signatureValid: true,
        status: "AMOUNT_MISMATCH",
        orderNo: order.orderNo,
      };
    }

    if (callback.currency && callback.currency.toUpperCase() !== order.currency.toUpperCase()) {
      await prisma.paymentWebhookEvent.update({
        where: { id: event.id },
        data: { status: "CURRENCY_MISMATCH", processedAt: new Date(), error: "Currency mismatch" },
      });
      return {
        received: true,
        duplicate: false,
        signatureValid: true,
        status: "CURRENCY_MISMATCH",
        orderNo: order.orderNo,
      };
    }

    // Settle exactly the attempt the callback was bound to. Matching only by
    // order + provider would let a second transaction reference settle an
    // unrelated attempt for the same order.
    const settled = await prisma.payment.updateMany({
      where: {
        id: paymentId,
        status: { in: ["INITIATED", "PENDING"] },
      },
      data: {
        status: "SUCCEEDED",
        ...(callback.providerTxnId ? { providerTxnId: callback.providerTxnId } : {}),
        rawReference: JSON.stringify(callback.raw).slice(0, 2000),
      },
    });
    if (settled.count === 0) {
      await prisma.paymentWebhookEvent.update({
        where: { id: event.id },
        data: {
          status: "PAYMENT_NOT_FOUND",
          processedAt: new Date(),
          error: "No pending payment for this provider",
        },
      });
      return {
        received: true,
        duplicate: false,
        signatureValid: true,
        status: "PAYMENT_NOT_FOUND",
        orderNo: order.orderNo,
      };
    }

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
    await markPaymentFailure(paymentId, callback.failureReason ?? "Gateway declined");
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
      await emitWebhookEvent(store.tenantId, "payment.failed", {
        orderId: order.id,
        orderNo: order.orderNo,
        provider,
        reason: callback.failureReason ?? "Gateway declined the payment.",
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

/**
 * Callbacks are matched only through server-issued identifiers. Order numbers
 * are unique per store, not globally, so they are never used as a lookup key.
 *
 * The payment attempt is the anchor: a callback must resolve to an existing
 * `Payment` row. `providerTxnId` does that for bKash/Nagad. SSLCommerz's
 * validated response instead echoes the server-issued `orderId` (`value_a`);
 * that is accepted only when `verifiedOrderReference` is set by the adapter
 * after server-to-server validation, and it must still find a pending attempt.
 */
async function findOrderForCallback(
  provider: PaymentProviderName,
  input: {
    orderId?: string | null;
    providerTxnId?: string | null;
    verifiedOrderReference?: boolean;
  },
): Promise<{
  order: NonNullable<Awaited<ReturnType<typeof loadOrderForPayment>>>;
  paymentId: string;
} | null> {
  if (input.providerTxnId) {
    const payment = await prisma.payment.findFirst({
      where: {
        provider,
        providerTxnId: input.providerTxnId,
        order: { deletedAt: null },
      },
      select: { id: true, orderId: true },
      orderBy: { createdAt: "desc" },
    });
    if (payment) {
      if (input.orderId && payment.orderId !== input.orderId) return null;
      const order = await loadOrderForPayment(payment.orderId, provider);
      return order ? { order, paymentId: payment.id } : null;
    }
  }

  if (input.orderId && input.verifiedOrderReference) {
    const order = await loadOrderForPayment(input.orderId, provider);
    if (!order) return null;
    const payment = await prisma.payment.findFirst({
      where: {
        orderId: order.id,
        provider,
        status: { in: ["INITIATED", "PENDING"] },
      },
      select: { id: true },
      orderBy: { createdAt: "desc" },
    });
    return payment ? { order, paymentId: payment.id } : null;
  }

  return null;
}

async function loadOrderForPayment(orderId: string, provider: PaymentProviderName) {
  return prisma.order.findFirst({
    where: {
      id: orderId,
      deletedAt: null,
      paymentProvider: provider,
    },
    include: { items: true },
  });
}

async function markPaymentFailure(paymentId: string, reason: string) {
  await prisma.payment.updateMany({
    where: { id: paymentId, status: { in: ["INITIATED", "PENDING"] } },
    data: { status: "FAILED", failureReason: reason.slice(0, 300) },
  });
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

/** Staff-recorded COD collection (COD is a first-class method, FR-05). */
export async function recordCodCollection(
  actor: ActorContext,
  storeId: string,
  orderId: string,
) {
  assertPermission(actor, "orders:write");
  await assertStoreAccess(actor, storeId);
  await requireWritableTenant(actor.tenantId);

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

/**
 * Refund through the gateway, then void the platform fees for that order.
 *
 * Guards added after the security review:
 *  - positive, two-decimal amount only;
 *  - never refund more than the captured amount minus previous refunds and
 *    in-flight refund reservations;
 *  - a terminal/fully-refunded order cannot start another gateway refund;
 *  - `idempotencyKey` (or a generated one) becomes the unique refund reference,
 *    so a retried request cannot double-refund.
 */
export async function refundOrder(
  actor: ActorContext,
  storeId: string,
  orderId: string,
  input: { amount: string; reason: string; idempotencyKey?: string | null },
) {
  assertPermission(actor, "orders:refund");
  await assertStoreAccess(actor, storeId);
  await requireWritableTenant(actor.tenantId);

  const rawAmount = (input.amount ?? "").trim();
  if (!/^\d+(\.\d{1,2})?$/.test(rawAmount)) {
    throw new ValidationError("Refund amount ধনাত্মক সংখ্যা, সর্বোচ্চ দুই দশমিক পর্যন্ত হতে হবে।");
  }
  const requestedPaisa = toPaisa(rawAmount);
  if (requestedPaisa <= 0n) {
    throw new ValidationError("Refund amount শূন্যের চেয়ে বড় হতে হবে।");
  }
  const amount = fromPaisa(requestedPaisa);

  const order = await prisma.order.findFirst({
    where: { id: orderId, storeId },
    include: { items: true, payments: { orderBy: { createdAt: "desc" } } },
  });
  if (!order) throw new NotFoundError("Order");
  if (order.status === "REFUNDED") {
    throw new ConflictError("এই অর্ডার ইতিমধ্যে সম্পূর্ণ রিফান্ড হয়েছে।");
  }

  const successfulPayments = order.payments.filter((payment) => payment.status === "SUCCEEDED");
  const capturedPaisa = successfulPayments.reduce(
    (total, payment) => total + toPaisa(payment.amount),
    0n,
  );
  if (capturedPaisa <= 0n) {
    throw new ValidationError("এই অর্ডারে রিফান্ড করার মতো কোনো পরিশোধিত পেমেন্ট নেই।");
  }

  const refundKey = (input.idempotencyKey?.trim() || randomUUID()).slice(0, 64);
  const refundTxnId = `REFUND-${orderId}-${refundKey}`;

  const existing = await prisma.payment.findFirst({
    where: {
      orderId,
      provider: order.paymentProvider,
      providerTxnId: refundTxnId,
    },
  });
  if (existing) {
    if (existing.status === "REFUNDED" || existing.status === "SUCCEEDED") {
      return {
        ok: true,
        amount: fromPaisa(toPaisa(existing.amount)),
        idempotent: true,
      };
    }
    if (existing.status === "INITIATED" || existing.status === "PENDING") {
      throw new ConflictError("এই রিফান্ডটি ইতিমধ্যে প্রসেস হচ্ছে।");
    }
  }

  // Serialise refunds for this order and reserve the amount before calling the
  // gateway. A crash after the gateway call leaves a PENDING reservation that
  // blocks a duplicate refund; finance can reconcile it explicitly.
  const reservation = await prisma
    .$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "Order" WHERE id = ${orderId} FOR UPDATE`;

      if (existing?.status === "FAILED") {
        await tx.payment.delete({ where: { id: existing.id } });
      }

      const rows = await tx.payment.findMany({
        where: { orderId },
        select: { id: true, amount: true, status: true, providerTxnId: true },
      });
      const captured = rows
        .filter((row) => row.status === "SUCCEEDED")
        .reduce((total, row) => total + toPaisa(row.amount), 0n);
      const refunded = rows
        .filter((row) => row.status === "REFUNDED")
        .reduce((total, row) => total + toPaisa(row.amount), 0n);
      const reserved = rows
        .filter(
          (row) =>
            (row.status === "INITIATED" || row.status === "PENDING") &&
            Boolean(row.providerTxnId?.startsWith("REFUND-")),
        )
        .reduce((total, row) => total + toPaisa(row.amount), 0n);
      const remaining = captured - refunded - reserved;

      if (remaining <= 0n) {
        throw new ConflictError("এই অর্ডারে আর রিফান্ড করার মতো ব্যালেন্স নেই।");
      }
      if (requestedPaisa > remaining) {
        throw new ValidationError(
          `সর্বোচ্চ ${fromPaisa(remaining)} BDT রিফান্ড করা যাবে।`,
          { remaining: fromPaisa(remaining) },
        );
      }

      return tx.payment.create({
        data: {
          orderId,
          provider: order.paymentProvider,
          providerTxnId: refundTxnId,
          amount: amount,
          status: "PENDING",
          idempotencyKey: refundKey,
          rawReference: input.reason,
        },
      });
    })
    .catch((error: unknown) => {
      if ((error as { code?: string }).code === "P2002") {
        throw new ConflictError("এই রিফান্ডটি ইতিমধ্যে প্রসেস হচ্ছে।");
      }
      throw error;
    });

  const gatewayPayment = successfulPayments.find((payment) => payment.provider !== "COD");

  try {
    if (gatewayPayment) {
      if (!gatewayPayment.providerTxnId) {
        throw new ValidationError("মূল পেমেন্টের gateway transaction id নেই, রিফান্ড করা যাবে না।");
      }
      const adapter = getPaymentAdapter(gatewayPayment.provider);
      const result = await adapter.refund({
        providerTxnId: gatewayPayment.providerTxnId,
        amount,
      });
      if (!result.ok) {
        throw new AppError(
          "PAYMENT_FAILED",
          result.message ?? "Gateway refund ব্যর্থ হয়েছে।",
          502,
          { provider: gatewayPayment.provider },
        );
      }
    }
  } catch (error) {
    await prisma.payment.updateMany({
      where: { id: reservation.id, status: { in: ["INITIATED", "PENDING"] } },
      data: {
        status: "FAILED",
        failureReason: (error instanceof Error ? error.message : "refund failed").slice(0, 300),
      },
    });
    throw error;
  }

  const refundedBeforePaisa = order.payments
    .filter((payment) => payment.status === "REFUNDED")
    .reduce((total, payment) => total + toPaisa(payment.amount), 0n);
  const fullyRefunded = refundedBeforePaisa + requestedPaisa >= capturedPaisa;

  await prisma.$transaction(async (tx) => {
    await tx.payment.update({
      where: { id: reservation.id },
      data: { status: "REFUNDED" },
    });
    await tx.order.update({
      where: { id: orderId },
      data: { paymentStatus: fullyRefunded ? "REFUNDED" : "PARTIALLY_REFUNDED" },
    });
  });

  if (fullyRefunded) {
    if (order.status !== "CANCELLED" && order.status !== "PENDING_PAYMENT") {
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
    } else if (order.status === "CANCELLED") {
      await reverseFeesForOrder(orderId, `Refund: ${input.reason}`);
    }
  }

  await recordAudit({
    action: "payment.refunded",
    tenantId: actor.tenantId,
    actorId: actor.userId,
    resourceType: "Order",
    resourceId: orderId,
    metadata: {
      amount,
      reason: input.reason,
      fullyRefunded,
      idempotencyKey: refundKey,
    },
  });

  return { ok: true, amount, fullyRefunded };
}

/**
 * Payments stuck in INITIATED/PENDING past `minutes` (PRD §11.5 reconciliation).
 * A row here means the callback never arrived, so an operator must reconcile it.
 */
export async function stalePendingPayments(minutes = 30) {
  const cutoff = new Date(Date.now() - minutes * 60 * 1000);
  const [initiated, pending] = await Promise.all([
    prisma.payment.count({ where: { status: "INITIATED", createdAt: { lt: cutoff } } }),
    prisma.payment.count({ where: { status: "PENDING", createdAt: { lt: cutoff } } }),
  ]);
  return initiated + pending;
}

/**
 * Webhook health is tenant-scoped by default. Passing `storeId` is what the
 * merchant Payments screen does; omitting it is only appropriate for the Super
 * Admin console, which needs the cross-tenant feed.
 */
export async function listWebhookEvents(options: {
  storeId?: string;
  provider?: string;
  limit?: number;
} = {}) {
  const { storeId, provider, limit = 50 } = options;
  return prisma.paymentWebhookEvent.findMany({
    where: {
      ...(storeId ? { storeId } : {}),
      ...(provider ? { provider: provider as never } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: Math.min(Math.max(limit, 1), 200),
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
