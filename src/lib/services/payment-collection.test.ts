import "dotenv/config";
import test from "node:test";
import assert from "node:assert/strict";
import { prisma } from "@/lib/db";
import { addItem } from "@/lib/services/cart-service";
import { placeOrder } from "@/lib/services/checkout-service";
import {
  handlePaymentWebhook,
  recordCodCollection,
  refundOrder,
} from "@/lib/services/payment-service";
import { SANDBOX_SIGNATURE_HEADER, signSandboxPayload } from "@/lib/payments";
import {
  createStoreFixture,
  DB_TEST_SKIP,
  uniqueSuffix,
  type StoreFixture,
} from "@/lib/testing/fixtures";

/**
 * Collecting cash and refunding a card are the two places where the platform
 * records that money moved. Both are covered here against the database: the
 * happy path, the guard rails, and the fee ledger they touch.
 */

async function place(fx: StoreFixture, provider: "COD" | "BKASH") {
  const session = `sess-${uniqueSuffix()}`;
  await addItem(fx.storeId, session, { variantId: fx.variantId, quantity: 1 });
  return placeOrder({
    storeId: fx.storeId,
    sessionKey: session,
    payload: {
      customerName: "Collection Buyer",
      customerPhone: "01612345678",
      address: { line1: "Road 11", city: "Dhaka" },
      paymentProvider: provider,
      acceptTerms: true,
    } as never,
    idempotencyKey: `idem-${uniqueSuffix()}`,
    baseUrl: "http://localhost:3000",
  });
}

async function payViaSandbox(orderId: string, orderNo: string) {
  const payment = await prisma.payment.findFirstOrThrow({
    where: { orderId },
    orderBy: { createdAt: "desc" },
  });
  const body = JSON.stringify({
    eventKey: `evt-${uniqueSuffix()}`,
    providerTxnId: payment.providerTxnId,
    orderNo,
    orderId,
    amount: payment.amount.toString(),
    currency: "BDT",
    status: "SUCCEEDED",
  });
  const request = new Request("http://localhost:3000/api/v1/webhooks/payments/bkash", {
    method: "POST",
    headers: { [SANDBOX_SIGNATURE_HEADER]: signSandboxPayload(body) },
    body,
  });
  return handlePaymentWebhook("bkash", request, body);
}

test(
  "collections: recording a COD collection marks the order paid and books the fee",
  { skip: DB_TEST_SKIP },
  async () => {
    const fx = await createStoreFixture();
    try {
      const order = await place(fx, "COD");

      const before = await prisma.order.findUniqueOrThrow({ where: { id: order.orderId } });
      assert.equal(before.paymentStatus, "PENDING");

      const result = await recordCodCollection(fx.actor, fx.storeId, order.orderId);
      assert.equal(result.ok, true);
      assert.equal(result.amount, order.grandTotal);

      const after = await prisma.order.findUniqueOrThrow({ where: { id: order.orderId } });
      assert.equal(after.paymentStatus, "PAID");

      const payment = await prisma.payment.findFirstOrThrow({
        where: { orderId: order.orderId, provider: "COD" },
      });
      assert.equal(payment.status, "SUCCEEDED");

      // The plan includes a monthly order quota, so a single order books no
      // overage fee — the ledger stays empty rather than charging every sale.
      const fees = await prisma.feeLedger.findMany({ where: { orderId: order.orderId } });
      assert.equal(fees.length, 0, "an order inside the included quota must not be charged");
    } finally {
      await fx.cleanup();
    }
  },
);

test(
  "collections: a gateway order cannot be marked as cash collected",
  { skip: DB_TEST_SKIP },
  async () => {
    const fx = await createStoreFixture({ gateways: ["BKASH"] });
    try {
      const order = await place(fx, "BKASH");

      await assert.rejects(
        recordCodCollection(fx.actor, fx.storeId, order.orderId),
        (error: Error & { code?: string }) => error.code === "VALIDATION_FAILED",
      );
    } finally {
      await fx.cleanup();
    }
  },
);

test(
  "refunds: a full refund settles the order and reverses the platform fee",
  { skip: DB_TEST_SKIP },
  async () => {
    const fx = await createStoreFixture({ gateways: ["BKASH"] });
    try {
      const order = await place(fx, "BKASH");
      await payViaSandbox(order.orderId, order.orderNo);

      const paid = await prisma.order.findUniqueOrThrow({ where: { id: order.orderId } });
      assert.equal(paid.status, "PAID");

      const refund = await refundOrder(fx.actor, fx.storeId, order.orderId, {
        amount: order.grandTotal,
        reason: "customer returned the item",
        idempotencyKey: `refund-${uniqueSuffix()}`,
      });
      assert.equal(refund.ok, true);

      const refunded = await prisma.order.findUniqueOrThrow({ where: { id: order.orderId } });
      assert.equal(refunded.status, "REFUNDED");
      assert.equal(refunded.paymentStatus, "REFUNDED");

      const refundRows = await prisma.payment.findMany({
        where: { orderId: order.orderId, providerTxnId: { startsWith: "REFUND-" } },
      });
      assert.equal(refundRows.length, 1);
      assert.equal(refundRows[0].status, "REFUNDED");

      // The fee the platform booked on the sale is voided by the refund (the
      // ledger is append-only: rows move to VOID, they are never deleted).
      const fees = await prisma.feeLedger.findMany({ where: { orderId: order.orderId } });
      assert.ok(
        fees.every((fee) => fee.status === "VOID" || fee.reversedAt !== null),
        `expected voided fees, got ${fees.map((fee) => fee.status).join(", ")}`,
      );
    } finally {
      await fx.cleanup();
    }
  },
);

test(
  "refunds: refunding more than was captured is refused",
  { skip: DB_TEST_SKIP },
  async () => {
    const fx = await createStoreFixture({ gateways: ["BKASH"] });
    try {
      const order = await place(fx, "BKASH");
      await payViaSandbox(order.orderId, order.orderNo);

      await assert.rejects(
        refundOrder(fx.actor, fx.storeId, order.orderId, {
          amount: "999999.00",
          reason: "typo",
        }),
        (error: Error & { code?: string }) => error.code === "VALIDATION_FAILED",
      );

      // Nothing was reserved or refunded by the rejected attempt.
      const rows = await prisma.payment.findMany({
        where: { orderId: order.orderId, providerTxnId: { startsWith: "REFUND-" } },
      });
      assert.equal(rows.length, 0);
    } finally {
      await fx.cleanup();
    }
  },
);

test(
  "refunds: an unpaid order has nothing to refund",
  { skip: DB_TEST_SKIP },
  async () => {
    const fx = await createStoreFixture({ gateways: ["BKASH"] });
    try {
      const order = await place(fx, "BKASH");

      await assert.rejects(
        refundOrder(fx.actor, fx.storeId, order.orderId, {
          amount: "10.00",
          reason: "not paid yet",
        }),
        (error: Error & { code?: string }) => error.code === "VALIDATION_FAILED",
      );
    } finally {
      await fx.cleanup();
    }
  },
);
