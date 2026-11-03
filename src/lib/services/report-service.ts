import { prisma } from "@/lib/db";
import { addDays, dhakaDateKey } from "@/lib/dates";
import { formatBdt, toNumber } from "@/lib/money";
import { assertFeature, assertReportLevel, requireWritableTenant } from "@/lib/entitlements";
import { assertPermission, type ActorContext } from "@/lib/rbac";
import { assertStoreAccess } from "@/lib/tenant";
import { recordAudit } from "@/lib/audit";
import { NotFoundError, ValidationError } from "@/lib/errors";

/**
 * Reporting, rollups and CSV export (FR-10).
 *
 * Live reports read orders/customers/payments directly for freshness. The daily
 * rollup table is written by the reports cron and is the long-term, cheap
 * history used by trend screens. Exports are queued as `ExportJob` rows so a
 * large store never holds an HTTP request open just to build a file, and every
 * attempt is auditable. Scheduled exports are a Pro entitlement.
 */

/** Reporting sums stay in integer paisa but are small enough to use numbers. */
function bdtValue(paisa: number): string {
  return (paisa / 100).toFixed(2);
}

export const EXPORT_TYPES = ["orders", "customers", "products", "payments", "tax"] as const;
export type ExportType = (typeof EXPORT_TYPES)[number];

export const EXPORT_LABELS: Record<ExportType, string> = {
  orders: "অর্ডার",
  customers: "কাস্টমার",
  products: "পণ্য ও স্টক",
  payments: "পেমেন্ট মিলান",
  tax: "ট্যাক্স / VAT",
};

export type ReportRange = { from: Date; to: Date };

export function dhakaDayBounds(dateKey: string): { start: Date; end: Date } {
  const start = new Date(`${dateKey}T00:00:00+06:00`);
  if (Number.isNaN(start.getTime())) throw new ValidationError("সঠিক তারিখ দিন।");
  return { start, end: new Date(start.getTime() + 86_400_000) };
}

export function parseRange(from?: string | null, to?: string | null): ReportRange {
  const end = to ? new Date(to) : new Date();
  const start = from ? new Date(from) : addDays(end, -30);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    throw new ValidationError("রিপোর্টের তারিখ সঠিক নয়।");
  }
  return { from: start, to: end };
}

