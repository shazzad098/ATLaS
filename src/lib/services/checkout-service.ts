import { z } from "zod";
import { prisma } from "@/lib/db";
import { AppError, NotFoundError } from "@/lib/errors";
import { buildOrderNo } from "@/lib/dates";
import { fromPaisa, toPaisa } from "@/lib/money";
import { notify, NOTIFICATION_TYPES } from "@/lib/notifications";
import { getOrCreateOpenCart, loadCart, priceCart } from "@/lib/services/cart-service";
import { applyTransition } from "@/lib/services/order-service";
import { reserveStock } from "@/lib/services/inventory-service";
import { applyAllOrderFees } from "@/lib/services/fee-service";
import {
  finalizeCouponRedemption,
  releaseCouponReservation,
  reserveCoupon,
} from "@/lib/services/coupon-service";
import { getPaymentAdapter } from "@/lib/payments";
import { loadEntitlementSnapshot } from "@/lib/entitlements";

/**
 * Checkout (FR-05, US-05).
 *
 * One transaction reserves stock, writes the immutable order snapshot, converts
 * the cart and records the payment attempt. `Idempotency-Key` makes retries
 * safe: the same key can never create a second order (PRD §11).
 */

export const checkoutInputSchema = z.object({
  customerName: z.string().min(2, "নাম দিন।").max(120),
  customerPhone: z.string().min(6, "মোবাইল নম্বর দিন।").max(20),
  customerEmail: z.string().email("সঠিক email দিন।").optional().or(z.literal("")),
  address: z.object({
    line1: z.string().min(3, "ঠিকানা লিখুন।").max(240),
    line2: z.string().max(240).optional().or(z.literal("")),
    area: z.string().max(120).optional().or(z.literal("")),
    city: z.string().min(2, "শহর/জেলা লিখুন।").max(120),
    district: z.string().max(120).optional().or(z.literal("")),
    postcode: z.string().max(20).optional().or(z.literal("")),
  }),
  notes: z.string().max(600).optional().or(z.literal("")),
  zoneId: z.string().optional().nullable(),
  paymentProvider: z.enum(["COD", "BKASH", "NAGAD", "SSLCOMMERZ"]).default("COD"),
  acceptTerms: z.literal(true, { message: "শর্তাবলীতে সম্মতি প্রয়োজন।" }),
});

export type CheckoutInput = z.infer<typeof checkoutInputSchema>;

export type CheckoutResult = {
  orderNo: string;
  orderId: string;
  grandTotal: string;
  status: string;
  payment: {
    provider: string;
    status: string;
    /** Present when the shopper must be sent to the gateway. */
    redirectUrl?: string;
  };
};

export class CheckoutError extends AppError {
  constructor(message: string, detail: Record<string, unknown> = {}) {
    super("VALIDATION_FAILED", message, 422, detail);
  }
}

