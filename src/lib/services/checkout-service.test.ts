import "dotenv/config";
import test from "node:test";
import assert from "node:assert/strict";
import { prisma } from "@/lib/db";
import { addItem, setCoupon } from "@/lib/services/cart-service";
import { placeOrder, type CheckoutInput } from "@/lib/services/checkout-service";
import { createStoreFixture, DB_TEST_SKIP, uniqueSuffix, variantStock } from "@/lib/testing/fixtures";

/**
 * Checkout is the money path: it reserves stock, writes the immutable order
 * snapshot, converts the cart and records the payment attempt. These tests run
 * the real service against a real database, because a mocked Prisma client
 * would not catch stock races, decimal handling or constraint violations.
 */

function payload(overrides: Partial<CheckoutInput> = {}): CheckoutInput {
  return {
    customerName: "Test Buyer",
    customerPhone: "01712345678",
    customerEmail: "buyer@atlas.test",
    address: { line1: "House 1, Road 2", city: "Dhaka" },
    zoneId: null,
    paymentProvider: "COD",
    acceptTerms: true,
    ...overrides,
  } as CheckoutInput;
}

test(
  "checkout: COD order snapshots totals and commits reserved stock",
  { skip: DB_TEST_SKIP },
  async () => {
    const fx = await createStoreFixture();
    try {
      const session = `sess-${uniqueSuffix()}`;
      await addItem(fx.storeId, session, { variantId: fx.variantId, quantity: 2 });

      const result = await placeOrder({
        storeId: fx.storeId,
        sessionKey: session,
        payload: payload(),
        idempotencyKey: `idem-${uniqueSuffix()}`,
        baseUrl: "http://localhost:3000",
      });

      assert.equal(result.status, "CONFIRMED");
      assert.match(result.orderNo, /^[A-Z0-9-]+$/i);

      const order = await prisma.order.findUniqueOrThrow({
        where: { id: result.orderId },
        include: { items: true, payments: true },
      });

      // 2 × 500.00 merchandise + 60.00 Dhaka delivery.
      assert.equal(order.subtotal.toString(), "1000");
      assert.equal(order.shippingTotal.toString(), "60");
      assert.equal(order.discountTotal.toString(), "0");
      assert.equal(order.grandTotal.toString(), "1060");
      assert.equal(order.items.length, 1);
      assert.equal(order.items[0].quantity, 2);
      assert.equal(order.items[0].unitPrice.toString(), "500");
      assert.ok(order.items[0].nameSnapshot.startsWith("Product "));
      assert.equal(order.payments.length, 1);

      // COD auto-confirm converts the reservation into a real sale.
      const stock = await variantStock(fx.variantId);
      assert.equal(stock.stock, 8);
      assert.equal(stock.reserved, 0);

      // The cart is consumed, so it cannot be checked out twice.
      const cart = await prisma.cart.findFirstOrThrow({ where: { storeId: fx.storeId } });
      assert.equal(cart.status, "CONVERTED");
    } finally {
      await fx.cleanup();
    }
  },
);

test(
  "checkout: the same Idempotency-Key replays instead of creating a second order",
  { skip: DB_TEST_SKIP },
  async () => {
    const fx = await createStoreFixture();
    try {
      const session = `sess-${uniqueSuffix()}`;
      const key = `idem-${uniqueSuffix()}`;
      await addItem(fx.storeId, session, { variantId: fx.variantId, quantity: 1 });

      const first = await placeOrder({
        storeId: fx.storeId,
        sessionKey: session,
        payload: payload(),
        idempotencyKey: key,
        baseUrl: "http://localhost:3000",
      });
      const second = await placeOrder({
        storeId: fx.storeId,
        sessionKey: session,
        payload: payload(),
        idempotencyKey: key,
        baseUrl: "http://localhost:3000",
      });

      assert.equal(second.orderId, first.orderId);
      assert.equal(second.orderNo, first.orderNo);
      assert.equal(second.payment.status, "REPLAYED");

      const orders = await prisma.order.count({ where: { storeId: fx.storeId } });
      assert.equal(orders, 1);

      // Stock moved exactly once.
      const stock = await variantStock(fx.variantId);
      assert.equal(stock.stock, 9);
    } finally {
      await fx.cleanup();
    }
  },
);

