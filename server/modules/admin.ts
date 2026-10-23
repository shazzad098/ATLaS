import { and, desc, eq, gte, inArray, isNull, like, or, sql } from "drizzle-orm";
import { db } from "../db";
import {
  analyticsEvents,
  assets,
  auditLogs,
  domains,
  feeLedger,
  impersonationSessions,
  invoices,
  jobs,
  loginEvents,
  memberships,
  orders,
  outboundMessages,
  plans,
  rateLimitEvents,
  refundRequests,
  roles,
  sessions,
  stores,
  subscriptions,
  tenants,
  users,
  type PlanLimits,
  type User,
} from "../../drizzle/schema";
import { PLATFORM_ACCESS, type PlatformRole } from "../../shared/permissions";
import { DAY_MS, dhakaDateStr, fail, fromP, toP } from "../lib/core";
import { apiHealthSummary } from "../lib/rateLimit";
import { getEntitlements, invalidateEntitlements, invalidatePlans } from "./billing";
import { audit, notifyTenant } from "./ops";
import { clearStoreCache } from "./stores";

export function canAccess(user: User, area: string) {
  if (user.platformRole === "none") return false;
  const allowed = PLATFORM_ACCESS[user.platformRole as PlatformRole] ?? [];
  return allowed.includes("*") || allowed.includes(area);
}
export function requireArea(user: User, area: string) {
  if (!canAccess(user, area)) fail("FORBIDDEN", `Your platform role can't access ${area}`);
}

const REVENUE = ["PAID", "CONFIRMED", "PROCESSING", "SHIPPED", "DELIVERED", "RETURN_REQUESTED"] as const;

