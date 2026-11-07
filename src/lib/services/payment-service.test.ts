import "dotenv/config";
import test from "node:test";
import assert from "node:assert/strict";
import { prisma } from "@/lib/db";
import { addItem } from "@/lib/services/cart-service";
import { placeOrder } from "@/lib/services/checkout-service";
import { handlePaymentWebhook } from "@/lib/services/payment-service";
import {
  SANDBOX_SIGNATURE_HEADER,
  signSandboxPayload,
} from "@/lib/payments";
import { createStoreFixture, DB_TEST_SKIP, uniqueSuffix } from "@/lib/testing/fixtures";

/**
 * Payment webhooks are the one place where money is credited, so the tests
 * cover the four decisions the service makes: a valid callback settles the
 * order, a replay is idempotent, a forged signature changes nothing, and an
 * amount mismatch never becomes a payment.
 */

async function orderAwaitingPayment() {
  const fx = await createStoreFixture({ gateways: ["BKASH"], stock: 4 });
  const session = `sess-${uniqueSuffix()}`;
  await addItem(fx.storeId, session, { variantId: fx.variantId, quantity: 2 });

  const result = await placeOrder({
    storeId: fx.storeId,
    sessionKey: session,
    payload: {
      customerName: "Webhook Buyer",
      customerPhone: "01812345678",
      address: { line1: "Road 7", city: "Dhaka" },
      paymentProvider: "BKASH",
      acceptTerms: true,
    } as never,
    idempotencyKey: `idem-${uniqueSuffix()}`,
    baseUrl: "http://localhost:3000",
  });

  const payment = await prisma.payment.findFirstOrThrow({
    where: { orderId: result.orderId },
    orderBy: { createdAt: "desc" },
  });

  return { fx, order: result, payment };
}

function callbackRequest(rawBody: string, signature = signSandboxPayload(rawBody)) {
  return new Request("http://localhost:3000/api/v1/webhooks/payments/bkash", {
    method: "POST",
    headers: { [SANDBOX_SIGNATURE_HEADER]: signature, "content-type": "application/json" },
    body: rawBody,
  });
}

function sandboxBody(input: {
  providerTxnId: string;
  orderNo: string;
  orderId: string;
  amount: string;
  eventKey?: string;
  status?: "SUCCEEDED" | "FAILED";
}) {
  return JSON.stringify({
    eventKey: input.eventKey ?? `evt-${uniqueSuffix()}`,
    providerTxnId: input.providerTxnId,
    orderNo: input.orderNo,
    orderId: input.orderId,
    amount: input.amount,
    currency: "BDT",
    status: input.status ?? "SUCCEEDED",
  });
}

test(
  "payments: a correctly signed callback settles the order exactly once",
  { skip: DB_TEST_SKIP },
  async () => {
    const { fx, order, payment } = await orderAwaitingPayment();
    try {
      assert.equal(order.status, "PENDING_PAYMENT");
      assert.ok(payment.providerTxnId);

      const body = sandboxBody({
        providerTxnId: payment.providerTxnId!,
        orderNo: order.orderNo,
        orderId: order.orderId,
        amount: payment.amount.toString(),
      });

      const outcome = await handlePaymentWebhook("bkash", callbackRequest(body), body);
      assert.equal(outcome.status, "PROCESSED");
      assert.equal(outcome.signatureValid, true);

      const paid = await prisma.order.findUniqueOrThrow({ where: { id: order.orderId } });
      assert.equal(paid.status, "PAID");
      assert.equal(paid.paymentStatus, "PAID");

      const stored = await prisma.payment.findUniqueOrThrow({ where: { id: payment.id } });
      assert.equal(stored.status, "SUCCEEDED");

      // Payment settles the money, not the stock: the reservation stays held
      // until the merchant confirms the order (PENDING_PAYMENT → PAID is a
      // payment transition; CONFIRMED is the fulfilment one).
      const variant = await prisma.productVariant.findUniqueOrThrow({
        where: { id: fx.variantId },
        select: { stockQty: true, reservedQty: true },
      });
      assert.equal(variant.stockQty, 4);
      assert.equal(variant.reservedQty, 2);
    } finally {
      await fx.cleanup();
    }
  },
);

test(
  "payments: replaying the same callback is reported as a duplicate, not re-applied",
  { skip: DB_TEST_SKIP },
  async () => {
    const { fx, order, payment } = await orderAwaitingPayment();
    try {
      const body = sandboxBody({
        providerTxnId: payment.providerTxnId!,
        orderNo: order.orderNo,
        orderId: order.orderId,
        amount: payment.amount.toString(),
        eventKey: `evt-dupe-${uniqueSuffix()}`,
      });

      await handlePaymentWebhook("bkash", callbackRequest(body), body);
      const second = await handlePaymentWebhook("bkash", callbackRequest(body), body);

      assert.equal(second.duplicate, true);
      assert.equal(second.message, "Already processed");

      const events = await prisma.paymentWebhookEvent.count({
        where: { provider: "BKASH", eventKey: JSON.parse(body).eventKey },
      });
      assert.equal(events, 1);
    } finally {
      await fx.cleanup();
    }
  },
);

test(
  "payments: a forged signature is recorded but never credits the order",
  { skip: DB_TEST_SKIP },
  async () => {
    const { fx, order, payment } = await orderAwaitingPayment();
    try {
      const body = sandboxBody({
        providerTxnId: payment.providerTxnId!,
        orderNo: order.orderNo,
        orderId: order.orderId,
        amount: payment.amount.toString(),
      });

      const outcome = await handlePaymentWebhook(
        "bkash",
        callbackRequest(body, "00"),
        body,
      );

      assert.equal(outcome.signatureValid, false);
      assert.equal(outcome.status, "REJECTED_SIGNATURE");

      // The pending payment is untouched: a forged callback cannot DoS checkout.
      const pending = await prisma.order.findUniqueOrThrow({ where: { id: order.orderId } });
      assert.equal(pending.status, "PENDING_PAYMENT");
      const stored = await prisma.payment.findUniqueOrThrow({ where: { id: payment.id } });
      assert.equal(stored.status, "PENDING");

      const rejected = await prisma.paymentWebhookEvent.findFirstOrThrow({
        where: { provider: "BKASH", status: "REJECTED_SIGNATURE" },
      });
      assert.ok(rejected.processedAt);
    } finally {
      await fx.cleanup();
    }
  },
);

test(
  "payments: an amount that does not match the order is refused",
  { skip: DB_TEST_SKIP },
  async () => {
    const { fx, order, payment } = await orderAwaitingPayment();
    try {
      const body = sandboxBody({
        providerTxnId: payment.providerTxnId!,
        orderNo: order.orderNo,
        orderId: order.orderId,
        amount: "1.00",
      });

      const outcome = await handlePaymentWebhook("bkash", callbackRequest(body), body);
      assert.equal(outcome.status, "AMOUNT_MISMATCH");

      const stored = await prisma.order.findUniqueOrThrow({ where: { id: order.orderId } });
      assert.equal(stored.status, "PENDING_PAYMENT");

      const failed = await prisma.payment.findUniqueOrThrow({ where: { id: payment.id } });
      assert.equal(failed.status, "FAILED");
      assert.equal(failed.failureReason, "Amount mismatch");
    } finally {
      await fx.cleanup();
    }
  },
);
