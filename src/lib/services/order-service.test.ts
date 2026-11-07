import "dotenv/config";
import test from "node:test";
import assert from "node:assert/strict";
import { prisma } from "@/lib/db";
import { addItem } from "@/lib/services/cart-service";
import { placeOrder } from "@/lib/services/checkout-service";
import { updateOrderStatus } from "@/lib/services/order-service";
import { createStoreFixture, DB_TEST_SKIP, uniqueSuffix } from "@/lib/testing/fixtures";

/**
 * The order state machine drives inventory and money. A wrong edge here means
 * stock that never returns to the shelf or a fee that is never reversed, so the
 * transitions are exercised against the database, not only the pure table.
 */

async function placeOrderFor(fx: Awaited<ReturnType<typeof createStoreFixture>>, provider: "COD" | "BKASH") {
  const session = `sess-${uniqueSuffix()}`;
  await addItem(fx.storeId, session, { variantId: fx.variantId, quantity: 2 });
  return placeOrder({
    storeId: fx.storeId,
    sessionKey: session,
    payload: {
      customerName: "State Buyer",
      customerPhone: "01912345678",
      address: { line1: "Road 9", city: "Dhaka" },
      paymentProvider: provider,
      acceptTerms: true,
    } as never,
    idempotencyKey: `idem-${uniqueSuffix()}`,
    baseUrl: "http://localhost:3000",
  });
}

test(
  "orders: cancelling a confirmed order returns the stock to the shelf",
  { skip: DB_TEST_SKIP },
  async () => {
    const fx = await createStoreFixture({ stock: 10 });
    try {
      const order = await placeOrderFor(fx, "COD");

      let variant = await prisma.productVariant.findUniqueOrThrow({ where: { id: fx.variantId } });
      assert.equal(variant.stockQty, 8);

      await updateOrderStatus(fx.actor, fx.storeId, order.orderId, {
        status: "CANCELLED",
        note: "customer changed their mind",
      });

      const cancelled = await prisma.order.findUniqueOrThrow({ where: { id: order.orderId } });
      assert.equal(cancelled.status, "CANCELLED");
      assert.ok(cancelled.cancelledAt);

      variant = await prisma.productVariant.findUniqueOrThrow({ where: { id: fx.variantId } });
      assert.equal(variant.stockQty, 10);
      assert.equal(variant.reservedQty, 0);

      // The timeline records who changed what.
      const event = await prisma.orderEvent.findFirstOrThrow({
        where: { orderId: order.orderId, toStatus: "CANCELLED" },
      });
      assert.equal(event.fromStatus, "CONFIRMED");
      assert.equal(event.actorType, "STAFF");
    } finally {
      await fx.cleanup();
    }
  },
);

test(
  "orders: cancelling an unpaid order releases the reservation without restocking",
  { skip: DB_TEST_SKIP },
  async () => {
    const fx = await createStoreFixture({ stock: 10, gateways: ["BKASH"] });
    try {
      const order = await placeOrderFor(fx, "BKASH");

      let variant = await prisma.productVariant.findUniqueOrThrow({ where: { id: fx.variantId } });
      assert.equal(variant.stockQty, 10);
      assert.equal(variant.reservedQty, 2);

      await updateOrderStatus(fx.actor, fx.storeId, order.orderId, { status: "CANCELLED" });

      variant = await prisma.productVariant.findUniqueOrThrow({ where: { id: fx.variantId } });
      assert.equal(variant.stockQty, 10, "stock was never decremented, so it must not be incremented");
      assert.equal(variant.reservedQty, 0);
    } finally {
      await fx.cleanup();
    }
  },
);

test(
  "orders: an illegal transition is rejected and leaves the order untouched",
  { skip: DB_TEST_SKIP },
  async () => {
    const fx = await createStoreFixture();
    try {
      const order = await placeOrderFor(fx, "COD");

      await assert.rejects(
        updateOrderStatus(fx.actor, fx.storeId, order.orderId, { status: "PAID" }),
        (error: Error & { code?: string }) =>
          error.name === "AppError" && error.code === "VALIDATION_FAILED",
      );

      const unchanged = await prisma.order.findUniqueOrThrow({ where: { id: order.orderId } });
      assert.equal(unchanged.status, "CONFIRMED");
    } finally {
      await fx.cleanup();
    }
  },
);

test(
  "orders: the delivery → return path restocks and marks the fulfilment",
  { skip: DB_TEST_SKIP },
  async () => {
    const fx = await createStoreFixture({ stock: 10 });
    try {
      const order = await placeOrderFor(fx, "COD");

      await updateOrderStatus(fx.actor, fx.storeId, order.orderId, { status: "PROCESSING" });
      await updateOrderStatus(fx.actor, fx.storeId, order.orderId, { status: "SHIPPED" });
      await updateOrderStatus(fx.actor, fx.storeId, order.orderId, { status: "DELIVERED" });

      const delivered = await prisma.order.findUniqueOrThrow({ where: { id: order.orderId } });
      assert.equal(delivered.status, "DELIVERED");
      assert.equal(delivered.fulfillmentStatus, "FULFILLED");

      // Returns go DELIVERED → RETURN_REQUESTED → RETURNED; there is no direct
      // jump, so the buyer's request and the merchant's acceptance stay auditable.
      await updateOrderStatus(fx.actor, fx.storeId, order.orderId, { status: "RETURN_REQUESTED" });
      await updateOrderStatus(fx.actor, fx.storeId, order.orderId, { status: "RETURNED" });

      const returned = await prisma.order.findUniqueOrThrow({ where: { id: order.orderId } });
      assert.equal(returned.status, "RETURNED");
      assert.equal(returned.fulfillmentStatus, "RETURNED");

      const variant = await prisma.productVariant.findUniqueOrThrow({ where: { id: fx.variantId } });
      assert.equal(variant.stockQty, 10, "the returned units are back on the shelf");
    } finally {
      await fx.cleanup();
    }
  },
);