/* ───────── Platform metrics ───────── */
export async function platformMetrics() {
  const since30 = new Date(Date.now() - 30 * DAY_MS);
  const since14 = new Date(Date.now() - 13 * DAY_MS);
  const [storeCounts] = await db()
    .select({
      total: sql<number>`count(*)`,
      published: sql<number>`sum(case when ${stores.status} = 'published' then 1 else 0 end)`,
      suspended: sql<number>`sum(case when ${stores.status} = 'suspended' then 1 else 0 end)`,
    })
    .from(stores);
  const [active] = await db()
    .select({ n: sql<number>`count(distinct ${orders.storeId})` })
    .from(orders)
    .where(gte(orders.createdAt, since30));
  const subs = await db()
    .select({ status: subscriptions.status, cycle: subscriptions.billingCycle, monthly: plans.priceMonthly, yearly: plans.priceYearly, code: plans.code, canceledAt: subscriptions.canceledAt })
    .from(subscriptions)
    .innerJoin(plans, eq(plans.id, subscriptions.planId))
    .where(eq(subscriptions.isCurrent, true));
  let mrrP = 0;
  const planDist: Record<string, number> = {};
  const statusDist: Record<string, number> = {};
  for (const s of subs) {
    planDist[s.code] = (planDist[s.code] ?? 0) + 1;
    statusDist[s.status] = (statusDist[s.status] ?? 0) + 1;
    if (["ACTIVE", "PAST_DUE", "GRACE_PERIOD"].includes(s.status)) mrrP += s.cycle === "yearly" ? Math.round(toP(s.yearly) / 12) : toP(s.monthly);
  }
  const [churn] = await db()
    .select({ n: sql<number>`count(*)` })
    .from(subscriptions)
    .where(and(inArray(subscriptions.status, ["CANCELLED", "SUSPENDED"]), gte(subscriptions.updatedAt, since30)));
  const paying = subs.filter(s => ["ACTIVE", "PAST_DUE", "GRACE_PERIOD"].includes(s.status) && s.code !== "free").length;
  const [gmv] = await db()
    .select({ total: sql<string>`coalesce(sum(${orders.grandTotal} - ${orders.refundedTotal}),0)`, n: sql<number>`count(*)` })
    .from(orders)
    .where(and(gte(orders.createdAt, since30), inArray(orders.status, [...REVENUE])));
  const funnel = await db()
    .select({ event: analyticsEvents.event, n: sql<number>`count(*)` })
    .from(analyticsEvents)
    .where(gte(analyticsEvents.createdAt, since30))
    .groupBy(analyticsEvents.event);
  const f = Object.fromEntries(funnel.map(x => [x.event, Number(x.n)]));
  const [storage] = await db().select({ b: sql<number>`coalesce(sum(${assets.sizeBytes}),0)` }).from(assets).where(isNull(assets.deletedAt));
  const dhaka = sql<string>`DATE(DATE_ADD(${orders.createdAt}, INTERVAL 6 HOUR))`;
  const gmvSeries = await db()
    .select({ date: dhaka, total: sql<string>`coalesce(sum(case when ${orders.status} in ('PAID','CONFIRMED','PROCESSING','SHIPPED','DELIVERED','RETURN_REQUESTED') then ${orders.grandTotal} else 0 end),0)`, n: sql<number>`count(*)` })
    .from(orders)
    .where(gte(orders.createdAt, since14))
    .groupBy(dhaka)
    .orderBy(dhaka);
  const tdate = sql<string>`DATE(DATE_ADD(${tenants.createdAt}, INTERVAL 6 HOUR))`;
  const signups = await db().select({ date: tdate, n: sql<number>`count(*)` }).from(tenants).where(gte(tenants.createdAt, since14)).groupBy(tdate).orderBy(tdate);
  const days: { date: string; gmv: string; orders: number; newStores: number }[] = [];
  for (let i = 13; i >= 0; i--) {
    const d = dhakaDateStr(new Date(Date.now() - i * DAY_MS));
    const g = gmvSeries.find(x => String(x.date).slice(0, 10) === d);
    const s = signups.find(x => String(x.date).slice(0, 10) === d);
    days.push({ date: d, gmv: fromP(toP(g?.total ?? 0)), orders: Number(g?.n ?? 0), newStores: Number(s?.n ?? 0) });
  }
  const [jobStats] = await db()
    .select({ queued: sql<number>`sum(case when ${jobs.status} = 'queued' then 1 else 0 end)`, failed: sql<number>`sum(case when ${jobs.status} in ('failed','dead') then 1 else 0 end)` })
    .from(jobs);
  return {
    stores: { total: Number(storeCounts.total), published: Number(storeCounts.published ?? 0), suspended: Number(storeCounts.suspended ?? 0), active30d: Number(active.n) },
    mrr: fromP(mrrP),
    arr: fromP(mrrP * 12),
    payingTenants: paying,
    churn30d: { count: Number(churn.n), rate: paying + Number(churn.n) ? Math.round((Number(churn.n) / (paying + Number(churn.n))) * 1000) / 10 : 0 },
    gmv30d: fromP(toP(gmv.total)),
    orders30d: Number(gmv.n),
    conversion: {
      checkoutStarted: f.checkout_started ?? 0,
      ordersCreated: f.order_created ?? 0,
      checkoutRate: f.checkout_started ? Math.round(((f.order_created ?? 0) / f.checkout_started) * 1000) / 10 : 0,
      signups: f.signup_completed ?? 0,
      storesCreated: f.store_created ?? 0,
      published: f.store_published ?? 0,
      paymentSucceeded: f.payment_succeeded ?? 0,
    },
    funnel: f,
    storageMB: Math.round((Number(storage.b) / 1024 / 1024) * 10) / 10,
    api: apiHealthSummary(),
    jobs: { queued: Number(jobStats.queued ?? 0), failed: Number(jobStats.failed ?? 0) },
    planDistribution: planDist,
    statusDistribution: statusDist,
    series: days,
  };
}

