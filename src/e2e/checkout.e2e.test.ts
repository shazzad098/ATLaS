import "dotenv/config";
import test, { after, before } from "node:test";
import assert from "node:assert/strict";
import { prisma } from "@/lib/db";
import { addItem } from "@/lib/services/cart-service.ts";
import { placeOrder, type CheckoutInput } from "@/lib/services/checkout-service.ts";
import {
  allowedNextStatuses,
  canTransition,
  updateOrderStatus,
} from "@/lib/services/order-service.ts";
import { ensureSubscription } from "@/lib/services/billing-service.ts";
import { createProduct } from "@/lib/services/catalog-service.ts";
import { createStore, publishStore } from "@/lib/services/store-service.ts";
import type { ActorContext } from "@/lib/rbac";

/**
 * Integration tests for the money path. They build their own fixture instead of
 * depending on the demo seed, so `npm test` is safe on a production-shaped DB.
 */
async function dbUp(): Promise<boolean> {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return true;
  } catch {
    return false;
  }
}

const up = await dbUp();
const skip = up ? false : "database unavailable";

type Fixture = {
  tenantId: string;
  userId: string;
  storeId: string;
  slug: string;
  variantId: string;
  actor: ActorContext;
};

let fixture: Fixture | null = null;
const cleanup: { tenantId?: string; userId?: string } = {};

before(async () => {
  if (!up) return;

  const suffix = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
  const phoneSuffix = String(Math.floor(Math.random() * 100_000_000)).padStart(8, "0");
  const user = await prisma.user.create({
    data: { phone: `+88019${phoneSuffix}`, name: "E2E Owner" },
  });
  cleanup.userId = user.id;
  const tenant = await prisma.tenant.create({
    data: { name: `E2E ${suffix}`, ownerUserId: user.id, status: "ACTIVE", timezone: "Asia/Dhaka", currency: "BDT" },
  });
  cleanup.tenantId = tenant.id;
  await ensureSubscription(tenant.id);

  const actor: ActorContext = {
    userId: user.id,
    tenantId: tenant.id,
    roleCode: "OWNER",
    permissions: ["store:write", "store:publish", "catalog:write", "design:write", "orders:write", "store:read"],
  };

  const store = await createStore(actor, {
    name: `E2E Store ${suffix}`,
    slug: `e2e-${suffix}`,
    contactPhone: "+8801700000000",
    themeCode: "nokshi",
  });
  const product = await createProduct(actor, store.id, {
    name: "E2E Product",
    status: "ACTIVE",
    variants: [{ sku: `E2E-${suffix}`, price: 100, stockQty: 10, status: "ACTIVE" }],
  });
  const variant = await prisma.productVariant.findFirstOrThrow({
    where: { productId: product.id },
    select: { id: true },
  });
  await publishStore(actor, store.id);

  fixture = {
    tenantId: tenant.id,
    userId: user.id,
    storeId: store.id,
    slug: store.slug,
    variantId: variant.id,
    actor,
  };
});

after(async () => {
  if (cleanup.tenantId) await prisma.tenant.deleteMany({ where: { id: cleanup.tenantId } });
  if (cleanup.userId) await prisma.user.deleteMany({ where: { id: cleanup.userId } });
});

const payload: CheckoutInput = {
  customerName: "E2E Buyer",
  customerPhone: "+8801700000000",
  address: { line1: "House 1, Road 2", city: "Dhaka" },
  paymentProvider: "COD",
  acceptTerms: true,
};

async function placeFixtureOrder() {
  assert.ok(fixture, "fixture must exist");
  const sessionKey = `e2e-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  await addItem(fixture.storeId, sessionKey, { variantId: fixture.variantId, quantity: 1 });
  return placeOrder({
    storeSlug: fixture.slug,
    sessionKey,
    payload,
    idempotencyKey: `e2e-idem-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    baseUrl: "http://localhost:3000",
  });
}

test("checkout places a COD order once and replays idempotently", { skip }, async () => {
  assert.ok(fixture, "fixture must exist");

  const sessionKey = `e2e-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  await addItem(fixture.storeId, sessionKey, { variantId: fixture.variantId, quantity: 1 });
  const idempotencyKey = `e2e-idem-${Date.now()}`;

  const order = await placeOrder({
    storeSlug: fixture.slug,
    sessionKey,
    payload,
    idempotencyKey,
    baseUrl: "http://localhost:3000",
  });

  assert.ok(order.orderId);
  assert.ok(order.orderNo);
  assert.ok(Number(order.grandTotal) >= 0);

  // Replay protection: the same key returns the same order, never a duplicate.
  const replayed = await placeOrder({
    storeSlug: fixture.slug,
    sessionKey,
    payload,
    idempotencyKey,
    baseUrl: "http://localhost:3000",
  });
  assert.equal(replayed.orderId, order.orderId);
});

test("order status transitions follow the transition table", { skip }, async () => {
  assert.ok(fixture, "fixture must exist");
  await placeFixtureOrder();

  const order = await prisma.order.findFirstOrThrow({
    where: { storeId: fixture.storeId },
    orderBy: { placedAt: "desc" },
    select: { id: true, storeId: true, status: true },
  });

  const next = allowedNextStatuses(order.status);
  assert.ok(next.length > 0, `order ${order.status} should have a next status`);

  const valid = await updateOrderStatus(fixture.actor, order.storeId, order.id, { status: next[0]! });
  assert.equal(valid.status, next[0]);

  // A transition that is not in the table must be rejected.
  const impossible = (["PENDING_PAYMENT", "PAID", "CONFIRMED", "PROCESSING", "SHIPPED", "DELIVERED", "CANCELLED", "REFUNDED"] as const).find(
    (status) => !canTransition(next[0]!, status),
  );
  if (impossible) {
    await assert.rejects(
      () => updateOrderStatus(fixture!.actor, order.storeId, order.id, { status: impossible }),
      /যাওয়া যাবে না/,
    );
  }
});