export async function placeOrder(input: {
  storeSlug: string;
  sessionKey: string;
  payload: CheckoutInput;
  idempotencyKey: string;
  baseUrl: string;
}): Promise<CheckoutResult> {
  const store = await prisma.store.findFirst({
    where: { slug: input.storeSlug, deletedAt: null },
    include: { settings: true, tenant: true },
  });
  if (!store) throw new NotFoundError("Store");

  if (store.status !== "PUBLISHED") {
    throw new CheckoutError("এই storefront এখনো publish করা হয়নি।");
  }

  const snapshot = await loadEntitlementSnapshot(store.tenantId);
  if (snapshot.suspended) {
    throw new AppError("FORBIDDEN", "এই store-টি এই মুহূর্তে বন্ধ আছে।", 403);
  }
  if (snapshot.readOnly) {
    throw new AppError(
      "FORBIDDEN",
      "Store-টি read-only অবস্থায় আছে, নতুন অর্ডার নেওয়া যাচ্ছে না।",
      403,
    );
  }

  // A provider the merchant has not enabled must never be a valid checkout
  // choice, even if a client crafts the request by hand (FR-05).
  const method = await prisma.paymentMethod.findUnique({
    where: { storeId_provider: { storeId: store.id, provider: input.payload.paymentProvider } },
    select: { isEnabled: true },
  });
  if (!method?.isEnabled) {
    throw new CheckoutError("এই দোকানে নির্বাচিত পেমেন্ট মাধ্যমটি এখন সক্রিয় নয়।");
  }

  // Replay protection: the same idempotency key returns the original order.
  const existing = await prisma.order.findUnique({
    where: { idempotencyKey: input.idempotencyKey },
    select: { id: true, orderNo: true, grandTotal: true, status: true, paymentProvider: true },
  });
  if (existing) {
    return {
      orderId: existing.id,
      orderNo: existing.orderNo,
      grandTotal: fromPaisa(toPaisa(existing.grandTotal)),
      status: existing.status,
      payment: { provider: existing.paymentProvider, status: "REPLAYED" },
    };
  }

  const cart = await loadCart(store.id, input.sessionKey);
  if (!cart || cart.items.length === 0) {
    throw new CheckoutError("কার্ট খালি।");
  }

  const pricing = await priceCart(store.id, cart, { zoneId: input.payload.zoneId ?? null });
  if (pricing.couponError) {
    throw new CheckoutError(pricing.couponError);
  }
  for (const line of pricing.lines) {
    if (line.available < line.quantity) {
      throw new CheckoutError(`"${line.productName}" এর স্টক শেষ হয়ে গেছে।`);
    }
  }

  const checkoutSettings = (store.settings?.checkoutJson ?? {}) as Record<string, unknown>;
  const codAutoConfirm = checkoutSettings.codAutoConfirm !== false;

  const addressSnapshot = {
    name: input.payload.customerName,
    phone: input.payload.customerPhone,
    email: input.payload.customerEmail || null,
    ...input.payload.address,
    zone: pricing.zone?.name ?? null,
  };

  const order = await prisma.$transaction(async (tx) => {
    // Atomic reservation. The conditional UPDATE guarantees that two concurrent
    // checkouts cannot both take the last unit.
    for (const line of pricing.lines) {
      const reserved = await reserveStock(tx, line.variantId, line.quantity);
      if (!reserved) {
        throw new CheckoutError(
          `"${line.productName}" এই মাত্র শেষ হয়ে গেল। কার্ট আপডেট করে আবার চেষ্টা করুন।`,
        );
      }
    }

    if (pricing.coupon) await reserveCoupon(tx, pricing.coupon.id);

    const customer = await tx.customer.upsert({
      where: { storeId_phone: { storeId: store.id, phone: input.payload.customerPhone } },
      create: {
        storeId: store.id,
        name: input.payload.customerName,
        phone: input.payload.customerPhone,
        email: input.payload.customerEmail || null,
        addressJson: input.payload.address as never,
        consentJson: { acceptedTerms: true, acceptedAt: new Date().toISOString() } as never,
      },
      update: {
        name: input.payload.customerName,
        email: input.payload.customerEmail || null,
        addressJson: input.payload.address as never,
      },
    });

    if (customer.isBlacklisted) {
      throw new AppError("FORBIDDEN", "এই নম্বর থেকে অর্ডার নেওয়া যাচ্ছে না।", 403);
    }

    const created = await tx.order.create({
      data: {
        storeId: store.id,
        orderNo: buildOrderNo(),
        customerId: customer.id,
        customerName: input.payload.customerName,
        customerPhone: input.payload.customerPhone,
        status: "PENDING_PAYMENT",
        paymentProvider: input.payload.paymentProvider,
        paymentStatus: "PENDING",
        fulfillmentStatus: "UNFULFILLED",
        subtotal: pricing.subtotal as never,
        discountTotal: pricing.discountTotal as never,
        shippingTotal: pricing.shippingTotal as never,
        grandTotal: pricing.grandTotal as never,
        couponCode: pricing.coupon?.code ?? null,
        paymentExpiresAt:
          input.payload.paymentProvider === "COD" ? null : new Date(Date.now() + 30 * 60_000),
        addressSnapshotJson: addressSnapshot as never,
        notes: input.payload.notes || null,
        idempotencyKey: input.idempotencyKey,
      },
    });

    await tx.orderItem.createMany({
      data: pricing.lines.map((line) => ({
        orderId: created.id,
        productId: line.productId,
        variantId: line.variantId,
        nameSnapshot: line.productName,
        skuSnapshot: line.sku,
        quantity: line.quantity,
        unitPrice: line.unitPrice as never,
        discountTotal:
          pricing.lines.length > 0
            ? fromPaisa(
                (toPaisa(pricing.discountTotal) * toPaisa(line.lineTotal)) /
                  (toPaisa(pricing.subtotal) === 0n ? 1n : toPaisa(pricing.subtotal)),
              )
            : "0.00",
        lineTotal: line.lineTotal as never,
      })),
    });

    await tx.orderEvent.create({
      data: {
        orderId: created.id,
        fromStatus: null,
        toStatus: "PENDING_PAYMENT",
        actorType: "CUSTOMER",
        note: `Order placed via ${input.payload.paymentProvider}`,
      },
    });

    await tx.payment.create({
      data: {
        orderId: created.id,
        provider: input.payload.paymentProvider,
        amount: pricing.grandTotal as never,
        status: "INITIATED",
        idempotencyKey: input.idempotencyKey,
      },
    });

    await tx.cart.update({
      where: { id: cart.id },
      data: { status: "CONVERTED", customerId: customer.id },
    });

    return created;
  });

  // Post-commit side effects (each is independently safe to retry).
  let redirectUrl: string | undefined;
  let paymentStatus = "PENDING";

  if (input.payload.paymentProvider === "COD") {
    if (codAutoConfirm) {
      await applyTransition({
        orderId: order.id,
        from: "PENDING_PAYMENT",
        to: "CONFIRMED",
        actorType: "SYSTEM",
        note: "COD order auto-confirmed",
        items: pricing.lines.map((line) => ({ variantId: line.variantId, quantity: line.quantity })),
        storeId: store.id,
      });
      await finalizeCouponRedemption(order.id);
      paymentStatus = "PENDING_COLLECTION";
    } else {
      await applyAllOrderFees(order.id);
    }
  } else {
    const adapter = getPaymentAdapter(input.payload.paymentProvider);
    let initiation;
    try {
      initiation = await adapter.initiate({
        orderId: order.id,
        orderNo: order.orderNo,
        amount: pricing.grandTotal,
        currency: "BDT",
        customerName: input.payload.customerName,
        customerPhone: input.payload.customerPhone,
        callbackUrl: `${input.baseUrl}/api/v1/webhooks/payments/${input.payload.paymentProvider.toLowerCase()}`,
        successUrl: `${input.baseUrl}/store/${store.slug}/order/${order.orderNo}`,
        failureUrl: `${input.baseUrl}/store/${store.slug}/checkout?error=payment_failed`,
      });
    } catch (error) {
      await cancelPendingCheckout(order.id, store.id, pricing.lines, "Payment initiation failed");
      throw error;
    }

    await prisma.payment.updateMany({
      where: { orderId: order.id, status: "INITIATED" },
      data: {
        providerTxnId: initiation.providerTxnId,
        rawReference: initiation.rawReference,
        status:
          initiation.status === "SUCCEEDED"
            ? "SUCCEEDED"
            : initiation.status === "FAILED"
              ? "FAILED"
              : "PENDING",
      },
    });

    redirectUrl = initiation.redirectUrl;
    paymentStatus = initiation.status;

    if (initiation.status === "SUCCEEDED") {
      await applyTransition({
        orderId: order.id,
        from: "PENDING_PAYMENT",
        to: "PAID",
        actorType: "SYSTEM",
        note: `Payment captured via ${input.payload.paymentProvider} (sandbox)`,
        items: pricing.lines.map((line) => ({ variantId: line.variantId, quantity: line.quantity })),
        storeId: store.id,
      });
      await finalizeCouponRedemption(order.id);
    } else if (initiation.status === "FAILED") {
      await cancelPendingCheckout(order.id, store.id, pricing.lines, "Payment initiation returned failed");
      throw new CheckoutError("পেমেন্ট গেটওয়ে পেমেন্ট গ্রহণ করেনি। আবার চেষ্টা করুন।");
    }
  }

  await notify({
    userId: store.tenant.ownerUserId,
    type: NOTIFICATION_TYPES.ORDER_CREATED,
    title: `নতুন অর্ডার — ${order.orderNo}`,
    body: `${input.payload.customerName} • ${pricing.grandTotal} BDT • ${input.payload.paymentProvider}`,
    payload: { orderId: order.id, storeId: store.id },
  });

  return {
    orderId: order.id,
    orderNo: order.orderNo,
    grandTotal: pricing.grandTotal,
    status: input.payload.paymentProvider === "COD" && codAutoConfirm ? "CONFIRMED" : order.status,
    payment: {
      provider: input.payload.paymentProvider,
      status: paymentStatus,
      redirectUrl,
    },
  };
}

async function cancelPendingCheckout(
  orderId: string,
  storeId: string,
  items: Array<{ variantId: string | null; quantity: number }>,
  note: string,
) {
  try {
    await applyTransition({
      orderId,
      from: "PENDING_PAYMENT",
      to: "CANCELLED",
      actorType: "SYSTEM",
      note,
      items,
      storeId,
    });
  } finally {
    await releaseCouponReservation(orderId);
  }
}

/** Storefront cart helper used by server actions. */
export async function cartForSession(storeId: string, sessionKey: string) {
  const cart = await loadCart(storeId, sessionKey);
  if (!cart) {
    await getOrCreateOpenCart(storeId, sessionKey);
    return loadCart(storeId, sessionKey);
  }
  return cart;
}