/* ───────── Merchants ───────── */
export async function searchMerchants(q: { search?: string; status?: string; plan?: string; page: number; pageSize: number }) {
  const s = q.search?.trim() ? `%${q.search.trim()}%` : null;
  const where = and(
    s ? or(like(tenants.name, s), like(stores.slug, s), like(users.email, s), like(users.phone, s)) : undefined,
    q.status ? eq(tenants.status, q.status as "active") : undefined,
    q.plan ? eq(plans.code, q.plan) : undefined
  );
  const base = db()
    .select({
      tenantId: tenants.id,
      name: tenants.name,
      status: tenants.status,
      verification: tenants.verificationStatus,
      createdAt: tenants.createdAt,
      storeId: stores.id,
      slug: stores.slug,
      storeStatus: stores.status,
      category: stores.category,
      ownerName: users.name,
      ownerEmail: users.email,
      ownerPhone: users.phone,
      plan: plans.code,
      subStatus: subscriptions.status,
      gmv30d: sql<string>`(select coalesce(sum(o.grandTotal),0) from ${orders} o where o.tenantId = ${tenants.id} and o.createdAt >= ${new Date(Date.now() - 30 * DAY_MS)} and o.status in ('PAID','CONFIRMED','PROCESSING','SHIPPED','DELIVERED'))`,
      orders30d: sql<number>`(select count(*) from ${orders} o where o.tenantId = ${tenants.id} and o.createdAt >= ${new Date(Date.now() - 30 * DAY_MS)})`,
    })
    .from(tenants)
    .innerJoin(stores, eq(stores.tenantId, tenants.id))
    .innerJoin(users, eq(users.id, tenants.ownerUserId))
    .leftJoin(subscriptions, and(eq(subscriptions.tenantId, tenants.id), eq(subscriptions.isCurrent, true)))
    .leftJoin(plans, eq(plans.id, subscriptions.planId))
    .where(where);
  const rows = await base.orderBy(desc(tenants.id)).limit(q.pageSize).offset((q.page - 1) * q.pageSize);
  const [{ total }] = await db()
    .select({ total: sql<number>`count(*)` })
    .from(tenants)
    .innerJoin(stores, eq(stores.tenantId, tenants.id))
    .innerJoin(users, eq(users.id, tenants.ownerUserId))
    .leftJoin(subscriptions, and(eq(subscriptions.tenantId, tenants.id), eq(subscriptions.isCurrent, true)))
    .leftJoin(plans, eq(plans.id, subscriptions.planId))
    .where(where);
  return { items: rows.map(r => ({ ...r, gmv30d: fromP(toP(r.gmv30d)), orders30d: Number(r.orders30d) })), total: Number(total) };
}

export async function merchantDetail(tenantId: number) {
  const [t] = await db().select().from(tenants).where(eq(tenants.id, tenantId)).limit(1);
  if (!t) fail("NOT_FOUND", "Merchant not found");
  const [store] = await db().select().from(stores).where(eq(stores.tenantId, tenantId)).limit(1);
  const [owner] = await db().select({ id: users.id, name: users.name, email: users.email, phone: users.phone, status: users.status, phoneVerifiedAt: users.phoneVerifiedAt, createdAt: users.createdAt }).from(users).where(eq(users.id, t.ownerUserId)).limit(1);
  const members = await db()
    .select({ id: memberships.id, status: memberships.status, role: roles.name, name: users.name, email: users.email, inviteEmail: memberships.inviteEmail })
    .from(memberships)
    .innerJoin(roles, eq(roles.id, memberships.roleId))
    .leftJoin(users, eq(users.id, memberships.userId))
    .where(eq(memberships.tenantId, tenantId));
  const subs = await db().select({ s: subscriptions, plan: plans.code }).from(subscriptions).innerJoin(plans, eq(plans.id, subscriptions.planId)).where(eq(subscriptions.tenantId, tenantId)).orderBy(desc(subscriptions.id)).limit(10);
  const invs = await db().select().from(invoices).where(eq(invoices.tenantId, tenantId)).orderBy(desc(invoices.id)).limit(20);
  const fees = await db().select().from(feeLedger).where(eq(feeLedger.tenantId, tenantId)).orderBy(desc(feeLedger.id)).limit(30);
  const doms = store ? await db().select().from(domains).where(eq(domains.storeId, store.id)) : [];
  const logs = await db().select().from(auditLogs).where(eq(auditLogs.tenantId, tenantId)).orderBy(desc(auditLogs.id)).limit(40);
  const imps = await db().select().from(impersonationSessions).where(eq(impersonationSessions.tenantId, tenantId)).orderBy(desc(impersonationSessions.id)).limit(10);
  const ent = await getEntitlements(tenantId);
  return { tenant: t, store, owner, members, subscriptions: subs, invoices: invs, fees, domains: doms, audit: logs, impersonations: imps, entitlements: ent };
}

export async function setVerification(admin: User, tenantId: number, status: "unverified" | "pending" | "verified" | "rejected", note?: string) {
  await db().update(tenants).set({ verificationStatus: status }).where(eq(tenants.id, tenantId));
  await audit({ tenantId, actorId: admin.id, actorType: "admin", action: "merchant.verification", metadata: { status, note } });
  await notifyTenant(tenantId, "settings.manage", { type: "merchant.verification", title: status === "verified" ? "Your business is verified ✓" : `Verification status: ${status}`, body: note, link: "/app/settings" });
}