function csvCell(value: unknown): string {
  const text = value === null || value === undefined ? "" : String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function csvFile(header: string[], rows: unknown[][]): string {
  return `\uFEFF${[header, ...rows].map((row) => row.map(csvCell).join(",")).join("\n")}`;
}

export async function customerReport(storeId: string, range: ReportRange) {
  const [orders, newCustomers] = await Promise.all([
    prisma.order.findMany({
      where: { storeId, deletedAt: null, placedAt: { gte: range.from, lte: range.to } },
      select: {
        customerId: true,
        customerName: true,
        customerPhone: true,
        grandTotal: true,
        status: true,
      },
      take: 50_000,
    }),
    prisma.customer.count({ where: { storeId, createdAt: { gte: range.from, lte: range.to } } }),
  ]);

  const byCustomer = new Map<
    string,
    { name: string; phone: string; orders: number; spentPaisa: number }
  >();
  for (const order of orders) {
    if (!order.customerId) continue;
    const current = byCustomer.get(order.customerId) ?? {
      name: order.customerName,
      phone: order.customerPhone,
      orders: 0,
      spentPaisa: 0,
    };
    current.orders += 1;
    if (order.status !== "CANCELLED" && order.status !== "REFUNDED") {
      current.spentPaisa += toNumber(order.grandTotal);
    }
    byCustomer.set(order.customerId, current);
  }

  const buyers = [...byCustomer.values()].sort((a, b) => b.spentPaisa - a.spentPaisa);
  const repeatCustomers = buyers.filter((customer) => customer.orders > 1).length;

  return {
    newCustomers,
    buyingCustomers: buyers.length,
    repeatCustomers,
    repeatRate: buyers.length === 0 ? 0 : Math.round((repeatCustomers / buyers.length) * 100),
    topCustomers: buyers.slice(0, 10).map((customer) => ({
      name: customer.name,
      phone: customer.phone,
      orders: customer.orders,
      spent: bdtValue(customer.spentPaisa),
    })),
  };
}

export async function productStockReport(storeId: string) {
  const variants = await prisma.productVariant.findMany({
    where: { product: { storeId, deletedAt: null, status: { not: "ARCHIVED" } } },
    select: {
      id: true,
      sku: true,
      price: true,
      costPrice: true,
      stockQty: true,
      reservedQty: true,
      product: { select: { id: true, name: true, lowStockThreshold: true, status: true } },
    },
    orderBy: { product: { name: "asc" } },
    take: 10_000,
  });

  const rows = variants.map((variant) => {
    const available = variant.stockQty - variant.reservedQty;
    const marginPaisa = variant.costPrice
      ? toNumber(variant.price) - toNumber(variant.costPrice)
      : null;
    return {
      ...variant,
      available,
      low: available <= variant.product.lowStockThreshold,
      marginPaisa,
    };
  });

  return {
    totalSkus: rows.length,
    outOfStock: rows.filter((row) => row.available <= 0).length,
    lowStock: rows.filter((row) => row.low).slice(0, 20),
    totalStockValuePaisa: rows.reduce(
      (total, row) => total + (row.costPrice ? toNumber(row.costPrice) * row.stockQty : 0),
      0,
    ),
  };
}

export async function productProfitReport(storeId: string, range: ReportRange) {
  const items = await prisma.orderItem.findMany({
    where: {
      order: {
        storeId,
        deletedAt: null,
        status: { notIn: ["CANCELLED", "REFUNDED"] },
        placedAt: { gte: range.from, lte: range.to },
      },
    },
    select: {
      productId: true,
      nameSnapshot: true,
      quantity: true,
      lineTotal: true,
      refundedQty: true,
      variant: { select: { costPrice: true } },
    },
    take: 50_000,
  });

  const byProduct = new Map<
    string,
    { name: string; qty: number; revenuePaisa: number; costPaisa: number; hasCost: boolean }
  >();
  for (const item of items) {
    const key = item.productId ?? item.nameSnapshot;
    const row = byProduct.get(key) ?? {
      name: item.nameSnapshot,
      qty: 0,
      revenuePaisa: 0,
      costPaisa: 0,
      hasCost: false,
    };
    const qty = Math.max(0, item.quantity - item.refundedQty);
    row.qty += qty;
    row.revenuePaisa += toNumber(item.lineTotal);
    if (item.variant?.costPrice) {
      row.costPaisa += toNumber(item.variant.costPrice) * qty;
      row.hasCost = true;
    }
    byProduct.set(key, row);
  }

  return [...byProduct.values()]
    .map((row) => ({
      name: row.name,
      qty: row.qty,
      revenue: bdtValue(row.revenuePaisa),
      profit: row.hasCost ? bdtValue(row.revenuePaisa - row.costPaisa) : null,
    }))
    .sort((a, b) => toNumber(b.revenue) - toNumber(a.revenue))
    .slice(0, 10);
}

export async function paymentReconciliation(storeId: string, range: ReportRange) {
  const rows = await prisma.payment.groupBy({
    by: ["provider", "status"],
    where: { order: { storeId, placedAt: { gte: range.from, lte: range.to } } },
    _count: { _all: true },
    _sum: { amount: true, feeAmount: true },
    orderBy: { provider: "asc" },
  });

  return rows.map((row) => {
    const amountPaisa = row._sum.amount ? toNumber(row._sum.amount) : 0;
    const feePaisa = row._sum.feeAmount ? toNumber(row._sum.feeAmount) : 0;
    return {
      provider: row.provider,
      status: row.status,
      count: row._count._all,
      amount: bdtValue(amountPaisa),
      fee: bdtValue(feePaisa),
      net: bdtValue(amountPaisa - feePaisa),
    };
  });
}

export async function reportOverview(storeId: string, range: ReportRange) {
  const [customers, stock, profit, payments] = await Promise.all([
    customerReport(storeId, range),
    productStockReport(storeId),
    productProfitReport(storeId, range),
    paymentReconciliation(storeId, range),
  ]);
  return { customers, stock, profit, payments };
}

/** Rolls one Dhaka calendar day into `DailyStoreMetric` (idempotent upsert). */
export async function aggregateDailyMetrics(storeId: string, dateKey: string) {
  const { start, end } = dhakaDayBounds(dateKey);
  const [orders, refunds, newCustomers] = await Promise.all([
    prisma.order.findMany({
      where: { storeId, deletedAt: null, placedAt: { gte: start, lt: end } },
      select: {
        status: true,
        paymentStatus: true,
        grandTotal: true,
        taxTotal: true,
        shippingTotal: true,
        customerId: true,
        items: { select: { quantity: true, refundedQty: true } },
      },
      take: 20_000,
    }),
    prisma.payment.aggregate({
      where: {
        status: "REFUNDED",
        order: { storeId, placedAt: { gte: start, lt: end } },
      },
      _sum: { amount: true },
    }),
    prisma.customer.count({ where: { storeId, createdAt: { gte: start, lt: end } } }),
  ]);

  const paid = orders.filter((order) => order.paymentStatus === "PAID" || order.paymentStatus === "PARTIALLY_REFUNDED");
  const grossPaisa = paid.reduce((total, order) => total + toNumber(order.grandTotal), 0);
  const unitsSold = orders.reduce(
    (total, order) =>
      total + order.items.reduce((sum, item) => sum + Math.max(0, item.quantity - item.refundedQty), 0),
    0,
  );

  return prisma.dailyStoreMetric.upsert({
    where: { storeId_date: { storeId, date: start } },
    create: {
      storeId,
      date: start,
      orders: orders.length,
      paidOrders: paid.length,
      deliveredOrders: orders.filter((order) => order.status === "DELIVERED").length,
      cancelledOrders: orders.filter((order) => order.status === "CANCELLED").length,
      grossPaisa,
      refundPaisa: refunds._sum.amount ? toNumber(refunds._sum.amount) : 0,
      taxPaisa: paid.reduce((total, order) => total + toNumber(order.taxTotal), 0),
      shippingPaisa: paid.reduce((total, order) => total + toNumber(order.shippingTotal), 0),
      unitsSold,
      newCustomers,
    },
    update: {
      orders: orders.length,
      paidOrders: paid.length,
      deliveredOrders: orders.filter((order) => order.status === "DELIVERED").length,
      cancelledOrders: orders.filter((order) => order.status === "CANCELLED").length,
      grossPaisa,
      refundPaisa: refunds._sum.amount ? toNumber(refunds._sum.amount) : 0,
      taxPaisa: paid.reduce((total, order) => total + toNumber(order.taxTotal), 0),
      shippingPaisa: paid.reduce((total, order) => total + toNumber(order.shippingTotal), 0),
      unitsSold,
      newCustomers,
    },
  });
}

export async function aggregateAllStores(dateKey = dhakaDateKey(addDays(new Date(), -1))) {
  const stores = await prisma.store.findMany({
    where: { deletedAt: null },
    select: { id: true },
  });
  let aggregated = 0;
  for (const store of stores) {
    try {
      await aggregateDailyMetrics(store.id, dateKey);
      aggregated += 1;
    } catch (error) {
      console.error("[reports] daily aggregation failed", store.id, dateKey, error);
    }
  }
  return { dateKey, stores: stores.length, aggregated };
}

// ── Export jobs ──────────────────────────────────────────────────────────────

async function buildExportCsv(
  storeId: string,
  type: ExportType,
  range: ReportRange,
): Promise<{ csv: string; rows: number }> {
  if (type === "orders") {
    const orders = await prisma.order.findMany({
      where: { storeId, deletedAt: null, placedAt: { gte: range.from, lte: range.to } },
      orderBy: { placedAt: "asc" },
      include: { items: true },
      take: 50_000,
    });
    const rows = orders.map((order) => [
      order.orderNo,
      order.placedAt.toISOString(),
      order.status,
      order.paymentStatus,
      order.paymentProvider,
      order.customerName,
      order.customerPhone,
      order.items.map((item) => `${item.nameSnapshot} x${item.quantity}`).join(" | "),
      order.subtotal,
      order.discountTotal,
      order.shippingTotal,
      order.taxTotal,
      order.grandTotal,
    ]);
    return {
      csv: csvFile(
        [
          "orderNo",
          "placedAt",
          "status",
          "paymentStatus",
          "paymentProvider",
          "customerName",
          "customerPhone",
          "items",
          "subtotal",
          "discountTotal",
          "shippingTotal",
          "taxTotal",
          "grandTotal",
        ],
        rows,
      ),
      rows: rows.length,
    };
  }

  if (type === "customers") {
    const [customers, totals] = await Promise.all([
      prisma.customer.findMany({
        where: { storeId, createdAt: { lte: range.to } },
        orderBy: { createdAt: "desc" },
        take: 50_000,
      }),
      prisma.order.groupBy({
        by: ["customerId"],
        where: { storeId, customerId: { not: null }, placedAt: { gte: range.from, lte: range.to } },
        _count: { _all: true },
        _sum: { grandTotal: true },
      }),
    ]);
    const map = new Map(
      totals.map((row) => [
        row.customerId as string,
        { orders: row._count._all, spent: row._sum.grandTotal ?? 0 },
      ]),
    );
    const rows = customers.map((customer) => {
      const total = map.get(customer.id);
      return [
        customer.name,
        customer.phone,
        customer.email ?? "",
        customer.createdAt.toISOString(),
        total?.orders ?? 0,
        total?.spent ?? 0,
        customer.isBlacklisted ? "TRUE" : "FALSE",
        customer.status,
      ];
    });
    return {
      csv: csvFile(
        ["name", "phone", "email", "joinedAt", "ordersInRange", "spentInRange", "blacklisted", "status"],
        rows,
      ),
      rows: rows.length,
    };
  }

  if (type === "products") {
    const variants = await prisma.productVariant.findMany({
      where: { product: { storeId, deletedAt: null } },
      include: { product: { select: { name: true, status: true, lowStockThreshold: true } } },
      orderBy: [{ product: { name: "asc" } }, { sku: "asc" }],
      take: 50_000,
    });
    const rows = variants.map((variant) => [
      variant.product.name,
      variant.sku,
      variant.product.status,
      variant.price,
      variant.costPrice ?? "",
      variant.stockQty,
      variant.reservedQty,
      variant.stockQty - variant.reservedQty,
      variant.stockQty - variant.reservedQty <= variant.product.lowStockThreshold ? "LOW" : "OK",
    ]);
    return {
      csv: csvFile(
        ["product", "sku", "status", "price", "costPrice", "stock", "reserved", "available", "stockFlag"],
        rows,
      ),
      rows: rows.length,
    };
  }

  if (type === "payments") {
    const payments = await prisma.payment.findMany({
      where: { order: { storeId, placedAt: { gte: range.from, lte: range.to } } },
      include: { order: { select: { orderNo: true } } },
      orderBy: { createdAt: "asc" },
      take: 50_000,
    });
    const rows = payments.map((payment) => [
      payment.order.orderNo,
      payment.provider,
      payment.status,
      payment.amount,
      payment.feeAmount,
      payment.providerTxnId ?? "",
      payment.failureReason ?? "",
      payment.createdAt.toISOString(),
    ]);
    return {
      csv: csvFile(
        ["orderNo", "provider", "status", "amount", "fee", "providerTxnId", "failureReason", "createdAt"],
        rows,
      ),
      rows: rows.length,
    };
  }

  const orders = await prisma.order.findMany({
    where: { storeId, deletedAt: null, placedAt: { gte: range.from, lte: range.to } },
    orderBy: { placedAt: "asc" },
    take: 50_000,
  });
  const rows = orders.map((order) => [
    order.orderNo,
    order.placedAt.toISOString(),
    order.status,
    order.paymentStatus,
    order.taxTotal,
    order.taxJson,
    order.subtotal,
    order.grandTotal,
  ]);
  return {
    csv: csvFile(
      ["orderNo", "placedAt", "status", "paymentStatus", "taxTotal", "taxSnapshot", "subtotal", "grandTotal"],
      rows,
    ),
    rows: rows.length,
  };
}

export async function createExportJob(
  actor: ActorContext,
  storeId: string,
  input: { type: ExportType; from?: Date; to?: Date },
) {
  assertPermission(actor, "reports:export");
  await assertStoreAccess(actor, storeId);
  const snapshot = await requireWritableTenant(actor.tenantId);
  assertReportLevel(snapshot, "CSV");
  if (!EXPORT_TYPES.includes(input.type)) throw new ValidationError("সঠিক export type দিন।");

  const job = await prisma.exportJob.create({
    data: {
      tenantId: actor.tenantId,
      storeId,
      type: input.type,
      requestedBy: actor.userId,
      filtersJson: {
        from: (input.from ?? addDays(new Date(), -30)).toISOString(),
        to: (input.to ?? new Date()).toISOString(),
      } as never,
    },
    select: { id: true },
  });

  await recordAudit({
    action: "report.export_queued",
    tenantId: actor.tenantId,
    actorId: actor.userId,
    resourceType: "ExportJob",
    resourceId: job.id,
    metadata: { type: input.type, storeId },
  });

  return job;
}

export async function processExportJob(jobId: string): Promise<void> {
  const job = await prisma.exportJob.findUnique({ where: { id: jobId } });
  if (!job || job.status === "COMPLETED") return;

  await prisma.exportJob.update({
    where: { id: job.id },
    data: { status: "RUNNING", startedAt: new Date(), error: null },
  });

  try {
    const filters = (job.filtersJson ?? {}) as { from?: string; to?: string };
    const range = parseRange(filters.from, filters.to);
    const { csv, rows } = await buildExportCsv(job.storeId, job.type as ExportType, range);
    await prisma.exportJob.update({
      where: { id: job.id },
      data: { status: "COMPLETED", fileContent: csv, rowCount: rows, completedAt: new Date() },
    });
  } catch (error) {
    await prisma.exportJob.update({
      where: { id: job.id },
      data: {
        status: "FAILED",
        error: (error instanceof Error ? error.message : "Export failed").slice(0, 500),
        completedAt: new Date(),
      },
    });
  }
}

export async function getExportJob(tenantId: string, jobId: string) {
  const job = await prisma.exportJob.findFirst({ where: { id: jobId, tenantId } });
  if (!job) throw new NotFoundError("Export");
  return job;
}

export async function listExportJobs(storeId: string, limit = 10) {
  return prisma.exportJob.findMany({
    where: { storeId },
    orderBy: { createdAt: "desc" },
    take: limit,
    select: {
      id: true,
      type: true,
      status: true,
      rowCount: true,
      error: true,
      createdAt: true,
      completedAt: true,
    },
  });
}

// ── Scheduled exports (Pro) ──────────────────────────────────────────────────

export async function createExportSchedule(
  actor: ActorContext,
  storeId: string,
  input: { type: ExportType; frequency: "DAILY" | "WEEKLY"; recipients: string[] },
) {
  assertPermission(actor, "reports:export");
  await assertStoreAccess(actor, storeId);
  const snapshot = await requireWritableTenant(actor.tenantId);
  assertReportLevel(snapshot, "CSV");
  assertFeature(snapshot, "scheduledExport");

  if (!EXPORT_TYPES.includes(input.type)) throw new ValidationError("সঠিক export type দিন।");
  if (!["DAILY", "WEEKLY"].includes(input.frequency)) throw new ValidationError("সঠিক frequency দিন।");
  const recipients = [...new Set(input.recipients.map((email) => email.trim().toLowerCase()))].filter((email) =>
    /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email),
  );
  if (recipients.length === 0) throw new ValidationError("অন্তত একটি সঠিক email দিন।");

  const nextRunAt = new Date();
  nextRunAt.setUTCHours(0, 0, 0, 0);
  nextRunAt.setUTCDate(nextRunAt.getUTCDate() + (input.frequency === "DAILY" ? 1 : 7));

  const schedule = await prisma.exportSchedule.create({
    data: {
      tenantId: actor.tenantId,
      storeId,
      type: input.type,
      frequency: input.frequency,
      recipientsJson: recipients as never,
      nextRunAt,
      createdBy: actor.userId,
    },
    select: { id: true },
  });

  await recordAudit({
    action: "report.schedule_created",
    tenantId: actor.tenantId,
    actorId: actor.userId,
    resourceType: "ExportSchedule",
    resourceId: schedule.id,
    metadata: { type: input.type, frequency: input.frequency, recipients },
  });

  return schedule;
}

