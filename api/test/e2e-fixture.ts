import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

/**
 * The API e2e suites build their own tenant/store/order fixture instead of
 * depending on demo data, so they run against a production-shaped database.
 */
export async function createE2EFixture() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL is required for the API e2e fixture");
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString, max: 2 }),
  });
  const suffix = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;

  const user = await prisma.user.create({
    data: {
      phone: `+88017${String(Math.floor(Math.random() * 100_000_000)).padStart(8, "0")}`,
      name: "API E2E Owner",
      status: "ACTIVE",
    },
  });
  const tenant = await prisma.tenant.create({
    data: { name: `API E2E ${suffix}`, ownerUserId: user.id, status: "ACTIVE" },
  });
  const store = await prisma.store.create({
    data: {
      tenantId: tenant.id,
      name: `API E2E Store ${suffix}`,
      slug: `api-e2e-${suffix}`,
      status: "PUBLISHED",
      publishedAt: new Date(),
    },
  });
  const order = await prisma.order.create({
    data: {
      storeId: store.id,
      orderNo: `E2E-${suffix}`,
      customerName: "API E2E Buyer",
      customerPhone: "+8801700000000",
      status: "PENDING_PAYMENT",
      subtotal: "100.00",
      grandTotal: "100.00",
      items: {
        create: [
          {
            nameSnapshot: "E2E item",
            quantity: 1,
            unitPrice: "100.00",
            lineTotal: "100.00",
          },
        ],
      },
    },
  });

  return {
    prisma,
    storeId: store.id,
    orderId: order.id,
    async cleanup() {
      await prisma.tenant.deleteMany({ where: { id: tenant.id } });
      await prisma.user.deleteMany({ where: { id: user.id } });
      await prisma.$disconnect();
    },
  };
}