export async function suspendTenant(admin: User, tenantId: number, reason: string) {
  if (!reason.trim()) fail("VALIDATION", "A reason is required");
  await db().update(tenants).set({ status: "suspended", suspendedReason: reason.trim() }).where(eq(tenants.id, tenantId));
  await db().update(stores).set({ status: "suspended" }).where(eq(stores.tenantId, tenantId));
  invalidateEntitlements(tenantId);
  clearStoreCache();
  await audit({ tenantId, actorId: admin.id, actorType: "admin", action: "merchant.suspended", metadata: { reason } });
  await notifyTenant(tenantId, null, { type: "merchant.suspended", title: "Your store was suspended by ATLaS", body: reason, link: "/app/support" });
}

export async function restoreTenant(admin: User, tenantId: number) {
  const [store] = await db().select().from(stores).where(eq(stores.tenantId, tenantId)).limit(1);
  await db().update(tenants).set({ status: "active", suspendedReason: null }).where(eq(tenants.id, tenantId));
  if (store) await db().update(stores).set({ status: store.publishedAt ? "published" : "draft" }).where(eq(stores.id, store.id));
  invalidateEntitlements(tenantId);
  clearStoreCache();
  await audit({ tenantId, actorId: admin.id, actorType: "admin", action: "merchant.restored" });
  await notifyTenant(tenantId, null, { type: "merchant.restored", title: "Your store has been restored", link: "/app" });
}

/* ───────── Impersonation (reason + ticket, time-limited, audited) ───────── */
export async function startImpersonation(admin: User, tenantId: number, input: { reason: string; ticketRef: string; minutes: number }) {
  if (!["super_admin", "support"].includes(admin.platformRole)) fail("FORBIDDEN", "Only Super Admin or Support can impersonate");
  if (input.reason.trim().length < 10) fail("VALIDATION", "Give a clear reason (at least 10 characters)");
  if (!input.ticketRef.trim()) fail("VALIDATION", "A ticket/reference ID is required");
  const minutes = Math.min(Math.max(input.minutes, 5), 60);
  await db().update(impersonationSessions).set({ endedAt: new Date() }).where(and(eq(impersonationSessions.adminUserId, admin.id), isNull(impersonationSessions.endedAt)));
  const [row] = await db()
    .insert(impersonationSessions)
    .values({ adminUserId: admin.id, tenantId, reason: input.reason.trim(), ticketRef: input.ticketRef.trim(), expiresAt: new Date(Date.now() + minutes * 60_000) })
    .$returningId();
  await audit({ tenantId, actorId: admin.id, actorType: "admin", action: "impersonation.started", resourceType: "impersonation", resourceId: row.id, metadata: { reason: input.reason, ticketRef: input.ticketRef, minutes }, impersonationId: row.id });
  return { id: row.id, expiresAt: new Date(Date.now() + minutes * 60_000) };
}

export async function endImpersonation(admin: User, id?: number) {
  const open = await db()
    .select()
    .from(impersonationSessions)
    .where(and(eq(impersonationSessions.adminUserId, admin.id), isNull(impersonationSessions.endedAt), id ? eq(impersonationSessions.id, id) : undefined));
  for (const s of open) {
    await db().update(impersonationSessions).set({ endedAt: new Date() }).where(eq(impersonationSessions.id, s.id));
    await audit({ tenantId: s.tenantId, actorId: admin.id, actorType: "admin", action: "impersonation.ended", resourceType: "impersonation", resourceId: s.id, impersonationId: s.id });
  }
  return { ended: open.length };
}

export async function myImpersonations(adminId: number) {
  return db()
    .select({ s: impersonationSessions, name: tenants.name })
    .from(impersonationSessions)
    .innerJoin(tenants, eq(tenants.id, impersonationSessions.tenantId))
    .where(and(eq(impersonationSessions.adminUserId, adminId), isNull(impersonationSessions.endedAt), gte(impersonationSessions.expiresAt, new Date())))
    .orderBy(desc(impersonationSessions.id));
}

