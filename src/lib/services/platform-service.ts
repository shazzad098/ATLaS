import { prisma } from "@/lib/db";
import { fromPaisa, toPaisa } from "@/lib/money";
import { recordAudit } from "@/lib/audit";
import { NotFoundError } from "@/lib/errors";

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

export async function listTenantsForAdmin(): Promise<TenantRow[]> {
  const [tenants, feeRows, orderRows, stores] = await Promise.all([
    prisma.tenant.findMany({
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

  return tenants.map((tenant) => {
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
