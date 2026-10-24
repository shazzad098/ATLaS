import { prisma } from "@/lib/db";
import { fromPaisa, toPaisa } from "@/lib/money";
import { recordAudit } from "@/lib/audit";
import { NotFoundError } from "@/lib/errors";
import { SUCCESSFUL_ORDER_STATUSES } from "@/lib/order-status";
import { loadEntitlementSnapshot } from "@/lib/entitlements";
import {
  PLAN_DEFINITIONS,
  planMatrixFor,
  type PlanCode,
  type PlanFeatures,
  type PlanLimits,
} from "@/lib/plans";

/**
 * Super Admin platform reads (PRD §4.5, §8).
 *
 * These queries deliberately span tenants, so they are never reachable from the
 * merchant admin surface — every caller goes through `requireSuperAdmin()`.
 *
 * The merchant panel and this service read the same tables (`Product`,
 * `Order`, `Asset`, `Membership`, `Subscription`, `StoreTheme`), so the numbers
 * an operator sees here are the numbers the merchant sees on `/admin`.
 */

export type PlatformOverview = {
  tenants: { total: number; active: number; suspended: number; byStatus: Array<{ status: string; count: number }> };
  stores: { total: number; published: number };
  catalog: { products: number; customers: number };
  orders: { total: number; cancelledOrRefunded: number; gmv: string; paidGmv: string };
};

export async function platformOverview(): Promise<PlatformOverview> {
  const [
    tenantByStatus,
    storeCount,
    publishedStoreCount,
    productCount,
    customerCount,
    orderCount,
    gmvAgg,
    paidAgg,
    cancelled,
  ] = await Promise.all([
    prisma.tenant.groupBy({ by: ["status"], _count: { _all: true } }),
    prisma.store.count({ where: { deletedAt: null } }),
    prisma.store.count({ where: { deletedAt: null, status: "PUBLISHED" } }),
    prisma.product.count({ where: { deletedAt: null, status: { not: "ARCHIVED" } } }),
    prisma.customer.count(),
    prisma.order.count({ where: { deletedAt: null, status: { in: [...SUCCESSFUL_ORDER_STATUSES] } } }),
    prisma.order.aggregate({
      where: { deletedAt: null, status: { in: [...SUCCESSFUL_ORDER_STATUSES] } },
      _sum: { grandTotal: true },
    }),
    prisma.order.aggregate({
      where: { deletedAt: null, status: { in: [...SUCCESSFUL_ORDER_STATUSES] }, paymentStatus: "PAID" },
      _sum: { grandTotal: true },
    }),
    prisma.order.count({ where: { deletedAt: null, status: { in: ["CANCELLED", "REFUNDED"] } } }),
  ]);

  const totalTenants = tenantByStatus.reduce((sum, row) => sum + row._count._all, 0);

  return {
    tenants: {
      total: totalTenants,
      active: tenantByStatus.find((row) => row.status === "ACTIVE")?._count._all ?? 0,
      suspended: tenantByStatus.find((row) => row.status === "SUSPENDED")?._count._all ?? 0,
      byStatus: tenantByStatus.map((row) => ({ status: row.status, count: row._count._all })),
    },
    stores: { total: storeCount, published: publishedStoreCount },
    catalog: { products: productCount, customers: customerCount },
    orders: {
      total: orderCount,
      cancelledOrRefunded: cancelled,
      gmv: fromPaisa(toPaisa(gmvAgg._sum.grandTotal ?? 0)),
      paidGmv: fromPaisa(toPaisa(paidAgg._sum.grandTotal ?? 0)),
    },
  };
}

// ── Shared helpers ───────────────────────────────────────────────────────────

export type TenantLimits = {
  products: number | null;
  monthlyOrders: number | null;
  storageMb: number | null;
  staffSeats: number;
};

/** A stored `null` means "unlimited", so presence — not truthiness — decides. */
function pickLimit<K extends keyof PlanLimits>(
  stored: Partial<PlanLimits>,
  base: PlanLimits,
  key: K,
): PlanLimits[K] {
  return key in stored ? (stored[key] as PlanLimits[K]) : base[key];
}

export function tenantLimitsFor(
  plan: { code: string; limitsJson?: unknown } | null | undefined,
): TenantLimits {
  const code = (plan?.code && plan.code in PLAN_DEFINITIONS ? plan.code : "free") as PlanCode;
  const base = planMatrixFor(code).$limits;
  const stored = (plan?.limitsJson ?? {}) as Partial<PlanLimits>;
  return {
    products: pickLimit(stored, base, "products"),
    monthlyOrders: pickLimit(stored, base, "monthlyOrders"),
    storageMb: pickLimit(stored, base, "storageMb"),
    staffSeats: pickLimit(stored, base, "staffSeats"),
  };
}

