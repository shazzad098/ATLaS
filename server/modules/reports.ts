import Papa from "papaparse";
import { and, desc, eq, gte, inArray, lt, sql } from "drizzle-orm";
import { db } from "../db";
import { customers, dailyStoreMetrics, jobs, orderItems, orders, productVariants, products, refundRequests, storeSettings, stores } from "../../drizzle/schema";
import { ORDER_STATUSES } from "../../shared/domain";
import { DAY_MS, dhakaDateStr, dhakaDayStart, fail, fromP, monthPeriod, toP } from "../lib/core";
import { storagePut } from "../storage";
import { assertFeature, productCount, storageUsedBytes, usageFor } from "./billing";
import { enqueue, every, registerJob } from "./jobs";
import { audit, notifyUsers } from "./ops";
import { onboardingChecklist } from "./stores";
import { requirePerm, type TenantScope } from "./tenancy";

const REVENUE_STATUSES = ["PAID", "CONFIRMED", "PROCESSING", "SHIPPED", "DELIVERED", "RETURN_REQUESTED"] as const;
const dhakaDate = sql<string>`DATE(DATE_ADD(${orders.createdAt}, INTERVAL 6 HOUR))`;

/* ───────── Daily aggregation ───────── */
export async function aggregateStoreDay(storeId: number, tenantId: number, date: string) {
  const start = dhakaDayStart(date);
  const end = new Date(start.getTime() + DAY_MS);
  const [o] = await db()
    .select({
      orders: sql<number>`count(*)`,
      eligible: sql<number>`sum(case when ${orders.feeEligibleAt} is not null then 1 else 0 end)`,
      cancelled: sql<number>`sum(case when ${orders.status} in ('CANCELLED','REFUNDED','RETURNED') then 1 else 0 end)`,
      revenue: sql<string>`coalesce(sum(case when ${orders.status} in ('PAID','CONFIRMED','PROCESSING','SHIPPED','DELIVERED','RETURN_REQUESTED') then ${orders.grandTotal} - ${orders.refundedTotal} else 0 end),0)`,
      online: sql<string>`coalesce(sum(case when ${orders.status} in ('PAID','CONFIRMED','PROCESSING','SHIPPED','DELIVERED','RETURN_REQUESTED') and ${orders.paymentMethod} <> 'cod' then ${orders.grandTotal} - ${orders.refundedTotal} else 0 end),0)`,
      cod: sql<string>`coalesce(sum(case when ${orders.status} in ('PAID','CONFIRMED','PROCESSING','SHIPPED','DELIVERED','RETURN_REQUESTED') and ${orders.paymentMethod} = 'cod' then ${orders.grandTotal} else 0 end),0)`,
    })
    .from(orders)
    .where(and(eq(orders.storeId, storeId), gte(orders.createdAt, start), lt(orders.createdAt, end)));
  const [items] = await db()
    .select({ n: sql<number>`coalesce(sum(${orderItems.quantity}),0)` })
    .from(orderItems)
    .innerJoin(orders, eq(orders.id, orderItems.orderId))
    .where(and(eq(orders.storeId, storeId), gte(orders.createdAt, start), lt(orders.createdAt, end), inArray(orders.status, [...REVENUE_STATUSES])));
  const [nc] = await db()
    .select({ n: sql<number>`count(*)` })
    .from(customers)
    .where(and(eq(customers.storeId, storeId), gte(customers.createdAt, start), lt(customers.createdAt, end)));
  const values = {
    orders: Number(o.orders ?? 0),
    eligibleOrders: Number(o.eligible ?? 0),
    cancelledOrders: Number(o.cancelled ?? 0),
    revenue: fromP(toP(o.revenue)),
    onlineRevenue: fromP(toP(o.online)),
    codRevenue: fromP(toP(o.cod)),
    itemsSold: Number(items?.n ?? 0),
    newCustomers: Number(nc?.n ?? 0),
  };
  await db()
    .insert(dailyStoreMetrics)
    .values({ tenantId, storeId, date, ...values })
    .onDuplicateKeyUpdate({ set: values });
}

