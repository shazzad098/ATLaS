import { prisma } from "@/lib/db";
import { PLAN_DEFINITIONS, type PlanCode } from "@/lib/plans";
import { PERMISSIONS, SYSTEM_ROLES, type ActorContext } from "@/lib/rbac";

/**
 * Database fixtures for integration tests.
 *
 * The service layer is the heart of ATLaS — checkout, billing, payments and the
 * entitlement gates all live there — so it is tested against a real PostgreSQL
 * schema rather than mocks. Those tests only run when `RUN_DB_TESTS=1` and a
 * disposable `DATABASE_URL` is present, which CI provides; `npm test` remains a
 * fast, database-free unit run.
 *
 * Every fixture creates its own tenant with a unique suffix and removes exactly
 * what it created, so a shared development database is never left dirty.
 */

export const dbTestsEnabled =
  process.env.RUN_DB_TESTS === "1" && Boolean(process.env.DATABASE_URL);

export const DB_TEST_SKIP = dbTestsEnabled
  ? false
  : "set RUN_DB_TESTS=1 with a disposable DATABASE_URL to run integration tests";

/** Short, collision-free suffix so parallel/repeat runs never clash. */
export function uniqueSuffix(): string {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

/**
 * Prisma 7 accepts a decimal string for `Decimal` columns at runtime, so no cast
 * is needed; the helper only documents intent at the fixture boundary.
 */
function decimal(value: string): string {
  return value;
}

/** Plans are global rows; make sure the four codes exist before billing runs. */
export async function ensurePlans(): Promise<Record<PlanCode, string>> {
  const ids = {} as Record<PlanCode, string>;
  for (const code of Object.keys(PLAN_DEFINITIONS) as PlanCode[]) {
    const definition = PLAN_DEFINITIONS[code];
    const monthly = definition.monthlyPriceBdt ?? 0;
    const yearly = definition.yearlyPriceBdt ?? monthly * 12;
    const plan = await prisma.plan.upsert({
      where: { code },
      create: {
        code,
        name: definition.name,
        description: definition.description,
        price: decimal(monthly.toFixed(2)),
        yearlyPrice: decimal(yearly.toFixed(2)),
        currency: "BDT",
        trialDays: definition.trialDays,
        sortOrder: definition.sortOrder,
        isPublic: true,
        limitsJson: definition.$limits as never,
        featuresJson: definition.$features as never,
        status: "ACTIVE",
      },
      update: {
        price: decimal(monthly.toFixed(2)),
        yearlyPrice: decimal(yearly.toFixed(2)),
        limitsJson: definition.$limits as never,
        featuresJson: definition.$features as never,
        status: "ACTIVE",
      },
    });
    ids[code] = plan.id;
  }
  return ids;
}

export type StoreFixture = {
  tenantId: string;
  userId: string;
  storeId: string;
  slug: string;
  productId: string;
  variantId: string;
  sku: string;
  actor: ActorContext;
  cleanup: () => Promise<void>;
};

export type StoreFixtureOptions = {
  planCode?: PlanCode;
  published?: boolean;
  price?: string;
  stock?: number;
  /** Extra payment methods to enable besides COD (BKASH/NAGAD/SSLCOMMERZ). */
  gateways?: Array<"BKASH" | "NAGAD" | "SSLCOMMERZ">;
};

/**
 * A complete, published storefront: tenant + owner membership + active
 * subscription + store + settings + delivery zone + payment methods + one
 * product variant with stock.
 */
export async function createStoreFixture(
  options: StoreFixtureOptions = {},
): Promise<StoreFixture> {
  const {
    planCode = "basic",
    published = true,
    price = "500.00",
    stock = 10,
    gateways = [],
  } = options;

  const plans = await ensurePlans();
  const suffix = uniqueSuffix();
  const now = new Date();

  const user = await prisma.user.create({
    data: {
      phone: `+8801${suffix}`,
      email: `fixture-${suffix}@atlas.test`,
      name: `Fixture ${suffix}`,
      status: "ACTIVE",
      phoneVerifiedAt: now,
    },
  });

  const tenant = await prisma.tenant.create({
    data: { name: `Tenant ${suffix}`, ownerUserId: user.id, status: "ACTIVE" },
  });

  const role = await prisma.role.create({
    data: {
      tenantId: tenant.id,
      code: "OWNER",
      name: SYSTEM_ROLES.OWNER.name,
      permissionsJson: [...PERMISSIONS] as never,
      isSystem: true,
    },
  });

  await prisma.membership.create({
    data: {
      tenantId: tenant.id,
      userId: user.id,
      roleId: role.id,
      status: "ACTIVE",
      acceptedAt: now,
    },
  });

  await prisma.subscription.create({
    data: {
      tenantId: tenant.id,
      planId: plans[planCode],
      status: "ACTIVE",
      currentPeriodStart: now,
      currentPeriodEnd: new Date(now.getTime() + 30 * 86_400_000),
    },
  });

  const store = await prisma.store.create({
    data: {
      tenantId: tenant.id,
      name: `Store ${suffix}`,
      slug: `test-${suffix}`,
      status: published ? "PUBLISHED" : "DRAFT",
      publishedAt: published ? now : null,
    },
  });

  await prisma.storeSettings.create({
    data: {
      storeId: store.id,
      contactJson: { phone: "+8801700000000", email: "store@atlas.test" } as never,
      checkoutJson: { codAutoConfirm: true } as never,
    },
  });

  await prisma.deliveryZone.create({
    data: {
      storeId: store.id,
      name: "ঢাকা সিটি",
      charge: decimal("60.00"),
      isDefault: true,
      isActive: true,
    },
  });

  for (const provider of ["COD", ...gateways] as const) {
    await prisma.paymentMethod.create({
      data: {
        storeId: store.id,
        provider,
        isEnabled: true,
        publicConfigJson: (provider === "COD" ? {} : { sandbox: true }) as never,
      },
    });
  }

  const product = await prisma.product.create({
    data: {
      storeId: store.id,
      name: `Product ${suffix}`,
      slug: `product-${suffix}`,
      status: "ACTIVE",
      publishedAt: now,
      descriptionJson: { html: "<p>fixture</p>" } as never,
    },
  });

  const sku = `SKU-${suffix}`;
  const variant = await prisma.productVariant.create({
    data: {
      productId: product.id,
      sku,
      price: decimal(price),
      stockQty: stock,
      status: "ACTIVE",
    },
  });

  const actor: ActorContext = {
    userId: user.id,
    tenantId: tenant.id,
    roleCode: "OWNER",
    permissions: [...PERMISSIONS],
  };

  return {
    tenantId: tenant.id,
    userId: user.id,
    storeId: store.id,
    slug: store.slug,
    productId: product.id,
    variantId: variant.id,
    sku,
    actor,
    cleanup: async () => {
      // Store-scoped rows cascade from the tenant; the owner user is separate.
      await prisma.tenant.deleteMany({ where: { id: tenant.id } });
      await prisma.user.deleteMany({ where: { id: user.id } });
    },
  };
}

/** Current stock/reserved counters for assertions. */
export async function variantStock(variantId: string): Promise<{ stock: number; reserved: number }> {
  const row = await prisma.productVariant.findUniqueOrThrow({
    where: { id: variantId },
    select: { stockQty: true, reservedQty: true },
  });
  return { stock: row.stockQty, reserved: row.reservedQty };
}
