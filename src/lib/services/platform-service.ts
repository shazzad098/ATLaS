import { prisma } from "@/lib/db";
import { fromPaisa, toPaisa } from "@/lib/money";
import { recordAudit } from "@/lib/audit";
import { AppError, NotFoundError } from "@/lib/errors";
import { THEME_CATALOG } from "@/lib/theme-catalog";
import { addDays, nextPeriodEnd } from "@/lib/dates";
import { isValidBdPhone, normalizePhone } from "@/lib/auth/phone";
import { ROLE_CODES, SYSTEM_ROLES } from "@/lib/rbac";
import type { Prisma } from "@/generated/prisma/client";

/**
 * Super Admin platform reads (PRD §4.5, §8).
 *
 * These queries deliberately span tenants, so they are never reachable from the
 * merchant admin surface — every caller goes through `requireSuperAdmin()`.
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
    orderAgg,
    paidAgg,
    cancelledCount,
  ] = await Promise.all([
    prisma.tenant.groupBy({ by: ["status"], _count: { _all: true } }),
    prisma.store.count({ where: { deletedAt: null } }),
    prisma.store.count({ where: { deletedAt: null, status: "PUBLISHED" } }),
    prisma.product.count({ where: { deletedAt: null } }),
    prisma.customer.count(),
    prisma.order.aggregate({ where: { deletedAt: null }, _count: { _all: true }, _sum: { grandTotal: true } }),
    prisma.order.aggregate({
      where: { deletedAt: null, paymentStatus: "PAID" },
      _sum: { grandTotal: true },
    }),
    prisma.order.count({ where: { deletedAt: null, status: { in: ["CANCELLED", "REFUNDED"] } } }),
  ]);

  const byStatus = tenantByStatus.map((row) => ({ status: row.status, count: row._count._all }));
  const total = byStatus.reduce((acc, row) => acc + row.count, 0);

  return {
    tenants: {
      total,
      active: byStatus.find((row) => row.status === "ACTIVE")?.count ?? 0,
      suspended: byStatus.find((row) => row.status === "SUSPENDED")?.count ?? 0,
      byStatus,
    },
    stores: { total: storeCount, published: publishedStoreCount },
    catalog: { products: productCount, customers: customerCount },
    orders: {
      total: orderAgg._count._all,
      cancelledOrRefunded: cancelledCount,
      gmv: fromPaisa(toPaisa(orderAgg._sum.grandTotal ?? 0)),
      paidGmv: fromPaisa(toPaisa(paidAgg._sum.grandTotal ?? 0)),
    },
  };
}

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
};

export type TenantListOptions = {
  q?: string;
  status?: string;
  plan?: string;
  /** recent | name | gmv | orders | fees */
  sort?: string;
  page?: number;
  perPage?: number;
};

export type TenantListResult = {
  rows: TenantRow[];
  total: number;
  page: number;
  pageCount: number;
  perPage: number;
};

const TENANT_STATUSES = ["ACTIVE", "READ_ONLY", "SUSPENDED", "CANCELLED"] as const;

export async function listTenantsForAdmin(
  options: TenantListOptions = {},
): Promise<TenantListResult> {
  const q = options.q?.trim() ?? "";
  const status = TENANT_STATUSES.includes(options.status as (typeof TENANT_STATUSES)[number])
    ? (options.status as (typeof TENANT_STATUSES)[number])
    : undefined;
  const plan = options.plan?.trim() || undefined;
  const page = Math.max(1, options.page ?? 1);
  const perPage = Math.min(200, Math.max(1, options.perPage ?? 10));

  const where: Prisma.TenantWhereInput = {};
  if (status) where.status = status;
  if (plan) where.subscription = { plan: { code: plan } };
  if (q) {
    where.OR = [
      { name: { contains: q, mode: "insensitive" } },
      { owner: { name: { contains: q, mode: "insensitive" } } },
      { owner: { phone: { contains: q } } },
      { subscription: { plan: { name: { contains: q, mode: "insensitive" } } } },
    ];
  }

  const [tenants, feeRows, orderRows, stores] = await Promise.all([
    prisma.tenant.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: {
        owner: { select: { name: true, phone: true, email: true } },
        subscription: { include: { plan: true } },
        _count: { select: { stores: true, memberships: true } },
      },
    }),
    prisma.feeLedger.groupBy({
      by: ["tenantId"],
      where: { reversedAt: null, status: "PENDING" },
      _sum: { feeAmount: true },
    }),
    prisma.order.groupBy({
      by: ["storeId"],
      where: { deletedAt: null },
      _count: { _all: true },
      _sum: { grandTotal: true },
    }),
    prisma.store.findMany({ select: { id: true, tenantId: true } }),
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

  const feesByTenant = new Map(
    feeRows.map((row) => [row.tenantId, fromPaisa(toPaisa(row._sum.feeAmount ?? 0))]),
  );

  const rows: TenantRow[] = tenants.map((tenant) => {
    const orders = ordersByTenant.get(tenant.id) ?? { count: 0, gmv: 0n };
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
    };
  });

  switch (options.sort) {
    case "name":
      rows.sort((a, b) => a.name.localeCompare(b.name, "bn"));
      break;
    case "gmv":
      rows.sort((a, b) => Number(b.gmv) - Number(a.gmv));
      break;
    case "orders":
      rows.sort((a, b) => b.orderCount - a.orderCount);
      break;
    case "fees":
      rows.sort((a, b) => Number(b.pendingFees) - Number(a.pendingFees));
      break;
    default:
      rows.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  const total = rows.length;
  const pageCount = Math.max(1, Math.ceil(total / perPage));
  const safePage = Math.min(page, pageCount);

  return {
    rows: rows.slice((safePage - 1) * perPage, safePage * perPage),
    total,
    page: safePage,
    pageCount,
    perPage,
  };
}

