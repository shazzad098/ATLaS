import "dotenv/config";
import test from "node:test";
import assert from "node:assert/strict";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client.ts";

/**
 * Tenant-isolation integration check.
 *
 * Runs only with `RUN_DB_TESTS=1` (CI does this against an ephemeral Postgres).
 * It seeds two independent tenants and then asserts that every store-scoped
 * read returns only the requested store/tenant — the failure mode that would
 * leak another merchant's orders, exports or webhook endpoints.
 */

const enabled = process.env.RUN_DB_TESTS === "1" && Boolean(process.env.DATABASE_URL);

const prisma = enabled
  ? new PrismaClient({
      adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL, max: 2 }),
    })
  : null;

test(
  "store and tenant scoped reads never cross merchant boundaries",
  { skip: !enabled ? "set RUN_DB_TESTS=1 with a disposable database" : false },
  async () => {
    assert.ok(prisma);
    const suffix = Date.now().toString(36);

    const [userA, userB] = await Promise.all([
      prisma.user.create({ data: { phone: `+8801700${suffix}1`, status: "ACTIVE" } }),
      prisma.user.create({ data: { phone: `+8801700${suffix}2`, status: "ACTIVE" } }),
    ]);

    const [tenantA, tenantB] = await Promise.all([
      prisma.tenant.create({ data: { name: `Tenant A ${suffix}`, ownerUserId: userA.id } }),
      prisma.tenant.create({ data: { name: `Tenant B ${suffix}`, ownerUserId: userB.id } }),
    ]);

    const [storeA, storeB] = await Promise.all([
      prisma.store.create({ data: { tenantId: tenantA.id, name: "Store A", slug: `iso-a-${suffix}` } }),
      prisma.store.create({ data: { tenantId: tenantB.id, name: "Store B", slug: `iso-b-${suffix}` } }),
    ]);

    try {
      await Promise.all([
        prisma.order.create({
          data: {
            storeId: storeA.id,
            orderNo: `A-${suffix}`,
            customerName: "A Customer",
            customerPhone: "01700000001",
            subtotal: "100.00",
            grandTotal: "100.00",
          },
        }),
        prisma.order.create({
          data: {
            storeId: storeB.id,
            orderNo: `B-${suffix}`,
            customerName: "B Customer",
            customerPhone: "01700000002",
            subtotal: "200.00",
            grandTotal: "200.00",
          },
        }),
        prisma.webhookEndpoint.create({
          data: { tenantId: tenantA.id, url: "https://a.example/webhook", secret: "a-secret" },
        }),
        prisma.webhookEndpoint.create({
          data: { tenantId: tenantB.id, url: "https://b.example/webhook", secret: "b-secret" },
        }),
        prisma.exportJob.create({
          data: { tenantId: tenantA.id, storeId: storeA.id, type: "orders" },
        }),
        prisma.exportJob.create({
          data: { tenantId: tenantB.id, storeId: storeB.id, type: "orders" },
        }),
      ]);

      const [ordersA, ordersB, endpointsA, jobsB] = await Promise.all([
        prisma.order.findMany({ where: { storeId: storeA.id }, select: { orderNo: true } }),
        prisma.order.findMany({ where: { storeId: storeB.id }, select: { orderNo: true } }),
        prisma.webhookEndpoint.findMany({ where: { tenantId: tenantA.id }, select: { url: true } }),
        prisma.exportJob.findMany({ where: { tenantId: tenantB.id }, select: { storeId: true } }),
      ]);

      assert.deepEqual(ordersA.map((order) => order.orderNo), [`A-${suffix}`]);
      assert.deepEqual(ordersB.map((order) => order.orderNo), [`B-${suffix}`]);
      assert.deepEqual(endpointsA.map((endpoint) => endpoint.url), ["https://a.example/webhook"]);
      assert.deepEqual(jobsB.map((job) => job.storeId), [storeB.id]);
      assert.ok(!ordersA.some((order) => order.orderNo === `B-${suffix}`));
      assert.ok(!jobsB.some((job) => job.storeId === storeA.id));
    } finally {
      await prisma.tenant.deleteMany({ where: { id: { in: [tenantA.id, tenantB.id] } } });
      await prisma.user.deleteMany({ where: { id: { in: [userA.id, userB.id] } } });
      await prisma.$disconnect();
    }
  },
);