function themeOfStore(
  store: {
    themes: Array<{ themeVersion: { theme: { code: string; name: string } } }>;
  },
): { code: string | null; name: string | null } {
  const theme = store.themes[0]?.themeVersion.theme;
  return { code: theme?.code ?? null, name: theme?.name ?? null };
}

// ── Tenant list ──────────────────────────────────────────────────────────────

export type TenantRow = {
  id: string;
  name: string;
  status: string;
  createdAt: Date;
  owner: { name: string | null; phone: string; email: string | null };
  planCode: string;
  planName: string;
  subscriptionStatus: string;
  billingPeriod: string;
  currentPeriodEnd: Date | null;
  storeCount: number;
  membershipCount: number;
  orderCount: number;
  gmv: string;
  pendingFees: string;
  productCount: number;
  customerCount: number;
  storageMb: number;
  themeCode: string | null;
  themeName: string | null;
  limits: TenantLimits;
};

export async function listTenantsForAdmin(options: { page?: number; pageSize?: number; search?: string } = {}) {
  const pageSize = Math.min(Math.max(options.pageSize ?? 50, 10), 100);
  const page = Math.max(options.page ?? 1, 1);
  const search = options.search?.trim();
  const where = search
    ? {
        OR: [
          { name: { contains: search, mode: "insensitive" as const } },
          { owner: { phone: { contains: search } } },
          { owner: { email: { contains: search, mode: "insensitive" as const } } },
        ],
      }
    : {};
  const [tenants, total] = await Promise.all([
    prisma.tenant.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        owner: { select: { name: true, phone: true, email: true } },
        subscription: { include: { plan: true } },
        _count: { select: { stores: true, memberships: true } },
      },
    }),
    prisma.tenant.count({ where }),
  ]);

  const tenantIds = tenants.map((tenant) => tenant.id);
  const [feeRows, orderRows, stores, productRows, customerRows, assetRows, themeRows] = await Promise.all([
    prisma.feeLedger.groupBy({
      by: ["tenantId"],
      where: { tenantId: { in: tenantIds }, reversedAt: null, status: "PENDING" },
      _sum: { feeAmount: true },
    }),
    prisma.order.groupBy({
      by: ["storeId"],
      where: {
        store: { tenantId: { in: tenantIds } },
        deletedAt: null,
        status: { in: [...SUCCESSFUL_ORDER_STATUSES] },
      },
      _count: { _all: true },
      _sum: { grandTotal: true },
    }),
    prisma.store.findMany({
      where: { tenantId: { in: tenantIds } },
      select: { id: true, tenantId: true },
    }),
    prisma.product.groupBy({
      by: ["storeId"],
      where: {
        store: { tenantId: { in: tenantIds } },
        deletedAt: null,
        status: { not: "ARCHIVED" },
      },
      _count: { _all: true },
    }),
    prisma.customer.groupBy({
      by: ["storeId"],
      where: { store: { tenantId: { in: tenantIds } } },
      _count: { _all: true },
    }),
    prisma.asset.groupBy({
      by: ["storeId"],
      where: { store: { tenantId: { in: tenantIds } } },
      _sum: { sizeBytes: true },
    }),
    prisma.storeTheme.findMany({
      where: { isSelected: true, store: { tenantId: { in: tenantIds } } },
      select: { storeId: true, themeVersion: { select: { theme: { select: { code: true, name: true } } } } },
    }),
  ]);

  const tenantOfStore = new Map(stores.map((store) => [store.id, store.tenantId]));

  const ordersByTenant = new Map<string, { count: number; gmv: bigint }>();
  for (const row of orderRows) {
    const tenantId = tenantOfStore.get(row.storeId);
    if (!tenantId) continue;
    const bucket = ordersByTenant.get(tenantId) ?? { count: 0, gmv: 0n };
    ordersByTenant.set(tenantId, {
      count: bucket.count + row._count._all,
      gmv: bucket.gmv + toPaisa(row._sum.grandTotal ?? 0),
    });
  }

  const productsByTenant = new Map<string, number>();
  for (const row of productRows) {
    const tenantId = tenantOfStore.get(row.storeId);
    if (!tenantId) continue;
    productsByTenant.set(tenantId, (productsByTenant.get(tenantId) ?? 0) + row._count._all);
  }

  const customersByTenant = new Map<string, number>();
  for (const row of customerRows) {
    const tenantId = tenantOfStore.get(row.storeId);
    if (!tenantId) continue;
    customersByTenant.set(tenantId, (customersByTenant.get(tenantId) ?? 0) + row._count._all);
  }

  const bytesByTenant = new Map<string, number>();
  for (const row of assetRows) {
    if (!row.storeId) continue;
    const tenantId = tenantOfStore.get(row.storeId);
    if (!tenantId) continue;
    bytesByTenant.set(tenantId, (bytesByTenant.get(tenantId) ?? 0) + (row._sum.sizeBytes ?? 0));
  }

  const themeByTenant = new Map<string, { code: string; name: string }>();
  for (const row of themeRows) {
    const tenantId = tenantOfStore.get(row.storeId);
    if (!tenantId || themeByTenant.has(tenantId)) continue;
    themeByTenant.set(tenantId, row.themeVersion.theme);
  }

  const feesByTenant = new Map(
    feeRows.map((row) => [row.tenantId, fromPaisa(toPaisa(row._sum.feeAmount ?? 0))]),
  );

  const rows: TenantRow[] = tenants.map((tenant) => {
    const orders = ordersByTenant.get(tenant.id) ?? { count: 0, gmv: 0n };
    const theme = themeByTenant.get(tenant.id);
    return {
      id: tenant.id,
      name: tenant.name,
      status: tenant.status,
      createdAt: tenant.createdAt,
      owner: tenant.owner,
      planCode: tenant.subscription?.plan.code ?? "free",
      planName: tenant.subscription?.plan.name ?? "Free",
      subscriptionStatus: tenant.subscription?.status ?? "ACTIVE",
      billingPeriod: tenant.subscription?.billingPeriod ?? "MONTHLY",
      currentPeriodEnd: tenant.subscription?.currentPeriodEnd ?? null,
      storeCount: tenant._count.stores,
      membershipCount: tenant._count.memberships,
      orderCount: orders.count,
      gmv: fromPaisa(orders.gmv),
      pendingFees: feesByTenant.get(tenant.id) ?? "0.00",
      productCount: productsByTenant.get(tenant.id) ?? 0,
      customerCount: customersByTenant.get(tenant.id) ?? 0,
      storageMb: Math.ceil((bytesByTenant.get(tenant.id) ?? 0) / (1024 * 1024)),
      themeCode: theme?.code ?? null,
      themeName: theme?.name ?? null,
      limits: tenantLimitsFor(tenant.subscription?.plan),
    };
  });

  return { rows, page, pageSize, total, hasMore: page * pageSize < total };
}

