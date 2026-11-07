import "dotenv/config";
import test from "node:test";
import assert from "node:assert/strict";
import { Client } from "pg";
import { applyRlsContext, prisma } from "@/lib/db";
import { DB_TEST_SKIP, createStoreFixture } from "@/lib/testing/fixtures";

/**
 * Row-Level Security is the last line of defence for tenant isolation: even a
 * query that forgets its `tenantId` filter must not cross a merchant boundary.
 *
 * These tests connect with plain `pg` and switch into the runtime role
 * (`atlas_app`) exactly like `src/lib/db.ts` does, because the application
 * client connects as the owner, which bypasses RLS by design. Without this
 * test the 126 policies in the migrations would never be executed by CI.
 */

const connectionString = process.env.DATABASE_URL ?? "";

async function withRuntimeRole<T>(
  context: Record<string, string>,
  run: (client: Client) => Promise<T>,
): Promise<T> {
  const client = new Client({ connectionString });
  await client.connect();
  try {
    await client.query("BEGIN");
    await client.query("SET LOCAL ROLE atlas_app");
    for (const [key, value] of Object.entries(context)) {
      await client.query("SELECT set_config($1, $2, true)", [key, value]);
    }
    return await run(client);
  } finally {
    await client.query("ROLLBACK").catch(() => undefined);
    await client.end();
  }
}

async function seedTwoMerchants() {
  const a = await createStoreFixture();
  const b = await createStoreFixture();

  const customerA = await prisma.customer.create({
    data: { storeId: a.storeId, name: "Buyer A", phone: `01711${Date.now() % 10000000}` },
  });

  for (const [fx, customerId, suffix] of [
    [a, customerA.id, "A"],
    [b, null, "B"],
  ] as const) {
    await prisma.order.create({
      data: {
        storeId: fx.storeId,
        orderNo: `RLS-${suffix}-${Date.now().toString(36)}`,
        customerId: customerId ?? undefined,
        customerName: `Buyer ${suffix}`,
        customerPhone: "01700000000",
        subtotal: "100.00",
        grandTotal: "100.00",
      },
    });
  }

  return { a, b, customerA };
}

test(
  "rls: a merchant sees only its own tenant's stores, products and orders",
  { skip: DB_TEST_SKIP },
  async () => {
    const { a, b, customerA } = await seedTwoMerchants();
    try {
      const visible = await withRuntimeRole({ "app.user_id": a.userId }, async (client) => {
        const stores = await client.query<{ id: string }>('SELECT "id" FROM "Store"');
        const products = await client.query<{ id: string }>('SELECT "id" FROM "Product"');
        const orders = await client.query<{ id: string }>('SELECT "id" FROM "Order"');
        return {
          stores: stores.rows.map((row) => row.id),
          products: products.rows.map((row) => row.id),
          orders: orders.rows.map((row) => row.id),
        };
      });

      assert.deepEqual(visible.stores, [a.storeId]);
      assert.ok(visible.products.includes(a.productId));
      assert.ok(!visible.products.includes(b.productId));

      const order = await prisma.order.findFirstOrThrow({ where: { storeId: a.storeId } });
      const otherOrder = await prisma.order.findFirstOrThrow({ where: { storeId: b.storeId } });
      assert.ok(visible.orders.includes(order.id));
      assert.ok(!visible.orders.includes(otherOrder.id));

      // The buyer scope is separate: a shopper signed in at store A sees A's
      // orders but nothing from store B.
      const buyerView = await withRuntimeRole(
        {
          "app.customer_id": customerA.id,
          "app.store_id": a.storeId,
        },
        async (client) => {
          const result = await client.query<{ id: string }>('SELECT "id" FROM "Order"');
          return result.rows.map((row) => row.id);
        },
      );
      assert.deepEqual(buyerView, [order.id]);
    } finally {
      await a.cleanup();
      await b.cleanup();
    }
  },
);

test(
  "rls: the application's own context statement switches the runtime role",
  { skip: DB_TEST_SKIP },
  async () => {
    const fx = await createStoreFixture();
    try {
      // This runs `applyRlsContext` — the exact statement `src/lib/db.ts` issues
      // for every authenticated query — so a change to that SQL is covered by a
      // test instead of being trusted.
      const stranger = await prisma.$transaction(async (tx) => {
        await applyRlsContext(tx, { userId: "not-a-member" });
        const [who] = await tx.$queryRaw<{ who: string }[]>`SELECT current_user AS who`;
        const [stores] = await tx.$queryRaw<{ n: number }[]>`SELECT count(*)::int AS n FROM "Store"`;
        const [setting] = await tx.$queryRaw<{ u: string | null }[]>`
          SELECT current_setting('app.user_id', true) AS u
        `;
        return { who: who.who, stores: Number(stores.n), userId: setting.u };
      });

      assert.equal(stranger.who, "atlas_app");
      assert.equal(stranger.userId, "not-a-member");
      assert.equal(stranger.stores, 0);

      const member = await prisma.$transaction(async (tx) => {
        await applyRlsContext(tx, { userId: fx.userId });
        const rows = await tx.$queryRaw<{ id: string }[]>`SELECT "id" FROM "Store"`;
        return rows.map((row) => row.id);
      });

      assert.deepEqual(member, [fx.storeId]);
    } finally {
      await fx.cleanup();
    }
  },
);

test(
  "rls: an unauthenticated runtime role sees no merchant rows",
  { skip: DB_TEST_SKIP },
  async () => {
    const fx = await createStoreFixture();
    try {
      const counts = await withRuntimeRole({}, async (client) => {
        const stores = await client.query<{ count: string }>('SELECT count(*)::text AS count FROM "Store"');
        const orders = await client.query<{ count: string }>('SELECT count(*)::text AS count FROM "Order"');
        return { stores: Number(stores.rows[0].count), orders: Number(orders.rows[0].count) };
      });

      assert.equal(counts.stores, 0);
      assert.equal(counts.orders, 0);
    } finally {
      await fx.cleanup();
    }
  },
);

test(
  "rls: the documented platform bypass is the only way to read across tenants",
  { skip: DB_TEST_SKIP },
  async () => {
    const { a, b } = await seedTwoMerchants();
    try {
      const counts = await withRuntimeRole({ "app.bypass": "on" }, async (client) => {
        const stores = await client.query<{ count: string }>('SELECT count(*)::text AS count FROM "Store"');
        const orders = await client.query<{ count: string }>('SELECT count(*)::text AS count FROM "Order"');
        return { stores: Number(stores.rows[0].count), orders: Number(orders.rows[0].count) };
      });

      // At least the two fixture stores are visible; other rows in the database
      // are counted too, so assert "more than one" rather than an exact number.
      assert.ok(counts.stores >= 2);
      assert.ok(counts.orders >= 2);
      assert.ok(counts.stores > 0 && counts.orders > 0);
      void a;
      void b;
    } finally {
      await a.cleanup();
      await b.cleanup();
    }
  },
);