every("aggregate-daily-metrics", 10 * 60_000, async () => {
  const all = await db().select({ id: stores.id, tenantId: stores.tenantId }).from(stores);
  const today = dhakaDateStr();
  const yesterday = dhakaDateStr(new Date(Date.now() - DAY_MS));
  for (const s of all) {
    await aggregateStoreDay(s.id, s.tenantId, today);
    await aggregateStoreDay(s.id, s.tenantId, yesterday);
  }
});

async function ensureRange(scope: TenantScope, from: string, to: string) {
  const have = await db()
    .select({ date: dailyStoreMetrics.date })
    .from(dailyStoreMetrics)
    .where(and(eq(dailyStoreMetrics.storeId, scope.storeId), gte(dailyStoreMetrics.date, from), sql`${dailyStoreMetrics.date} <= ${to}`));
  const set = new Set(have.map(h => String(h.date).slice(0, 10)));
  const today = dhakaDateStr();
  for (let t = dhakaDayStart(from).getTime(); t <= dhakaDayStart(to).getTime(); t += DAY_MS) {
    const d = dhakaDateStr(new Date(t));
    if (!set.has(d) || d === today) await aggregateStoreDay(scope.storeId, scope.tenantId, d);
  }
}

/* ───────── Overview dashboard ───────── */
export async function overview(scope: TenantScope) {
  requirePerm(scope, "overview.view");
  const today = dhakaDateStr();
  const from = dhakaDateStr(new Date(Date.now() - 13 * DAY_MS));
  await ensureRange(scope, from, today);
  const series = await db()
    .select()
    .from(dailyStoreMetrics)
    .where(and(eq(dailyStoreMetrics.storeId, scope.storeId), gte(dailyStoreMetrics.date, from)))
    .orderBy(dailyStoreMetrics.date);
  const days: { date: string; revenue: string; orders: number }[] = [];
  for (let i = 13; i >= 0; i--) {
    const d = dhakaDateStr(new Date(Date.now() - i * DAY_MS));
    const r = series.find(s => String(s.date).slice(0, 10) === d);
    days.push({ date: d, revenue: r?.revenue ?? "0.00", orders: r?.orders ?? 0 });
  }
  const todayRow = days[days.length - 1];
  const last7 = days.slice(-7);
  const prev7 = days.slice(0, 7);
  const sumRev = (xs: typeof days) => xs.reduce((s, d) => s + toP(d.revenue), 0);
  const sumOrd = (xs: typeof days) => xs.reduce((s, d) => s + d.orders, 0);
  const [pending] = await db()
    .select({
      codToConfirm: sql<number>`sum(case when ${orders.status} = 'PENDING_PAYMENT' and ${orders.paymentMethod} = 'cod' then 1 else 0 end)`,
      toFulfil: sql<number>`sum(case when ${orders.status} in ('PAID','CONFIRMED','PROCESSING') then 1 else 0 end)`,
      returns: sql<number>`sum(case when ${orders.status} = 'RETURN_REQUESTED' then 1 else 0 end)`,
      awaitingPayment: sql<number>`sum(case when ${orders.status} = 'PENDING_PAYMENT' and ${orders.paymentMethod} <> 'cod' then 1 else 0 end)`,
    })
    .from(orders)
    .where(eq(orders.storeId, scope.storeId));
  const [refundsPending] = await db().select({ n: sql<number>`count(*)` }).from(refundRequests).where(and(eq(refundRequests.storeId, scope.storeId), eq(refundRequests.status, "requested")));
  const lowStock = await db()
    .select({ productId: products.id, name: products.name, sku: productVariants.sku, available: sql<number>`${productVariants.stockQty} - ${productVariants.reservedQty}`, threshold: products.lowStockThreshold, options: productVariants.optionValuesJson })
    .from(productVariants)
    .innerJoin(products, eq(products.id, productVariants.productId))
    .where(and(eq(productVariants.storeId, scope.storeId), eq(productVariants.status, "active"), eq(products.status, "active"), sql`${productVariants.stockQty} - ${productVariants.reservedQty} <= ${products.lowStockThreshold}`))
    .orderBy(sql`${productVariants.stockQty} - ${productVariants.reservedQty}`)
    .limit(8);
  const recent = await db()
    .select({ id: orders.id, orderNo: orders.orderNo, status: orders.status, grandTotal: orders.grandTotal, paymentMethod: orders.paymentMethod, customer: orders.customerSnapshotJson, createdAt: orders.createdAt })
    .from(orders)
    .where(eq(orders.storeId, scope.storeId))
    .orderBy(desc(orders.createdAt))
    .limit(6);
  const period = monthPeriod();
  const ordersUsed = await usageFor(scope.tenantId, "orders");
  const products_ = await productCount(scope.storeId);
  const storageBytes = await storageUsedBytes(scope.tenantId);
  const lim = scope.ent.limits;
  return {
    kpis: {
      todayRevenue: todayRow.revenue,
      todayOrders: todayRow.orders,
      revenue7d: fromP(sumRev(last7)),
      revenuePrev7d: fromP(sumRev(prev7)),
      orders7d: sumOrd(last7),
      ordersPrev7d: sumOrd(prev7),
      aov7d: sumOrd(last7) ? fromP(Math.round(sumRev(last7) / sumOrd(last7))) : "0.00",
    },
    series: days,
    pending: {
      codToConfirm: Number(pending?.codToConfirm ?? 0),
      toFulfil: Number(pending?.toFulfil ?? 0),
      returns: Number(pending?.returns ?? 0),
      awaitingPayment: Number(pending?.awaitingPayment ?? 0),
      refunds: Number(refundsPending?.n ?? 0),
      lowStock: lowStock.length,
    },
    lowStock: lowStock.map(l => ({ ...l, available: Number(l.available) })),
    recent,
    usage: {
      period: { start: period.start, end: period.end },
      orders: { used: ordersUsed, included: lim.monthlyOrdersIncluded, overageRate: lim.overageRatePercent },
      products: { used: products_, limit: lim.products },
      storage: { usedMB: Math.round((storageBytes / 1024 / 1024) * 10) / 10, limitMB: lim.storageMB },
    },
    checklist: await onboardingChecklist(scope),
  };
}