// ── Dashboard ────────────────────────────────────────────────────────────────

export type PlanSlice = {
  code: string;
  name: string;
  tenantCount: number;
  monthlyPrice: number | null;
  mrr: string;
};

export type PlatformDashboard = {
  tenants: {
    total: number;
    active: number;
    suspended: number;
    trialing: number;
    newThisMonth: number;
    byStatus: Array<{ status: string; count: number }>;
  };
  stores: { total: number; published: number };
  catalog: { products: number; customers: number };
  orders: { total: number; cancelledOrRefunded: number; gmv: string; paidGmv: string };
  usage: { storageMb: number; products: number; orders: number };
  plans: PlanSlice[];
  topTenants: Array<{
    id: string;
    name: string;
    planCode: string;
    planName: string;
    storeCount: number;
    orderCount: number;
    gmv: string;
    storageMb: number;
    productCount: number;
    pendingFees: string;
  }>;
  recentTenants: Array<{
    id: string;
    name: string;
    status: string;
    planName: string;
    createdAt: Date;
    storeCount: number;
  }>;
  attention: Array<{ id: string; name: string; reason: string; tone: "warning" | "danger" }>;
  openTickets: number;
};

export async function platformDashboard(): Promise<PlatformDashboard> {
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);

  const [
    tenants,
    stores,
    productCount,
    customerCount,
    successfulAgg,
    cancelledCount,
    paidAgg,
    subscriptions,
    assetRows,
    productRows,
    orderRows,
    feeRows,
    openTickets,
  ] = await Promise.all([
    prisma.tenant.findMany({
      select: { id: true, name: true, status: true, createdAt: true },
      orderBy: { createdAt: "desc" },
    }),
    prisma.store.findMany({ where: { deletedAt: null }, select: { id: true, tenantId: true, status: true } }),
    prisma.product.count({ where: { deletedAt: null, status: { not: "ARCHIVED" } } }),
    prisma.customer.count(),
    prisma.order.aggregate({
      where: { deletedAt: null, status: { in: [...SUCCESSFUL_ORDER_STATUSES] } },
      _count: { _all: true },
      _sum: { grandTotal: true },
    }),
    prisma.order.count({ where: { deletedAt: null, status: { in: ["CANCELLED", "REFUNDED"] } } }),
    prisma.order.aggregate({
      where: { deletedAt: null, status: { in: [...SUCCESSFUL_ORDER_STATUSES] }, paymentStatus: "PAID" },
      _sum: { grandTotal: true },
    }),
    prisma.subscription.findMany({ include: { plan: true } }),
    prisma.asset.groupBy({ by: ["storeId"], _sum: { sizeBytes: true } }),
    prisma.product.groupBy({
      by: ["storeId"],
      where: { deletedAt: null, status: { not: "ARCHIVED" } },
      _count: { _all: true },
    }),
    prisma.order.groupBy({
      by: ["storeId"],
      where: { deletedAt: null, status: { in: [...SUCCESSFUL_ORDER_STATUSES] } },
      _count: { _all: true },
      _sum: { grandTotal: true },
    }),
    prisma.feeLedger.groupBy({
      by: ["tenantId"],
      where: { reversedAt: null, status: "PENDING" },
      _sum: { feeAmount: true },
    }),
    prisma.supportTicket.count({ where: { status: { in: ["OPEN", "PENDING"] } } }),
  ]);

  const tenantOfStore = new Map(stores.map((store) => [store.id, store.tenantId]));
  const tenantById = new Map(tenants.map((tenant) => [tenant.id, tenant]));

  const storeCountByTenant = new Map<string, number>();
  for (const store of stores) {
    storeCountByTenant.set(store.tenantId, (storeCountByTenant.get(store.tenantId) ?? 0) + 1);
  }

  const productsByTenant = new Map<string, number>();
  for (const row of productRows) {
    const tenantId = tenantOfStore.get(row.storeId);
    if (!tenantId) continue;
    productsByTenant.set(tenantId, (productsByTenant.get(tenantId) ?? 0) + row._count._all);
  }

  const ordersByTenant = new Map<string, { count: number; gmv: bigint }>();
  for (const row of orderRows) {
    const tenantId = tenantOfStore.get(row.storeId);
    if (!tenantId) continue;
    const bucket = ordersByTenant.get(tenantId) ?? { count: 0, gmv: 0n };
    ordersByTenant.set(tenantId, {
      count: bucket.count + row._count._all,
      gmv: bucket.gmv + toPaisa(row._sum.grandTotal ?? 0),
    });
  }

  const bytesByTenant = new Map<string, number>();
  for (const row of assetRows) {
    if (!row.storeId) continue;
    const tenantId = tenantOfStore.get(row.storeId);
    if (!tenantId) continue;
    bytesByTenant.set(tenantId, (bytesByTenant.get(tenantId) ?? 0) + (row._sum.sizeBytes ?? 0));
  }

  const pendingFeesByTenant = new Map(
    feeRows.map((row) => [row.tenantId, fromPaisa(toPaisa(row._sum.feeAmount ?? 0))]),
  );

  const subscriptionByTenant = new Map(subscriptions.map((row) => [row.tenantId, row]));

  const byStatus = ["ACTIVE", "READ_ONLY", "SUSPENDED", "CANCELLED"].map((status) => ({
    status,
    count: tenants.filter((tenant) => tenant.status === status).length,
  }));

  // Plan mix: every tenant with a subscription, plus tenants still on the
  // implicit Free fallback so the distribution always adds up.
  const planBuckets = new Map<string, { name: string; count: number; monthly: number; mrr: bigint }>();
  for (const tenant of tenants) {
    const subscription = subscriptionByTenant.get(tenant.id);
    const code = subscription?.plan.code ?? "free";
    const bucket =
      planBuckets.get(code) ??
      {
        name: subscription?.plan.name ?? PLAN_DEFINITIONS.free.name,
        count: 0,
        monthly: subscription ? Number(subscription.plan.price) : 0,
        mrr: 0n,
      };
    bucket.count += 1;
    if (subscription && subscription.status !== "CANCELLED" && subscription.status !== "SUSPENDED") {
      const monthly =
        subscription.billingPeriod === "YEARLY"
          ? Number(subscription.plan.yearlyPrice ?? Number(subscription.plan.price) * 12) / 12
          : Number(subscription.plan.price);
      bucket.mrr += toPaisa(monthly);
    }
    planBuckets.set(code, bucket);
  }

  const plans: PlanSlice[] = Array.from(planBuckets.entries())
    .map(([code, bucket]) => ({
      code,
      name: bucket.name,
      tenantCount: bucket.count,
      monthlyPrice: bucket.monthly > 0 ? bucket.monthly : code === "free" ? 0 : null,
      mrr: fromPaisa(bucket.mrr),
    }))
    .sort((a, b) => b.tenantCount - a.tenantCount);

  const topTenants = tenants
    .map((tenant) => {
      const orders = ordersByTenant.get(tenant.id) ?? { count: 0, gmv: 0n };
      const subscription = subscriptionByTenant.get(tenant.id);
      return {
        id: tenant.id,
        name: tenant.name,
        planCode: subscription?.plan.code ?? "free",
        planName: subscription?.plan.name ?? "Free",
        storeCount: storeCountByTenant.get(tenant.id) ?? 0,
        orderCount: orders.count,
        gmv: fromPaisa(orders.gmv),
        storageMb: Math.ceil((bytesByTenant.get(tenant.id) ?? 0) / (1024 * 1024)),
        productCount: productsByTenant.get(tenant.id) ?? 0,
        pendingFees: pendingFeesByTenant.get(tenant.id) ?? "0.00",
      };
    })
    .sort((a, b) => {
      const left = toPaisa(a.gmv);
      const right = toPaisa(b.gmv);
      return left === right ? 0 : left > right ? -1 : 1;
    })
    .slice(0, 6);

  const recentTenants = tenants.slice(0, 5).map((tenant) => ({
    id: tenant.id,
    name: tenant.name,
    status: tenant.status,
    planName: subscriptionByTenant.get(tenant.id)?.plan.name ?? "Free",
    createdAt: tenant.createdAt,
    storeCount: storeCountByTenant.get(tenant.id) ?? 0,
  }));

  const attention: PlatformDashboard["attention"] = [];
  for (const subscription of subscriptions) {
    const tenant = tenantById.get(subscription.tenantId);
    if (!tenant) continue;
    if (["PAST_DUE", "GRACE", "READ_ONLY", "SUSPENDED", "CANCELLED"].includes(subscription.status)) {
      const reason: Record<string, string> = {
        PAST_DUE: "পেমেন্ট বকেয়া",
        GRACE: "গ্রেস পিরিয়ডে আছে",
        READ_ONLY: "Read-only মোডে আছে",
        SUSPENDED: "সাবস্ক্রিপশন স্থগিত",
        CANCELLED: "সাবস্ক্রিপশন বাতিল",
      };
      attention.push({
        id: tenant.id,
        name: tenant.name,
        reason: reason[subscription.status] ?? subscription.status,
        tone: ["READ_ONLY", "SUSPENDED", "CANCELLED"].includes(subscription.status) ? "danger" : "warning",
      });
      continue;
    }

    const limits = tenantLimitsFor(subscription.plan);
    const used = productsByTenant.get(tenant.id) ?? 0;
    if (limits.products !== null && limits.products > 0 && used / limits.products >= 0.8) {
      attention.push({
        id: tenant.id,
        name: tenant.name,
        reason: `পণ্য সীমার ${Math.round((used / limits.products) * 100)}% ব্যবহার`,
        tone: used >= limits.products ? "danger" : "warning",
      });
    }
  }
  for (const tenant of tenants) {
    if (["READ_ONLY", "SUSPENDED", "CANCELLED"].includes(tenant.status) && !attention.some((row) => row.id === tenant.id)) {
      attention.push({ id: tenant.id, name: tenant.name, reason: `টেন্যান্ট ${tenant.status}`, tone: "danger" });
    }
  }

  const totalStorageBytes = assetRows.reduce((sum, row) => sum + (row._sum.sizeBytes ?? 0), 0);

  return {
    tenants: {
      total: tenants.length,
      active: tenants.filter((tenant) => tenant.status === "ACTIVE").length,
      suspended: tenants.filter((tenant) => tenant.status === "SUSPENDED").length,
      trialing: subscriptions.filter((row) => row.status === "TRIALING").length,
      newThisMonth: tenants.filter((tenant) => tenant.createdAt >= monthStart).length,
      byStatus,
    },
    stores: {
      total: stores.length,
      published: stores.filter((store) => store.status === "PUBLISHED").length,
    },
    catalog: { products: productCount, customers: customerCount },
    orders: {
      total: successfulAgg._count._all,
      cancelledOrRefunded: cancelledCount,
      gmv: fromPaisa(toPaisa(successfulAgg._sum.grandTotal ?? 0)),
      paidGmv: fromPaisa(toPaisa(paidAgg._sum.grandTotal ?? 0)),
    },
    usage: {
      storageMb: Math.ceil(totalStorageBytes / (1024 * 1024)),
      products: productCount,
      orders: successfulAgg._count._all,
    },
    plans,
    topTenants,
    recentTenants,
    attention: attention.slice(0, 6),
    openTickets,
  };
}