/* ───────── Plans & entitlements ───────── */
export async function listPlansAdmin() {
  return db().select().from(plans).orderBy(plans.sortOrder);
}
export async function updatePlan(admin: User, id: number, patch: { name?: string; tagline?: string; priceMonthly?: string; priceYearly?: string; limits?: PlanLimits; features?: string[]; status?: "active" | "hidden" }) {
  const [p] = await db().select().from(plans).where(eq(plans.id, id)).limit(1);
  if (!p) fail("NOT_FOUND", "Plan not found");
  if (patch.priceMonthly && Number(patch.priceMonthly) < 0) fail("VALIDATION", "Price can't be negative");
  await db()
    .update(plans)
    .set({
      name: patch.name ?? p.name,
      tagline: patch.tagline ?? p.tagline,
      priceMonthly: patch.priceMonthly ? Number(patch.priceMonthly).toFixed(2) : p.priceMonthly,
      priceYearly: patch.priceYearly ? Number(patch.priceYearly).toFixed(2) : p.priceYearly,
      limitsJson: patch.limits ?? p.limitsJson,
      featuresJson: patch.features ?? p.featuresJson,
      status: patch.status ?? p.status,
    })
    .where(eq(plans.id, id));
  invalidatePlans();
  const all = await db().select({ id: tenants.id }).from(tenants);
  for (const t of all) invalidateEntitlements(t.id);
  await audit({ actorId: admin.id, actorType: "admin", action: "plan.updated", resourceType: "plan", resourceId: p.code, metadata: { before: { priceMonthly: p.priceMonthly, limits: p.limitsJson }, after: patch } });
}

/* ───────── Finance ───────── */
export async function financeOverview() {
  const [inv] = await db()
    .select({
      open: sql<string>`coalesce(sum(case when ${invoices.status} = 'open' then ${invoices.total} else 0 end),0)`,
      paid30: sql<string>`coalesce(sum(case when ${invoices.status} = 'paid' and ${invoices.paidAt} >= ${new Date(Date.now() - 30 * DAY_MS)} then ${invoices.total} else 0 end),0)`,
      openCount: sql<number>`sum(case when ${invoices.status} = 'open' then 1 else 0 end)`,
    })
    .from(invoices);
  const [fees] = await db()
    .select({
      pending: sql<string>`coalesce(sum(case when ${feeLedger.status} = 'pending' then ${feeLedger.feeAmount} else 0 end),0)`,
      invoiced: sql<string>`coalesce(sum(case when ${feeLedger.status} in ('invoiced','paid') then ${feeLedger.feeAmount} else 0 end),0)`,
      voided: sql<number>`sum(case when ${feeLedger.status} = 'void' then 1 else 0 end)`,
    })
    .from(feeLedger);
  return { invoices: { open: fromP(toP(inv.open)), openCount: Number(inv.openCount ?? 0), paid30d: fromP(toP(inv.paid30)) }, fees: { pending: fromP(toP(fees.pending)), invoiced: fromP(toP(fees.invoiced)), voided: Number(fees.voided ?? 0) } };
}

export async function listSubscriptions(q: { status?: string; limit: number }) {
  return db()
    .select({ s: subscriptions, plan: plans.code, tenant: tenants.name })
    .from(subscriptions)
    .innerJoin(plans, eq(plans.id, subscriptions.planId))
    .innerJoin(tenants, eq(tenants.id, subscriptions.tenantId))
    .where(and(eq(subscriptions.isCurrent, true), q.status ? eq(subscriptions.status, q.status as "ACTIVE") : undefined))
    .orderBy(desc(subscriptions.id))
    .limit(q.limit);
}
export async function listInvoicesAdmin(q: { status?: string; limit: number }) {
  return db()
    .select({ i: invoices, tenant: tenants.name })
    .from(invoices)
    .innerJoin(tenants, eq(tenants.id, invoices.tenantId))
    .where(q.status ? eq(invoices.status, q.status as "open") : undefined)
    .orderBy(desc(invoices.id))
    .limit(q.limit);
}
export async function listFeesAdmin(q: { status?: string; limit: number }) {
  return db()
    .select({ f: feeLedger, tenant: tenants.name })
    .from(feeLedger)
    .innerJoin(tenants, eq(tenants.id, feeLedger.tenantId))
    .where(q.status ? eq(feeLedger.status, q.status as "pending") : undefined)
    .orderBy(desc(feeLedger.id))
    .limit(q.limit);
}
export async function listRefundsAdmin(limit: number) {
  return db()
    .select({ r: refundRequests, tenant: tenants.name, orderNo: orders.orderNo })
    .from(refundRequests)
    .innerJoin(tenants, eq(tenants.id, refundRequests.tenantId))
    .innerJoin(orders, eq(orders.id, refundRequests.orderId))
    .orderBy(desc(refundRequests.id))
    .limit(limit);
}