/* ───────── Reports ───────── */
export type ReportRange = { from: string; to: string };
function rangeDates(r: ReportRange) {
  const start = dhakaDayStart(r.from);
  const end = new Date(dhakaDayStart(r.to).getTime() + DAY_MS);
  if (end.getTime() - start.getTime() > 366 * DAY_MS) fail("VALIDATION", "Choose a range of up to one year");
  return { start, end };
}

export async function salesReport(scope: TenantScope, r: ReportRange) {
  requirePerm(scope, "reports.view");
  await ensureRange(scope, r.from, r.to);
  const rows = await db()
    .select()
    .from(dailyStoreMetrics)
    .where(and(eq(dailyStoreMetrics.storeId, scope.storeId), gte(dailyStoreMetrics.date, r.from), sql`${dailyStoreMetrics.date} <= ${r.to}`))
    .orderBy(dailyStoreMetrics.date);
  const series = rows.map(x => ({ date: String(x.date).slice(0, 10), revenue: x.revenue, online: x.onlineRevenue, cod: x.codRevenue, orders: x.orders, cancelled: x.cancelledOrders, items: x.itemsSold, newCustomers: x.newCustomers }));
  const totalP = series.reduce((s, d) => s + toP(d.revenue), 0);
  const ordersN = series.reduce((s, d) => s + d.orders, 0);
  return {
    series,
    totals: {
      revenue: fromP(totalP),
      orders: ordersN,
      items: series.reduce((s, d) => s + d.items, 0),
      cancelled: series.reduce((s, d) => s + d.cancelled, 0),
      aov: ordersN ? fromP(Math.round(totalP / ordersN)) : "0.00",
      online: fromP(series.reduce((s, d) => s + toP(d.online), 0)),
      cod: fromP(series.reduce((s, d) => s + toP(d.cod), 0)),
    },
  };
}