// ── Tenant detail ────────────────────────────────────────────────────────────

export type TenantDetail = {
  tenant: {
    id: string;
    name: string;
    status: string;
    createdAt: Date;
    timezone: string;
    currency: string;
  };
  owner: { id: string; name: string | null; phone: string; email: string | null; joinedAt: Date };
  subscription: {
    planCode: string;
    planName: string;
    status: string;
    billingPeriod: string;
    monthlyPrice: number;
    trialEnd: Date | null;
    currentPeriodStart: Date;
    currentPeriodEnd: Date | null;
    cancelAtPeriodEnd: boolean;
  };
  limits: PlanLimits;
  features: PlanFeatures;
  usage: { products: number; orders: number; storageMb: number; staffSeats: number };
  memberships: Array<{ id: string; name: string | null; phone: string; role: string; status: string }>;
  stores: Array<{
    id: string;
    name: string;
    slug: string;
    status: string;
    publishedAt: Date | null;
    themeCode: string | null;
    themeName: string | null;
    productCount: number;
    customerCount: number;
    storageMb: number;
    orderCount: number;
    gmv: string;
  }>;
  recentOrders: Array<{
    id: string;
    orderNo: string;
    customerName: string;
    status: string;
    grandTotal: string;
    placedAt: Date;
    storeName: string;
  }>;
  fees: {
    summary: Array<{ status: string; count: number; amount: string }>;
    entries: Array<{
      id: string;
      feeType: string;
      feeAmount: string;
      status: string;
      createdAt: Date;
      storeName: string;
      orderNo: string | null;
    }>;
  };
  invoices: Array<{ id: string; number: string; total: string; status: string; dueAt: Date | null; paidAt: Date | null }>;
  tickets: Array<{ id: string; subject: string; status: string; priority: string; createdAt: Date }>;
  audit: Array<{ id: string; action: string; createdAt: Date; actor: string | null; resourceType: string | null }>;
};