/* ───────── Security center ───────── */
export async function securityOverview() {
  const since = new Date(Date.now() - DAY_MS);
  const [le] = await db()
    .select({
      total: sql<number>`count(*)`,
      failed: sql<number>`sum(case when ${loginEvents.success} = false then 1 else 0 end)`,
      suspicious: sql<number>`sum(case when ${loginEvents.suspicious} = true then 1 else 0 end)`,
    })
    .from(loginEvents)
    .where(gte(loginEvents.createdAt, since));
  const [rl] = await db().select({ n: sql<number>`count(*)` }).from(rateLimitEvents).where(gte(rateLimitEvents.createdAt, since));
  const [sess] = await db().select({ n: sql<number>`count(*)` }).from(sessions).where(and(isNull(sessions.revokedAt), gte(sessions.expiresAt, new Date())));
  const [imp] = await db().select({ n: sql<number>`count(*)` }).from(impersonationSessions).where(and(isNull(impersonationSessions.endedAt), gte(impersonationSessions.expiresAt, new Date())));
  return { logins24h: Number(le.total), failed24h: Number(le.failed ?? 0), suspicious24h: Number(le.suspicious ?? 0), rateLimited24h: Number(rl.n), activeSessions: Number(sess.n), activeImpersonations: Number(imp.n) };
}
export async function loginEventsList(q: { suspiciousOnly?: boolean; failedOnly?: boolean; limit: number }) {
  return db()
    .select()
    .from(loginEvents)
    .where(and(q.suspiciousOnly ? eq(loginEvents.suspicious, true) : undefined, q.failedOnly ? eq(loginEvents.success, false) : undefined))
    .orderBy(desc(loginEvents.id))
    .limit(q.limit);
}
export async function auditList(q: { tenantId?: number; action?: string; limit: number }) {
  return db()
    .select({ a: auditLogs, actorName: users.name, actorEmail: users.email })
    .from(auditLogs)
    .leftJoin(users, eq(users.id, auditLogs.actorId))
    .where(and(q.tenantId ? eq(auditLogs.tenantId, q.tenantId) : undefined, q.action ? like(auditLogs.action, `%${q.action}%`) : undefined))
    .orderBy(desc(auditLogs.id))
    .limit(q.limit);
}
export async function rateLimitList(limit: number) {
  return db().select().from(rateLimitEvents).orderBy(desc(rateLimitEvents.id)).limit(limit);
}
export async function jobsList(q: { status?: string; limit: number }) {
  return db()
    .select()
    .from(jobs)
    .where(q.status ? eq(jobs.status, q.status as "queued") : undefined)
    .orderBy(desc(jobs.id))
    .limit(q.limit);
}
export async function messagesList(q: { channel?: string; recipient?: string; limit: number }) {
  return db()
    .select()
    .from(outboundMessages)
    .where(and(q.channel ? eq(outboundMessages.channel, q.channel as "sms") : undefined, q.recipient ? like(outboundMessages.recipient, `%${q.recipient}%`) : undefined))
    .orderBy(desc(outboundMessages.id))
    .limit(q.limit);
}
export async function platformUsers(q: { search?: string; limit: number }) {
  const s = q.search?.trim() ? `%${q.search.trim()}%` : null;
  return db()
    .select({ id: users.id, name: users.name, email: users.email, phone: users.phone, status: users.status, platformRole: users.platformRole, createdAt: users.createdAt, twoFactorEnabled: users.twoFactorEnabled })
    .from(users)
    .where(s ? or(like(users.name, s), like(users.email, s), like(users.phone, s)) : undefined)
    .orderBy(desc(users.id))
    .limit(q.limit);
}
export async function setPlatformRole(admin: User, userId: number, role: "none" | PlatformRole) {
  if (admin.platformRole !== "super_admin") fail("FORBIDDEN", "Only Super Admin can change platform roles");
  if (admin.id === userId && role !== "super_admin") fail("VALIDATION", "You can't remove your own Super Admin role");
  await db().update(users).set({ platformRole: role }).where(eq(users.id, userId));
  await audit({ actorId: admin.id, actorType: "admin", action: "user.platform_role", resourceType: "user", resourceId: userId, metadata: { role } });
}