function growthPercent(current: number, previous: number): number | null {
  if (previous === 0) return current > 0 ? null : 0;
  return Math.round(((current - previous) / previous) * 100);
}

export type TenantDirectoryStats = {
  tenants: { total: number; active: number; newThisMonth: number; growth: number | null };
  stores: { total: number; newThisMonth: number; growth: number | null; maxPerTenant: number };
  gmv: { total: string; orders: number; growth: number | null };
  subscriptions: { active: number; activePercent: number; plans: number };
};

/** KPI strip for the tenant directory. All windows are the last 30 days. */
export async function tenantDirectoryStats(): Promise<TenantDirectoryStats> {
  const now = new Date();
  const windowStart = addDays(now, -30);
  const previousStart = addDays(now, -60);

  const [
    tenantsTotal,
    tenantsActive,
    tenants30,
    tenantsPrev,
    storesTotal,
    stores30,
    storesPrev,
    storeCounts,
    orderAgg,
    gmv30,
    gmvPrev,
    activeSubs,
    plans,
  ] = await Promise.all([
    prisma.tenant.count(),
    prisma.tenant.count({ where: { status: "ACTIVE" } }),
    prisma.tenant.count({ where: { createdAt: { gte: windowStart } } }),
    prisma.tenant.count({ where: { createdAt: { gte: previousStart, lt: windowStart } } }),
    prisma.store.count({ where: { deletedAt: null } }),
    prisma.store.count({ where: { deletedAt: null, createdAt: { gte: windowStart } } }),
    prisma.store.count({ where: { deletedAt: null, createdAt: { gte: previousStart, lt: windowStart } } }),
    prisma.store.groupBy({
      by: ["tenantId"],
      where: { deletedAt: null },
      _count: { _all: true },
    }),
    prisma.order.aggregate({
      where: { deletedAt: null, status: { notIn: ["CANCELLED", "REFUNDED"] } },
      _sum: { grandTotal: true },
      _count: { _all: true },
    }),
    prisma.order.aggregate({
      where: {
        deletedAt: null,
        status: { notIn: ["CANCELLED", "REFUNDED"] },
        placedAt: { gte: windowStart },
      },
      _sum: { grandTotal: true },
    }),
    prisma.order.aggregate({
      where: {
        deletedAt: null,
        status: { notIn: ["CANCELLED", "REFUNDED"] },
        placedAt: { gte: previousStart, lt: windowStart },
      },
      _sum: { grandTotal: true },
    }),
    prisma.subscription.count({
      where: { status: { in: ["ACTIVE", "TRIALING", "GRACE_PERIOD"] } },
    }),
    prisma.plan.count({ where: { status: "ACTIVE" } }),
  ]);

  return {
    tenants: {
      total: tenantsTotal,
      active: tenantsActive,
      newThisMonth: tenants30,
      growth: growthPercent(tenants30, tenantsPrev),
    },
    stores: {
      total: storesTotal,
      newThisMonth: stores30,
      growth: growthPercent(stores30, storesPrev),
      maxPerTenant: storeCounts.reduce((max, row) => Math.max(max, row._count._all), 0),
    },
    gmv: {
      total: fromPaisa(toPaisa(orderAgg._sum?.grandTotal ?? 0)),
      orders: orderAgg._count?._all ?? 0,
      growth: growthPercent(
        Number(toPaisa(gmv30._sum?.grandTotal ?? 0)),
        Number(toPaisa(gmvPrev._sum?.grandTotal ?? 0)),
      ),
    },
    subscriptions: {
      active: activeSubs,
      activePercent: tenantsTotal ? Math.round((activeSubs / tenantsTotal) * 100) : 0,
      plans,
    },
  };
}

/** Selectable plans for the create-tenant dialog and the plan filter. */
export async function listPlanOptions() {
  return prisma.plan.findMany({
    where: { status: "ACTIVE" },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    select: { code: true, name: true, sortOrder: true },
  });
}

export type CreateTenantInput = {
  tenantName: string;
  ownerName: string;
  ownerPhone: string;
  planCode: string;
};