test(
  "checkout: two simultaneous requests with one key still create a single order",
  { skip: DB_TEST_SKIP },
  async () => {
    const fx = await createStoreFixture();
    try {
      const session = `sess-${uniqueSuffix()}`;
      const key = `idem-${uniqueSuffix()}`;
      await addItem(fx.storeId, session, { variantId: fx.variantId, quantity: 1 });

      const place = () =>
        placeOrder({
          storeId: fx.storeId,
          sessionKey: session,
          payload: payload(),
          idempotencyKey: key,
          baseUrl: "http://localhost:3000",
        });

      // Both requests pass the "does this key exist?" check before either
      // commits; the unique index decides the winner and the loser replays it.
      const results = await Promise.allSettled([place(), place()]);
      const fulfilled = results.filter(
        (result): result is PromiseFulfilledResult<Awaited<ReturnType<typeof place>>> =>
          result.status === "fulfilled",
      );

      assert.equal(await prisma.order.count({ where: { storeId: fx.storeId } }), 1);
      assert.ok(fulfilled.length >= 1);
      const orderIds = new Set(fulfilled.map((result) => result.value.orderId));
      assert.equal(orderIds.size, 1);

      // Exactly one unit is held by the order — either still reserved (the
      // auto-confirm lost the race and will be retried by the merchant) or
      // already committed (CONFIRMED). Both leave the same available stock.
      const stock = await variantStock(fx.variantId);
      assert.equal(stock.stock - stock.reserved, 9);
    } finally {
      await fx.cleanup();
    }
  },
);

test(
  "checkout: a percentage coupon reduces the merchandise total before delivery",
  { skip: DB_TEST_SKIP },
  async () => {
    const fx = await createStoreFixture();
    try {
      const code = "SAVE10";
      await prisma.coupon.create({
        data: {
          storeId: fx.storeId,
          code,
          type: "PERCENTAGE",
          value: "10",
          minOrder: "0",
          usageLimit: 100,
          status: "ACTIVE",
        },
      });

      const session = `sess-${uniqueSuffix()}`;
      await addItem(fx.storeId, session, { variantId: fx.variantId, quantity: 2 });
      await setCoupon(fx.storeId, session, code);

      const result = await placeOrder({
        storeId: fx.storeId,
        sessionKey: session,
        payload: payload(),
        idempotencyKey: `idem-${uniqueSuffix()}`,
        baseUrl: "http://localhost:3000",
      });

      const order = await prisma.order.findUniqueOrThrow({ where: { id: result.orderId } });
      assert.equal(order.subtotal.toString(), "1000");
      assert.equal(order.discountTotal.toString(), "100");
      assert.equal(order.grandTotal.toString(), "960");
      assert.equal(order.couponCode, code);

      const coupon = await prisma.coupon.findFirstOrThrow({ where: { storeId: fx.storeId } });
      assert.equal(coupon.usedCount, 1);
    } finally {
      await fx.cleanup();
    }
  },
);

test(
  "checkout: stock that disappeared after the cart was built is refused",
  { skip: DB_TEST_SKIP },
  async () => {
    const fx = await createStoreFixture({ stock: 5 });
    try {
      const session = `sess-${uniqueSuffix()}`;
      await addItem(fx.storeId, session, { variantId: fx.variantId, quantity: 3 });

      // A second buyer takes the remaining units first.
      await prisma.productVariant.update({
        where: { id: fx.variantId },
        data: { stockQty: 1 },
      });

      await assert.rejects(
        placeOrder({
          storeId: fx.storeId,
          sessionKey: session,
          payload: payload(),
          idempotencyKey: `idem-${uniqueSuffix()}`,
          baseUrl: "http://localhost:3000",
        }),
        (error: Error) => error.name === "AppError" && /স্টক/.test(error.message),
      );

      assert.equal(await prisma.order.count({ where: { storeId: fx.storeId } }), 0);
      const stock = await variantStock(fx.variantId);
      assert.equal(stock.reserved, 0);
    } finally {
      await fx.cleanup();
    }
  },
);

test(
  "checkout: a payment provider the merchant has not enabled is refused",
  { skip: DB_TEST_SKIP },
  async () => {
    const fx = await createStoreFixture();
    try {
      const session = `sess-${uniqueSuffix()}`;
      await addItem(fx.storeId, session, { variantId: fx.variantId, quantity: 1 });

      await assert.rejects(
        placeOrder({
          storeId: fx.storeId,
          sessionKey: session,
          payload: payload({ paymentProvider: "BKASH" }),
          idempotencyKey: `idem-${uniqueSuffix()}`,
          baseUrl: "http://localhost:3000",
        }),
        (error: Error) => error.name === "AppError" && /পেমেন্ট/.test(error.message),
      );
    } finally {
      await fx.cleanup();
    }
  },
);

test(
  "checkout: an unpublished storefront cannot take orders",
  { skip: DB_TEST_SKIP },
  async () => {
    const fx = await createStoreFixture({ published: false });
    try {
      const session = `sess-${uniqueSuffix()}`;
      await addItem(fx.storeId, session, { variantId: fx.variantId, quantity: 1 });

      await assert.rejects(
        placeOrder({
          storeId: fx.storeId,
          sessionKey: session,
          payload: payload(),
          idempotencyKey: `idem-${uniqueSuffix()}`,
          baseUrl: "http://localhost:3000",
        }),
        (error: Error) => error.name === "AppError" && /publish/.test(error.message),
      );
    } finally {
      await fx.cleanup();
    }
  },
);