export async function statusReport(scope: TenantScope, r: ReportRange) {
  requirePerm(scope, "reports.view");
  const { start, end } = rangeDates(r);
  const rows = await db()
    .select({ status: orders.status, n: sql<number>`count(*)`, total: sql<string>`coalesce(sum(${orders.grandTotal}),0)` })
    .from(orders)
    .where(and(eq(orders.storeId, scope.storeId), gte(orders.createdAt, start), lt(orders.createdAt, end)))
    .groupBy(orders.status);
  return ORDER_STATUSES.map(s => {
    const x = rows.find(r => r.status === s);
    return { status: s, count: Number(x?.n ?? 0), total: fromP(toP(x?.total ?? 0)) };
  });
}

export async function productsReport(scope: TenantScope, r: ReportRange) {
  requirePerm(scope, "reports.view");
  assertFeature(["advanced", "advanced_scheduled"].includes(scope.ent.limits.reportsLevel), "Product performance reports", "standard");
  const { start, end } = rangeDates(r);
  return (
    await db()
      .select({
        productId: orderItems.productId,
        name: orderItems.nameSnapshot,
        quantity: sql<number>`sum(${orderItems.quantity} - ${orderItems.refundedQty})`,
        revenue: sql<string>`sum(${orderItems.lineTotal} - ${orderItems.discountTotal})`,
        orders: sql<number>`count(distinct ${orderItems.orderId})`,
      })
      .from(orderItems)
      .innerJoin(orders, eq(orders.id, orderItems.orderId))
      .where(and(eq(orders.storeId, scope.storeId), gte(orders.createdAt, start), lt(orders.createdAt, end), inArray(orders.status, [...REVENUE_STATUSES])))
      .groupBy(orderItems.productId, orderItems.nameSnapshot)
      .orderBy(desc(sql`sum(${orderItems.lineTotal} - ${orderItems.discountTotal})`))
      .limit(50)
  ).map(x => ({ ...x, quantity: Number(x.quantity), orders: Number(x.orders), revenue: fromP(toP(x.revenue)) }));
}

export async function customersReport(scope: TenantScope, r: ReportRange) {
  requirePerm(scope, "reports.view");
  assertFeature(["advanced", "advanced_scheduled"].includes(scope.ent.limits.reportsLevel), "Customer reports", "standard");
  const { start, end } = rangeDates(r);
  const top = await db()
    .select({
      customerId: orders.customerId,
      name: sql<string>`max(JSON_UNQUOTE(JSON_EXTRACT(${orders.customerSnapshotJson}, '$.name')))`,
      orders: sql<number>`count(*)`,
      spent: sql<string>`sum(${orders.grandTotal} - ${orders.refundedTotal})`,
    })
    .from(orders)
    .where(and(eq(orders.storeId, scope.storeId), gte(orders.createdAt, start), lt(orders.createdAt, end), inArray(orders.status, [...REVENUE_STATUSES])))
    .groupBy(orders.customerId)
    .orderBy(desc(sql`sum(${orders.grandTotal} - ${orders.refundedTotal})`))
    .limit(20);
  const [nr] = await db()
    .select({
      newC: sql<number>`sum(case when c.createdAt >= ${start} then 1 else 0 end)`,
      returning: sql<number>`sum(case when c.createdAt < ${start} then 1 else 0 end)`,
    })
    .from(sql`(select distinct o.customerId from ${orders} o where o.storeId = ${scope.storeId} and o.createdAt >= ${start} and o.createdAt < ${end}) x`)
    .innerJoin(sql`${customers} c`, sql`c.id = x.customerId`);
  const byDistrict = await db()
    .select({ district: sql<string>`JSON_UNQUOTE(JSON_EXTRACT(${orders.addressSnapshotJson}, '$.district'))`, n: sql<number>`count(*)` })
    .from(orders)
    .where(and(eq(orders.storeId, scope.storeId), gte(orders.createdAt, start), lt(orders.createdAt, end)))
    .groupBy(sql`1`)
    .orderBy(desc(sql`count(*)`))
    .limit(10);
  return {
    top: top.map(t => ({ ...t, orders: Number(t.orders), spent: fromP(toP(t.spent)) })),
    newVsReturning: { new: Number(nr?.newC ?? 0), returning: Number(nr?.returning ?? 0) },
    byDistrict: byDistrict.map(d => ({ district: d.district, orders: Number(d.n) })),
  };
}