export async function listExportSchedules(storeId: string) {
  const rows = await prisma.exportSchedule.findMany({
    where: { storeId },
    orderBy: { createdAt: "desc" },
  });
  return rows.map((row) => ({
    ...row,
    recipients: Array.isArray(row.recipientsJson) ? (row.recipientsJson as string[]) : [],
  }));
}

export async function deleteExportSchedule(actor: ActorContext, storeId: string, scheduleId: string) {
  assertPermission(actor, "reports:export");
  await requireWritableTenant(actor.tenantId);
  const row = await prisma.exportSchedule.findFirst({
    where: { id: scheduleId, storeId, tenantId: actor.tenantId },
  });
  if (!row) throw new NotFoundError("Export schedule");
  await prisma.exportSchedule.delete({ where: { id: row.id } });
}

export async function runDueExportSchedules(limit = 10) {
  const due = await prisma.exportSchedule.findMany({
    where: { active: true, nextRunAt: { lte: new Date() } },
    orderBy: { nextRunAt: "asc" },
    take: limit,
  });

  let processed = 0;
  for (const schedule of due) {
    try {
      const job = await prisma.exportJob.create({
        data: {
          tenantId: schedule.tenantId,
          storeId: schedule.storeId,
          type: schedule.type,
          requestedBy: schedule.createdBy,
          filtersJson: {
            from: addDays(new Date(), schedule.frequency === "DAILY" ? -1 : -7).toISOString(),
            to: new Date().toISOString(),
          } as never,
        },
        select: { id: true },
      });
      await processExportJob(job.id);
      const next = new Date(schedule.nextRunAt);
      next.setUTCDate(next.getUTCDate() + (schedule.frequency === "DAILY" ? 1 : 7));
      await prisma.exportSchedule.update({
        where: { id: schedule.id },
        data: { lastRunAt: new Date(), nextRunAt: next },
      });
      processed += 1;
    } catch (error) {
      console.error("[reports] schedule failed", schedule.id, error);
    }
  }
  return { due: due.length, processed };
}

/** Human-readable BDT value for report UI. */
export function reportMoney(value: string | number): string {
  return formatBdt(value);
}