export async function tenantDetailForAdmin(tenantId: string): Promise<TenantDetail | null> {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    include: {
      owner: { select: { id: true, name: true, phone: true, email: true, createdAt: true } },
      subscription: { include: { plan: true } },
      memberships: {
        include: { user: { select: { name: true, phone: true } }, role: { select: { name: true } } },
        orderBy: { createdAt: "asc" },
      },
      stores: {
        where: { deletedAt: null },
        orderBy: { createdAt: "asc" },
        include: {
          themes: {
            where: { isSelected: true },
            include: { themeVersion: { include: { theme: true } } },
          },
        },
      },
    },
  });

  if (!tenant) return null;

  const storeIds = tenant.stores.map((store) => store.id);
  const snapshot = await loadEntitlementSnapshot(tenant.id);

  const [productRows, customerRows, assetRows, orderRows, recentOrders, feeEntries, feeTotals, invoices, tickets, audit] =
    await Promise.all([
      prisma.product.groupBy({
        by: ["storeId"],
        where: { storeId: { in: storeIds }, deletedAt: null, status: { not: "ARCHIVED" } },
        _count: { _all: true },
      }),
      prisma.customer.groupBy({
        by: ["storeId"],
        where: { storeId: { in: storeIds } },
        _count: { _all: true },
      }),
      prisma.asset.groupBy({
        by: ["storeId"],
        where: { storeId: { in: storeIds } },
        _sum: { sizeBytes: true },
      }),
      prisma.order.groupBy({
        by: ["storeId"],
        where: { storeId: { in: storeIds }, deletedAt: null, status: { in: [...SUCCESSFUL_ORDER_STATUSES] } },
        _count: { _all: true },
        _sum: { grandTotal: true },
      }),
      prisma.order.findMany({
        where: { storeId: { in: storeIds }, deletedAt: null },
        orderBy: { placedAt: "desc" },
        take: 8,
        include: { store: { select: { name: true } } },
      }),
      prisma.feeLedger.findMany({
        where: { tenantId },
        orderBy: { createdAt: "desc" },
        take: 8,
        include: { store: { select: { name: true } }, order: { select: { orderNo: true } } },
      }),
      prisma.feeLedger.groupBy({
        by: ["status"],
        where: { tenantId, reversedAt: null },
        _sum: { feeAmount: true },
        _count: { _all: true },
      }),
      prisma.invoice.findMany({ where: { tenantId }, orderBy: { createdAt: "desc" }, take: 5 }),
      prisma.supportTicket.findMany({ where: { tenantId }, orderBy: { createdAt: "desc" }, take: 5 }),
      prisma.auditLog.findMany({
        where: { tenantId },
        orderBy: { createdAt: "desc" },
        take: 10,
        include: { actor: { select: { name: true, phone: true } } },
      }),
    ]);

  const products = new Map(productRows.map((row) => [row.storeId, row._count._all]));
  const customers = new Map(customerRows.map((row) => [row.storeId, row._count._all]));
  const bytes = new Map(assetRows.map((row) => [row.storeId, row._sum.sizeBytes ?? 0]));
  const orders = new Map(
    orderRows.map((row) => [row.storeId, { count: row._count._all, gmv: toPaisa(row._sum.grandTotal ?? 0) }]),
  );

  const subscription = tenant.subscription;
  const planCode = (subscription?.plan.code ?? "free") as PlanCode;

  return {
    tenant: {
      id: tenant.id,
      name: tenant.name,
      status: tenant.status,
      createdAt: tenant.createdAt,
      timezone: tenant.timezone,
      currency: tenant.currency,
    },
    owner: {
      id: tenant.owner.id,
      name: tenant.owner.name,
      phone: tenant.owner.phone,
      email: tenant.owner.email,
      joinedAt: tenant.owner.createdAt,
    },
    subscription: subscription
      ? {
          planCode: subscription.plan.code,
          planName: subscription.plan.name,
          status: subscription.status,
          billingPeriod: subscription.billingPeriod,
          monthlyPrice: Number(subscription.plan.price),
          trialEnd: subscription.trialEnd,
          currentPeriodStart: subscription.currentPeriodStart,
          currentPeriodEnd: subscription.currentPeriodEnd,
          cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
        }
      : {
          planCode,
          planName: PLAN_DEFINITIONS[planCode].name,
          status: "TRIALING",
          billingPeriod: "MONTHLY",
          monthlyPrice: 0,
          trialEnd: null,
          currentPeriodStart: snapshot.currentPeriodStart,
          currentPeriodEnd: snapshot.currentPeriodEnd,
          cancelAtPeriodEnd: false,
        },
    limits: snapshot.limits,
    features: snapshot.features,
    usage: {
      products: snapshot.usage.products,
      orders: snapshot.usage.ordersThisPeriod,
      storageMb: snapshot.usage.storageMb,
      staffSeats: snapshot.usage.staffSeats,
    },
    memberships: tenant.memberships.map((row) => ({
      id: row.id,
      name: row.user.name,
      phone: row.user.phone,
      role: row.role.name,
      status: row.status,
    })),
    stores: tenant.stores.map((store) => {
      const theme = themeOfStore(store);
      const storeOrders = orders.get(store.id) ?? { count: 0, gmv: 0n };
      return {
        id: store.id,
        name: store.name,
        slug: store.slug,
        status: store.status,
        publishedAt: store.publishedAt,
        themeCode: theme.code,
        themeName: theme.name,
        productCount: products.get(store.id) ?? 0,
        customerCount: customers.get(store.id) ?? 0,
        storageMb: Math.ceil((bytes.get(store.id) ?? 0) / (1024 * 1024)),
        orderCount: storeOrders.count,
        gmv: fromPaisa(storeOrders.gmv),
      };
    }),
    recentOrders: recentOrders.map((order) => ({
      id: order.id,
      orderNo: order.orderNo,
      customerName: order.customerName,
      status: order.status,
      grandTotal: fromPaisa(toPaisa(order.grandTotal)),
      placedAt: order.placedAt,
      storeName: order.store.name,
    })),
    fees: {
      summary: feeTotals.map((row) => ({
        status: row.status,
        count: row._count._all,
        amount: fromPaisa(toPaisa(row._sum.feeAmount ?? 0)),
      })),
      entries: feeEntries.map((entry) => ({
        id: entry.id,
        feeType: entry.feeType,
        feeAmount: fromPaisa(toPaisa(entry.feeAmount)),
        status: entry.status,
        createdAt: entry.createdAt,
        storeName: entry.store.name,
        orderNo: entry.order?.orderNo ?? null,
      })),
    },
    invoices: invoices.map((invoice) => ({
      id: invoice.id,
      number: invoice.number,
      total: fromPaisa(toPaisa(invoice.total)),
      status: invoice.status,
      dueAt: invoice.dueAt,
      paidAt: invoice.paidAt,
    })),
    tickets: tickets.map((ticket) => ({
      id: ticket.id,
      subject: ticket.subject,
      status: ticket.status,
      priority: ticket.priority,
      createdAt: ticket.createdAt,
    })),
    audit: audit.map((row) => ({
      id: row.id,
      action: row.action,
      createdAt: row.createdAt,
      actor: row.actor?.name ?? row.actor?.phone ?? null,
      resourceType: row.resourceType,
    })),
  };
}