export async function paymentReport(scope: TenantScope, r: ReportRange) {
  requirePerm(scope, "reports.view");
  assertFeature(["advanced", "advanced_scheduled"].includes(scope.ent.limits.reportsLevel), "Payment method reports", "standard");
  const { start, end } = rangeDates(r);
  const rows = await db()
    .select({
      method: orders.paymentMethod,
      n: sql<number>`count(*)`,
      total: sql<string>`coalesce(sum(${orders.grandTotal}),0)`,
      success: sql<number>`sum(case when ${orders.status} in ('PAID','CONFIRMED','PROCESSING','SHIPPED','DELIVERED') then 1 else 0 end)`,
    })
    .from(orders)
    .where(and(eq(orders.storeId, scope.storeId), gte(orders.createdAt, start), lt(orders.createdAt, end)))
    .groupBy(orders.paymentMethod);
  return rows.map(x => ({ method: x.method, orders: Number(x.n), total: fromP(toP(x.total)), successRate: Number(x.n) ? Math.round((Number(x.success) / Number(x.n)) * 100) : 0 }));
}

/* ───────── Async CSV exports ───────── */
export const EXPORT_KINDS = ["orders", "sales", "products", "customers"] as const;
export type ExportKind = (typeof EXPORT_KINDS)[number];

export async function requestExport(scope: TenantScope, kind: ExportKind, r: ReportRange) {
  requirePerm(scope, "reports.export");
  assertFeature(scope.ent.limits.reportsLevel !== "basic", "CSV export", "basic");
  if (kind === "customers" || kind === "orders") requirePerm(scope, "customers.export_pii");
  rangeDates(r);
  const id = await enqueue("report.export", { tenantId: scope.tenantId, storeId: scope.storeId, kind, from: r.from, to: r.to, userId: scope.userId }, { tenantId: scope.tenantId, createdBy: scope.userId, maxAttempts: 3 });
  await audit({ tenantId: scope.tenantId, actorId: scope.userId, actorType: "merchant", action: "report.export_requested", metadata: { kind, ...r }, impersonationId: scope.impersonationId });
  return { jobId: id };
}

async function buildCsv(storeId: number, tenantId: number, kind: ExportKind, from: string, to: string) {
  const start = dhakaDayStart(from);
  const end = new Date(dhakaDayStart(to).getTime() + DAY_MS);
  if (kind === "orders") {
    const rows = await db()
      .select()
      .from(orders)
      .where(and(eq(orders.storeId, storeId), gte(orders.createdAt, start), lt(orders.createdAt, end)))
      .orderBy(orders.createdAt);
    return Papa.unparse(
      rows.map(o => ({
        order_no: o.orderNo,
        created_at: o.createdAt.toISOString(),
        status: o.status,
        payment_method: o.paymentMethod,
        payment_status: o.paymentStatus,
        customer: o.customerSnapshotJson.name,
        phone: o.customerSnapshotJson.phone,
        district: o.addressSnapshotJson.district,
        subtotal: o.subtotal,
        discount: o.discountTotal,
        shipping: o.shippingTotal,
        tax: o.taxTotal,
        total: o.grandTotal,
        refunded: o.refundedTotal,
        coupon: o.couponCode ?? "",
      }))
    );
  }
  if (kind === "sales") {
    const rows = await db()
      .select({ date: dhakaDate, orders: sql<number>`count(*)`, revenue: sql<string>`coalesce(sum(case when ${orders.status} in ('PAID','CONFIRMED','PROCESSING','SHIPPED','DELIVERED','RETURN_REQUESTED') then ${orders.grandTotal} - ${orders.refundedTotal} else 0 end),0)` })
      .from(orders)
      .where(and(eq(orders.storeId, storeId), gte(orders.createdAt, start), lt(orders.createdAt, end)))
      .groupBy(dhakaDate)
      .orderBy(dhakaDate);
    return Papa.unparse(rows.map(r => ({ date: r.date, orders: Number(r.orders), revenue: fromP(toP(r.revenue)) })));
  }
  if (kind === "products") {
    const rows = await db()
      .select({ name: orderItems.nameSnapshot, sku: orderItems.skuSnapshot, variant: orderItems.variantSnapshot, qty: sql<number>`sum(${orderItems.quantity})`, revenue: sql<string>`sum(${orderItems.lineTotal} - ${orderItems.discountTotal})` })
      .from(orderItems)
      .innerJoin(orders, eq(orders.id, orderItems.orderId))
      .where(and(eq(orders.storeId, storeId), gte(orders.createdAt, start), lt(orders.createdAt, end), inArray(orders.status, [...REVENUE_STATUSES])))
      .groupBy(orderItems.nameSnapshot, orderItems.skuSnapshot, orderItems.variantSnapshot);
    return Papa.unparse(rows.map(r => ({ product: r.name, sku: r.sku ?? "", variant: r.variant ?? "", quantity: Number(r.qty), revenue: fromP(toP(r.revenue)) })));
  }
  const rows = await db().select().from(customers).where(eq(customers.storeId, storeId));
  return Papa.unparse(rows.map(c => ({ name: c.name, phone: c.phone, email: c.email ?? "", district: c.addressJson?.district ?? "", orders: c.totalOrders, spent: c.totalSpent, last_order: c.lastOrderAt?.toISOString() ?? "", marketing_consent: c.consentJson?.marketing ? "yes" : "no" })));
}