/**
 * Creates a merchant workspace from the Super Admin surface.
 *
 * The owner account is keyed by phone (the same identity merchant OTP login
 * uses), system roles are materialised for the tenant, and a subscription is
 * opened on the chosen plan (paid plans start as a trial; free is active).
 */
export async function createTenantWorkspace(
  actorId: string,
  input: CreateTenantInput,
): Promise<{ tenantId: string; ownerId: string }> {
  const tenantName = input.tenantName.trim();
  const ownerName = input.ownerName.trim();
  const phone = normalizePhone(input.ownerPhone);

  if (tenantName.length < 2) {
    throw new AppError("VALIDATION_FAILED", "ওয়ার্কস্পেসের নাম কমপক্ষে ২ অক্ষরের হতে হবে।", 422, {
      field: "tenantName",
    });
  }
  if (ownerName.length < 2) {
    throw new AppError("VALIDATION_FAILED", "মালিকের নাম কমপক্ষে ২ অক্ষরের হতে হবে।", 422, {
      field: "ownerName",
    });
  }
  if (!isValidBdPhone(phone)) {
    throw new AppError("VALIDATION_FAILED", "সঠিক বাংলাদেশি মোবাইল নম্বর দিন।", 422, {
      field: "ownerPhone",
    });
  }

  const plan = await prisma.plan.findUnique({ where: { code: input.planCode } });
  if (!plan) throw new NotFoundError("Plan");

  const existing = await prisma.user.findUnique({ where: { phone } });
  if (existing && existing.status !== "ACTIVE") {
    throw new AppError("CONFLICT", "এই মোবাইল নম্বরের account বর্তমানে সক্রিয় নয়।", 409);
  }

  const result = await prisma.$transaction(async (tx) => {
    const owner =
      existing ??
      (await tx.user.create({
        data: {
          name: ownerName,
          phone,
          status: "ACTIVE",
          phoneVerifiedAt: new Date(),
        },
      }));

    const tenant = await tx.tenant.create({
      data: {
        name: tenantName,
        ownerUserId: owner.id,
        status: "ACTIVE",
        timezone: "Asia/Dhaka",
        currency: "BDT",
      },
    });

    const roleIds = new Map<string, string>();
    for (const code of ROLE_CODES) {
      const role = await tx.role.create({
        data: {
          tenantId: tenant.id,
          code,
          name: SYSTEM_ROLES[code].name,
          permissionsJson: SYSTEM_ROLES[code].permissions as never,
          isSystem: true,
        },
      });
      roleIds.set(code, role.id);
    }

    await tx.membership.create({
      data: {
        tenantId: tenant.id,
        userId: owner.id,
        roleId: roleIds.get("OWNER")!,
        status: "ACTIVE",
        acceptedAt: new Date(),
      },
    });

    const now = new Date();
    const trialEnd =
      Number(plan.price) > 0 && plan.trialDays > 0 ? addDays(now, plan.trialDays) : null;

    await tx.subscription.create({
      data: {
        tenantId: tenant.id,
        planId: plan.id,
        status: trialEnd ? "TRIALING" : "ACTIVE",
        trialEnd,
        currentPeriodStart: now,
        currentPeriodEnd: nextPeriodEnd(now),
        billingPeriod: "MONTHLY",
      },
    });

    return { tenant, owner };
  });

  await recordAudit({
    action: "platform.tenant_created",
    actorId,
    tenantId: result.tenant.id,
    resourceType: "Tenant",
    resourceId: result.tenant.id,
    metadata: {
      ownerId: result.owner.id,
      ownerPhone: phone,
      planCode: plan.code,
      tenantName,
    },
  });

  return { tenantId: result.tenant.id, ownerId: result.owner.id };
}

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

/**
 * Shell data for the Super Admin chrome: nav badges, cluster health and the
 * notification dot. A database hiccup must not blank the whole shell, so the
 * fallback reports `ok: false` instead of throwing.
 */
export type SuperAdminShellData = {
  counts: { tenants: number; themesLive: number };
  health: { ok: boolean; latencyMs: number };
  audits24h: number;
};

export async function superAdminShellData(): Promise<SuperAdminShellData> {
  const started = performance.now();
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);

  try {
    const [tenants, retired, audits24h] = await Promise.all([
      prisma.tenant.count(),
      prisma.theme.findMany({ where: { status: { not: "ACTIVE" } }, select: { code: true } }),
      prisma.auditLog.count({ where: { createdAt: { gte: since } } }),
    ]);

    const retiredCodes = new Set(retired.map((row) => row.code));
    return {
      counts: {
        tenants,
        themesLive: THEME_CATALOG.filter((theme) => !retiredCodes.has(theme.code)).length,
      },
      health: { ok: true, latencyMs: Math.round(performance.now() - started) },
      audits24h,
    };
  } catch (error) {
    console.error("[super-admin] shell data unavailable", error);
    return {
      counts: { tenants: 0, themesLive: THEME_CATALOG.length },
      health: { ok: false, latencyMs: Math.round(performance.now() - started) },
      audits24h: 0,
    };
  }
}