// ── Fees, themes, tickets, audit, webhooks ───────────────────────────────────

export async function listPlatformFees(options: { limit?: number; status?: string } = {}) {
  const fees = await prisma.feeLedger.findMany({
    where: options.status ? { status: options.status as never } : {},
    orderBy: { createdAt: "desc" },
    take: options.limit ?? 100,
    include: {
      tenant: { select: { name: true } },
      store: { select: { name: true, slug: true } },
      order: { select: { orderNo: true } },
    },
  });

  const totals = await prisma.feeLedger.groupBy({
    by: ["status"],
    _sum: { feeAmount: true },
    _count: { _all: true },
  });

  const summary = totals.map((row) => ({
    status: row.status,
    count: row._count._all,
    amount: fromPaisa(toPaisa(row._sum.feeAmount ?? 0)),
  }));

  return { fees, summary };
}

export async function themeCatalogOverview() {
  const [themes, usage, versionRows] = await Promise.all([
    prisma.theme.findMany({ orderBy: { code: "asc" }, include: { versions: { orderBy: { version: "asc" } } } }),
    prisma.storeTheme.groupBy({ by: ["themeVersionId"], where: { isSelected: true }, _count: { _all: true } }),
    prisma.themeVersion.findMany({ select: { id: true, themeId: true } }),
  ]);

  const themeOfVersion = new Map(versionRows.map((row) => [row.id, row.themeId]));
  const usageByTheme = new Map<string, number>();
  for (const row of usage) {
    const themeId = themeOfVersion.get(row.themeVersionId);
    if (!themeId) continue;
    usageByTheme.set(themeId, (usageByTheme.get(themeId) ?? 0) + row._count._all);
  }

  return themes.map((theme) => ({
    ...theme,
    storeCount: usageByTheme.get(theme.id) ?? 0,
  }));
}