registerJob("report.export", async payload => {
  const { storeId, tenantId, kind, from, to, userId } = payload as { storeId: number; tenantId: number; kind: ExportKind; from: string; to: string; userId?: number };
  const csv = await buildCsv(storeId, tenantId, kind, from, to);
  const { url } = await storagePut(`tenants/${tenantId}/exports/${kind}-${from}-to-${to}.csv`, "\uFEFF" + csv, "text/csv; charset=utf-8");
  const rows = Math.max(0, csv.split("\n").length - 1);
  if (userId) await notifyUsers([userId], { tenantId, type: "report.ready", title: `Your ${kind} export is ready`, body: `${rows} rows • ${from} → ${to}`, link: "/app/reports?tab=exports" });
  return { url, rows, kind, from, to };
});

export async function listExports(scope: TenantScope) {
  requirePerm(scope, "reports.export");
  const rows = await db()
    .select()
    .from(jobs)
    .where(and(eq(jobs.tenantId, scope.tenantId), eq(jobs.type, "report.export")))
    .orderBy(desc(jobs.id))
    .limit(30);
  return rows.map(j => ({ id: j.id, status: j.status, payload: j.payloadJson, result: j.resultJson as { url?: string; rows?: number } | null, createdAt: j.createdAt, finishedAt: j.finishedAt, error: j.lastError }));
}

/** Pro: scheduled daily/weekly exports emailed to the owner (delivered as notification + stored file). */
every("scheduled-exports", 60 * 60_000, async () => {
  const rows = await db()
    .select({ storeId: storeSettings.storeId, freq: storeSettings.scheduledExport, tenantId: stores.tenantId })
    .from(storeSettings)
    .innerJoin(stores, eq(stores.id, storeSettings.storeId))
    .where(inArray(storeSettings.scheduledExport, ["daily", "weekly"]));
  const today = dhakaDateStr();
  for (const r of rows) {
    if (r.freq === "weekly" && new Date().getUTCDay() !== 0) continue;
    const from = dhakaDateStr(new Date(Date.now() - (r.freq === "weekly" ? 7 : 1) * DAY_MS));
    const { getEntitlements } = await import("./billing");
    const ent = await getEntitlements(r.tenantId);
    if (ent.limits.reportsLevel !== "advanced_scheduled") continue;
    const [{ ownerUserId }] = await db().select({ ownerUserId: sql<number>`(select t.ownerUserId from tenants t where t.id = ${r.tenantId})` }).from(stores).where(eq(stores.id, r.storeId));
    await enqueue("report.export", { tenantId: r.tenantId, storeId: r.storeId, kind: "sales", from, to: today, userId: ownerUserId }, { tenantId: r.tenantId, dedupeKey: `sched:${r.storeId}:${today}` });
  }
});