export async function listSupportTickets(options: { status?: string } = {}) {
  return prisma.supportTicket.findMany({
    where: options.status ? { status: options.status as never } : {},
    orderBy: [{ status: "asc" }, { priority: "desc" }, { createdAt: "desc" }],
    take: 200,
    include: { tenant: { select: { id: true, name: true } } },
  });
}

export async function updateSupportTicket(
  actorId: string,
  ticketId: string,
  patch: { status?: string; priority?: string; assignedTo?: string | null },
) {
  const existing = await prisma.supportTicket.findUnique({ where: { id: ticketId } });
  if (!existing) throw new NotFoundError("Support ticket");

  const updated = await prisma.supportTicket.update({
    where: { id: ticketId },
    data: {
      ...(patch.status ? { status: patch.status as never } : {}),
      ...(patch.priority ? { priority: patch.priority as never } : {}),
      ...(patch.assignedTo !== undefined ? { assignedTo: patch.assignedTo } : {}),
    },
  });

  await recordAudit({
    action: "platform.ticket_updated",
    actorId,
    tenantId: existing.tenantId,
    resourceType: "SupportTicket",
    resourceId: ticketId,
    metadata: patch,
  });

  return updated;
}

export async function setTenantStatus(
  actorId: string,
  tenantId: string,
  status: "ACTIVE" | "READ_ONLY" | "SUSPENDED" | "CANCELLED",
) {
  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
  if (!tenant) throw new NotFoundError("Tenant");

  const updated = await prisma.tenant.update({ where: { id: tenantId }, data: { status } });

  await recordAudit({
    action: "platform.tenant_status_changed",
    actorId,
    tenantId,
    resourceType: "Tenant",
    resourceId: tenantId,
    metadata: { from: tenant.status, to: status },
  });

  return updated;
}

export async function listAuditTrail(limit = 30) {
  return prisma.auditLog.findMany({
    orderBy: { createdAt: "desc" },
    take: limit,
    include: {
      tenant: { select: { name: true } },
      actor: { select: { name: true, phone: true } },
    },
  });
}

export async function listWebhookDeliveries(limit = 30) {
  return prisma.webhookDelivery.findMany({
    orderBy: { createdAt: "desc" },
    take: limit,
    include: { tenant: { select: { name: true } } },
  });
}
