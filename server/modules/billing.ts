import { and, asc, desc, eq, inArray, isNull, lte, ne, or, sql } from "drizzle-orm";
import { db, affected, type DbOrTx } from "../db";
import {
  feeLedger,
  invoiceLines,
  invoices,
  memberships,
  orders,
  plans,
  platformSettings,
  products,
  stores,
  subscriptions,
  tenants,
  usageCounters,
  users,
  type Plan,
  type PlanLimits,
  type Subscription,
} from "../../drizzle/schema";
import { COURIER_FEE_RATE_PERCENT, type SubscriptionStatus } from "../../shared/domain";
import { FREE_TRIAL_PLAN, GRACE_DAYS, PLAN_ORDER, READ_ONLY_DAYS, REMINDER_DAYS, RETRY_DAYS, STORAGE_FAIR_USE_MB, type PlanCode } from "../../shared/plans";
import { addDays, addMonths, DAY_MS, fail, fromP, monthPeriod, pctOf, toP } from "../lib/core";
import { randomId } from "../lib/crypto";
import { every } from "./jobs";
import { audit, notifyTenant, sendEmail, track } from "./ops";

/* ───────── Plans ───────── */
let planCache: { rows: Plan[]; until: number } | null = null;
export async function getPlans(): Promise<Plan[]> {
  if (planCache && planCache.until > Date.now()) return planCache.rows;
  const rows = await db().select().from(plans).orderBy(asc(plans.sortOrder));
  planCache = { rows, until: Date.now() + 60_000 };
  return rows;
}
export function invalidatePlans() {
  planCache = null;
  entCache.clear();
}
export async function planById(id: number) {
  return (await getPlans()).find(p => p.id === id) ?? fail("NOT_FOUND", "Plan not found");
}
export async function planByCode(code: string) {
  return (await getPlans()).find(p => p.code === code) ?? fail("NOT_FOUND", `Plan ${code} not found`);
}
export const planRank = (code: string) => PLAN_ORDER.indexOf(code as PlanCode);
const cyclePrice = (p: Plan, cycle: "monthly" | "yearly") => (cycle === "yearly" ? p.priceYearly : p.priceMonthly);
const cycleEnd = (start: Date, cycle: "monthly" | "yearly") => addMonths(start, cycle === "yearly" ? 12 : 1);

/* ───────── Entitlements ───────── */
export type Entitlements = {
  tenantId: number;
  subscriptionId: number;
  status: SubscriptionStatus;
  planCode: PlanCode;
  planName: string;
  effectivePlanCode: PlanCode;
  limits: PlanLimits;
  writable: boolean;
  storefrontLive: boolean;
  acceptingOrders: boolean;
  trialEndsAt: Date | null;
  currentPeriodEnd: Date;
  graceEndsAt: Date | null;
  readOnlyAt: Date | null;
  suspendAt: Date | null;
  cancelAtPeriodEnd: boolean;
  pendingPlanCode: PlanCode | null;
  billingCycle: "monthly" | "yearly";
  tenantStatus: "active" | "suspended" | "closed";
};
const entCache = new Map<number, { ent: Entitlements; until: number }>();
export function invalidateEntitlements(tenantId: number) {
  entCache.delete(tenantId);
}

async function currentSub(tenantId: number, tx: DbOrTx = db()): Promise<Subscription | null> {
  const [s] = await tx
    .select()
    .from(subscriptions)
    .where(and(eq(subscriptions.tenantId, tenantId), eq(subscriptions.isCurrent, true)))
    .orderBy(desc(subscriptions.id))
    .limit(1);
  return s ?? null;
}

export async function getEntitlements(tenantId: number, opts: { fresh?: boolean } = {}): Promise<Entitlements> {
  const c = entCache.get(tenantId);
  if (!opts.fresh && c && c.until > Date.now()) return c.ent;
  let sub = await currentSub(tenantId);
  if (!sub) sub = await startSubscription(tenantId, "free", "monthly", { trial: false });
  sub = await advanceLifecycle(sub);
  const [tenant] = await db().select().from(tenants).where(eq(tenants.id, tenantId)).limit(1);
  const plan = await planById(sub.planId);
  const effective = sub.status === "TRIALING" && sub.trialPlanId ? await planById(sub.trialPlanId) : plan;
  const pending = sub.pendingPlanId ? await planById(sub.pendingPlanId) : null;
  const tenantStatus = tenant?.status ?? "active";
  const base = sub.pastDueSince;
  const ent: Entitlements = {
    tenantId,
    subscriptionId: sub.id,
    status: sub.status,
    planCode: plan.code as PlanCode,
    planName: plan.name,
    effectivePlanCode: effective.code as PlanCode,
    limits: effective.limitsJson,
    writable: tenantStatus === "active" && !["READ_ONLY", "SUSPENDED", "CANCELLED"].includes(sub.status),
    storefrontLive: tenantStatus === "active" && sub.status !== "SUSPENDED",
    acceptingOrders: tenantStatus === "active" && !["READ_ONLY", "SUSPENDED", "CANCELLED"].includes(sub.status),
    trialEndsAt: sub.status === "TRIALING" ? sub.trialEnd : null,
    currentPeriodEnd: sub.currentPeriodEnd,
    graceEndsAt: base ? addDays(base, GRACE_DAYS) : null,
    readOnlyAt: base ? addDays(base, GRACE_DAYS) : null,
    suspendAt: base ? addDays(base, GRACE_DAYS + READ_ONLY_DAYS) : null,
    cancelAtPeriodEnd: sub.cancelAtPeriodEnd,
    pendingPlanCode: (pending?.code as PlanCode) ?? null,
    billingCycle: sub.billingCycle,
    tenantStatus,
  };
  entCache.set(tenantId, { ent, until: Date.now() + 20_000 });
  return ent;
}

export function assertWritable(ent: Entitlements) {
  if (ent.tenantStatus === "suspended") fail("READ_ONLY", "This store is suspended by ATLaS. Contact support to restore access.");
  if (!ent.writable)
    fail("READ_ONLY", ent.status === "SUSPENDED" ? "Your subscription is suspended. Pay the open invoice to restore your store." : "Your account is read-only because of an unpaid invoice. Renew to continue editing.", {
      status: ent.status,
    });
}
export function assertFeature(ok: boolean, feature: string, requiredPlan: PlanCode) {
  if (!ok) fail("FEATURE_NOT_IN_PLAN", `${feature} is available on the ${requiredPlan[0].toUpperCase() + requiredPlan.slice(1)} plan and above. Upgrade to unlock it.`, { feature, requiredPlan });
}

export async function productCount(storeId: number, tx: DbOrTx = db()) {
  const [r] = await tx
    .select({ n: sql<number>`count(*)` })
    .from(products)
    .where(and(eq(products.storeId, storeId), isNull(products.deletedAt), ne(products.status, "archived")));
  return Number(r?.n ?? 0);
}
export async function assertProductQuota(ent: Entitlements, storeId: number, adding = 1) {
  const limit = ent.limits.products;
  if (limit === null) return;
  const used = await productCount(storeId);
  if (used + adding > limit)
    fail(
      "QUOTA_EXCEEDED",
      `Your ${ent.planName} plan allows ${limit} products and you have ${used}. Upgrade your plan to add more — existing products can still be viewed and edited.`,
      { metric: "products", limit, used, adding }
    );
}
export async function storageUsedBytes(tenantId: number) {
  const { assets } = await import("../../drizzle/schema");
  const [r] = await db()
    .select({ n: sql<number>`coalesce(sum(${assets.sizeBytes}),0)` })
    .from(assets)
    .where(and(eq(assets.tenantId, tenantId), isNull(assets.deletedAt)));
  return Number(r?.n ?? 0);
}
export async function assertStorageQuota(ent: Entitlements, addBytes: number) {
  const limitMb = ent.limits.storageMB ?? STORAGE_FAIR_USE_MB;
  const used = await storageUsedBytes(ent.tenantId);
  if (used + addBytes > limitMb * 1024 * 1024)
    fail("QUOTA_EXCEEDED", `Storage limit reached (${limitMb >= 1024 ? limitMb / 1024 + " GB" : limitMb + " MB"}). Delete unused images or upgrade.`, { metric: "storage", limitMb, usedBytes: used });
}
export async function assertStaffSeat(ent: Entitlements) {
  const [r] = await db()
    .select({ n: sql<number>`count(*)` })
    .from(memberships)
    .where(and(eq(memberships.tenantId, ent.tenantId), inArray(memberships.status, ["active", "invited"])));
  const used = Number(r?.n ?? 0);
  if (used >= ent.limits.staffSeats) fail("QUOTA_EXCEEDED", `Your plan includes ${ent.limits.staffSeats} staff seat(s). Upgrade to invite more teammates.`, { metric: "staff", limit: ent.limits.staffSeats, used });
}

/* ───────── Usage counters (monthly, Asia/Dhaka) ───────── */
export async function incrementUsage(tx: DbOrTx, tenantId: number, metric: string, delta: number, at: Date = new Date()): Promise<number> {
  const p = monthPeriod(at);
  await tx
    .insert(usageCounters)
    .values({ tenantId, metric, periodStart: p.start, periodEnd: p.end, quantity: Math.max(0, delta) })
    .onDuplicateKeyUpdate({ set: { quantity: sql`GREATEST(0, ${usageCounters.quantity} + ${delta})` } });
  const [row] = await tx
    .select({ q: usageCounters.quantity })
    .from(usageCounters)
    .where(and(eq(usageCounters.tenantId, tenantId), eq(usageCounters.metric, metric), eq(usageCounters.periodStart, p.start)))
    .limit(1);
  return Number(row?.q ?? 0);
}
export async function usageFor(tenantId: number, metric: string, at: Date = new Date()) {
  const p = monthPeriod(at);
  const [row] = await db()
    .select({ q: usageCounters.quantity })
    .from(usageCounters)
    .where(and(eq(usageCounters.tenantId, tenantId), eq(usageCounters.metric, metric), eq(usageCounters.periodStart, p.start)))
    .limit(1);
  return Number(row?.q ?? 0);
}

/* ───────── Fee ledger (PRD §5.2) ───────── */
type FeeOrder = { id: number; tenantId: number; storeId: number; orderNo: string; subtotal: string; discountTotal: string; feeEligibleAt: Date | null };

/** Called on the first transition to PAID (online) or CONFIRMED (COD). Idempotent per order. */
export async function recordEligibleSale(tx: DbOrTx, order: FeeOrder) {
  const now = new Date();
  const claimed = affected(await tx.update(orders).set({ feeEligibleAt: now }).where(and(eq(orders.id, order.id), isNull(orders.feeEligibleAt))));
  if (!claimed) return null;
  const ent = await getEntitlements(order.tenantId);
  const count = await incrementUsage(tx, order.tenantId, "orders", 1, now);
  const included = ent.limits.monthlyOrdersIncluded;
  const rate = ent.limits.overageRatePercent;
  if (included === null || count <= included || rate <= 0) return { count, fee: null };
  const baseP = Math.max(0, toP(order.subtotal) - toP(order.discountTotal));
  const feeP = pctOf(baseP, rate);
  await tx.insert(feeLedger).values({
    tenantId: order.tenantId,
    storeId: order.storeId,
    orderId: order.id,
    orderNo: order.orderNo,
    feeType: "order_overage",
    baseAmount: fromP(baseP),
    rate: rate.toFixed(4),
    feeAmount: fromP(feeP),
    periodStart: monthPeriod(now).start,
  });
  if (count === included + 1)
    await notifyTenant(order.tenantId, "billing.manage", {
      type: "billing.quota_reached",
      title: "Monthly included orders used up",
      body: `You've used all ${included} included orders this month. New sales incur a ${rate}% fee — upgrade to lower it.`,
      link: "/app/billing",
      dedupeKey: `quota:${order.tenantId}:${monthPeriod(now).start}`,
    });
  return { count, fee: fromP(feeP) };
}

/** Cancelled or fully refunded orders void their fee (or create a reversal if already invoiced). */
export async function voidSaleFee(tx: DbOrTx, order: FeeOrder, reason: string) {
  if (!order.feeEligibleAt) return;
  await incrementUsage(tx, order.tenantId, "orders", -1, order.feeEligibleAt);
  const entries = await tx.select().from(feeLedger).where(and(eq(feeLedger.orderId, order.id), eq(feeLedger.feeType, "order_overage")));
  for (const e of entries) await reverseFeeEntry(tx, e, toP(e.feeAmount), reason);
}

/** Partial refunds remove refunded merchandise lines from the fee base. */
export async function partialRefundFee(tx: DbOrTx, order: FeeOrder, refundedBaseP: number, reason: string) {
  const entries = await tx.select().from(feeLedger).where(and(eq(feeLedger.orderId, order.id), eq(feeLedger.feeType, "order_overage")));
  for (const e of entries) {
    if (e.status === "void") continue;
    await reverseFeeEntry(tx, e, Math.min(toP(e.feeAmount), pctOf(refundedBaseP, Number(e.rate))), reason, refundedBaseP);
  }
}

async function reverseFeeEntry(tx: DbOrTx, e: typeof feeLedger.$inferSelect, amountP: number, reason: string, baseP?: number) {
  if (amountP <= 0 || e.status === "void") return;
  if (e.status === "pending" && amountP === toP(e.feeAmount)) {
    await tx.update(feeLedger).set({ status: "void", voidReason: reason }).where(and(eq(feeLedger.id, e.id), eq(feeLedger.status, "pending")));
    return;
  }
  await tx.insert(feeLedger).values({
    tenantId: e.tenantId,
    storeId: e.storeId,
    orderId: e.orderId,
    orderNo: e.orderNo,
    feeType: "reversal",
    reversesId: e.id,
    baseAmount: fromP(-(baseP ?? toP(e.baseAmount))),
    rate: e.rate,
    feeAmount: fromP(-amountP),
    voidReason: reason,
    periodStart: monthPeriod().start,
  });
}

/** Third-party courier payment charge (0.5%) is its own fee type and never double-counts the sale fee. */
export async function recordCourierFee(tx: DbOrTx, p: { tenantId: number; storeId: number; orderId: number; orderNo: string; codAmountP: number }) {
  if (p.codAmountP <= 0) return null;
  const feeP = pctOf(p.codAmountP, COURIER_FEE_RATE_PERCENT);
  await tx.insert(feeLedger).values({
    tenantId: p.tenantId,
    storeId: p.storeId,
    orderId: p.orderId,
    orderNo: p.orderNo,
    feeType: "courier_payment_charge",
    baseAmount: fromP(p.codAmountP),
    rate: COURIER_FEE_RATE_PERCENT.toFixed(4),
    feeAmount: fromP(feeP),
    periodStart: monthPeriod().start,
  });
  return fromP(feeP);
}
export async function voidCourierFee(tx: DbOrTx, orderId: number, reason: string) {
  const entries = await tx.select().from(feeLedger).where(and(eq(feeLedger.orderId, orderId), eq(feeLedger.feeType, "courier_payment_charge")));
  for (const e of entries) await reverseFeeEntry(tx, e, toP(e.feeAmount), reason);
}

/* ───────── Subscriptions ───────── */
export async function startSubscription(tenantId: number, planCode: PlanCode, cycle: "monthly" | "yearly", opts: { trial: boolean }, tx: DbOrTx = db()): Promise<Subscription> {
  const plan = await planByCode(planCode);
  const now = new Date();
  const trialPlan = opts.trial ? await planByCode(planCode === "free" ? FREE_TRIAL_PLAN : planCode) : null;
  const trialEnd = trialPlan ? addDays(now, trialPlan.limitsJson.trialDays || 7) : null;
  await tx.update(subscriptions).set({ isCurrent: false }).where(eq(subscriptions.tenantId, tenantId));
  const [row] = await tx
    .insert(subscriptions)
    .values({
      tenantId,
      planId: plan.id,
      trialPlanId: trialPlan?.id ?? null,
      billingCycle: plan.limitsJson.yearlyBilling ? cycle : "monthly",
      status: trialPlan ? "TRIALING" : "ACTIVE",
      trialEnd,
      currentPeriodStart: now,
      currentPeriodEnd: trialEnd ?? (planCode === "free" ? monthPeriod(now).endAt : cycleEnd(now, cycle)),
      remindersSentJson: [],
    })
    .$returningId();
  invalidateEntitlements(tenantId);
  const [s] = await tx.select().from(subscriptions).where(eq(subscriptions.id, row.id)).limit(1);
  return s;
}

async function ownerContact(tenantId: number) {
  const [r] = await db()
    .select({ email: users.email, name: users.name })
    .from(tenants)
    .innerJoin(users, eq(users.id, tenants.ownerUserId))
    .where(eq(tenants.id, tenantId))
    .limit(1);
  return r;
}
async function billingNotice(tenantId: number, type: string, title: string, body: string, dedupeKey?: string) {
  await notifyTenant(tenantId, "billing.manage", { type, title, body, link: "/app/billing", dedupeKey });
  const owner = await ownerContact(tenantId);
  if (owner?.email) await sendEmail({ to: owner.email, subject: `ATLaS — ${title}`, body, template: type, tenantId });
}

async function nextInvoiceNumber() {
  const d = new Date();
  return `INV-${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, "0")}-${randomId(6).toUpperCase()}`;
}

/** Creates an invoice. Pending fee-ledger entries are attached for renewal and usage invoices. */
export async function createInvoice(
  tenantId: number,
  sub: Subscription,
  p: { kind: "subscription" | "renewal" | "usage" | "upgrade"; plan?: Plan; cycle?: "monthly" | "yearly"; periodStart?: Date; periodEnd?: Date; includeFees: boolean; dueAt?: Date }
) {
  const lines: (typeof invoiceLines.$inferInsert)[] = [];
  if (p.plan && p.kind !== "usage") {
    const amount = cyclePrice(p.plan, p.cycle ?? "monthly");
    if (toP(amount) > 0)
      lines.push({ invoiceId: 0, type: "subscription", description: `${p.plan.name} plan — ${p.cycle === "yearly" ? "yearly" : "monthly"}`, amount, baseAmount: null, rate: null });
  }
  let feeIds: number[] = [];
  if (p.includeFees) {
    const fees = await db()
      .select()
      .from(feeLedger)
      .where(and(eq(feeLedger.tenantId, tenantId), eq(feeLedger.status, "pending")));
    feeIds = fees.map(f => f.id);
    for (const f of fees)
      lines.push({
        invoiceId: 0,
        type: f.feeType,
        description:
          f.feeType === "order_overage"
            ? `Sale fee ${Number(f.rate)}% — order ${f.orderNo}`
            : f.feeType === "courier_payment_charge"
              ? `Courier payment charge ${Number(f.rate)}% — order ${f.orderNo}`
              : `Fee reversal — order ${f.orderNo}`,
        orderId: f.orderId,
        orderNo: f.orderNo,
        feeLedgerId: f.id,
        baseAmount: f.baseAmount,
        rate: f.rate,
        amount: f.feeAmount,
      });
  }
  const totalP = lines.reduce((s, l) => s + toP(l.amount), 0);
  if (!lines.length || (p.kind === "usage" && totalP <= 0)) return null;
  const number = await nextInvoiceNumber();
  const [row] = await db()
    .insert(invoices)
    .values({
      tenantId,
      subscriptionId: sub.id,
      number,
      kind: p.kind,
      planId: p.plan?.id ?? null,
      billingCycle: p.cycle ?? null,
      periodStart: p.periodStart ?? null,
      periodEnd: p.periodEnd ?? null,
      subtotal: fromP(Math.max(0, totalP)),
      total: fromP(Math.max(0, totalP)),
      status: totalP <= 0 ? "paid" : "open",
      dueAt: p.dueAt ?? new Date(),
      paidAt: totalP <= 0 ? new Date() : null,
    })
    .$returningId();
  for (const l of lines) await db().insert(invoiceLines).values({ ...l, invoiceId: row.id });
  if (feeIds.length) await db().update(feeLedger).set({ status: "invoiced", invoiceId: row.id }).where(inArray(feeLedger.id, feeIds));
  const [inv] = await db().select().from(invoices).where(eq(invoices.id, row.id)).limit(1);
  return inv;
}

/** Sandbox auto-renew charge against the saved wallet/card token. */
async function chargeSavedMethod(sub: Subscription, invoice: typeof invoices.$inferSelect): Promise<boolean> {
  if (!sub.autoRenew || !sub.savedMethodJson) return false;
  const key = `billing.failNextRenewal.${sub.tenantId}`;
  const [flag] = await db().select().from(platformSettings).where(eq(platformSettings.key, key)).limit(1);
  const { recordPlatformCharge } = await import("./payments");
  if (flag?.valueJson === true) {
    await db().delete(platformSettings).where(eq(platformSettings.key, key));
    await recordPlatformCharge(invoice, sub.savedMethodJson.provider, false);
    return false;
  }
  await recordPlatformCharge(invoice, sub.savedMethodJson.provider, true);
  return true;
}

export async function onInvoicePaid(invoiceId: number) {
  const [inv] = await db().select().from(invoices).where(eq(invoices.id, invoiceId)).limit(1);
  if (!inv) return;
  const changed = affected(await db().update(invoices).set({ status: "paid", paidAt: new Date() }).where(and(eq(invoices.id, inv.id), ne(invoices.status, "paid"))));
  if (!changed && inv.status === "paid" && inv.kind !== "renewal") return;
  await db().update(feeLedger).set({ status: "paid" }).where(eq(feeLedger.invoiceId, inv.id));
  const sub = await currentSub(inv.tenantId);
  if (!sub) return;
  const now = new Date();
  const prevPlan = await planById(sub.planId);
  if ((inv.kind === "upgrade" || inv.kind === "subscription") && inv.planId) {
    const plan = await planById(inv.planId);
    const cycle = inv.billingCycle ?? "monthly";
    await db()
      .update(subscriptions)
      .set({
        planId: plan.id,
        billingCycle: cycle,
        status: "ACTIVE",
        trialEnd: null,
        currentPeriodStart: now,
        currentPeriodEnd: cycleEnd(now, cycle),
        pastDueSince: null,
        retryCount: 0,
        nextRetryAt: null,
        pendingPlanId: null,
        pendingCycle: null,
        cancelAtPeriodEnd: false,
        remindersSentJson: [],
      })
      .where(eq(subscriptions.id, sub.id));
    if (planRank(plan.code) > planRank(prevPlan.code) || sub.status === "TRIALING")
      await track(planRank(prevPlan.code) === 0 ? "subscription_started" : "plan_upgraded", { tenantId: inv.tenantId, props: { from: prevPlan.code, to: plan.code, cycle } });
    await billingNotice(inv.tenantId, "billing.plan_active", `${plan.name} plan is active`, `Payment received for invoice ${inv.number}. Your ${plan.name} plan is active until ${cycleEnd(now, cycle).toDateString()}.`);
  } else if (inv.kind === "renewal") {
    const start = ["SUSPENDED", "READ_ONLY"].includes(sub.status) ? now : (inv.periodStart ?? sub.currentPeriodEnd);
    const plan = await planById(inv.planId ?? sub.planId);
    await db()
      .update(subscriptions)
      .set({
        planId: plan.id,
        status: "ACTIVE",
        currentPeriodStart: start,
        currentPeriodEnd: plan.code === "free" ? monthPeriod(addDays(start, 1)).endAt : cycleEnd(start, inv.billingCycle ?? sub.billingCycle),
        pastDueSince: null,
        retryCount: 0,
        nextRetryAt: null,
        remindersSentJson: [],
      })
      .where(eq(subscriptions.id, sub.id));
    await track("subscription_renewed", { tenantId: inv.tenantId, props: { invoice: inv.number } });
    await billingNotice(inv.tenantId, "billing.renewed", "Subscription renewed", `Invoice ${inv.number} is paid. Thank you!`);
  } else if (["PAST_DUE", "GRACE_PERIOD", "READ_ONLY", "SUSPENDED"].includes(sub.status)) {
    await db().update(subscriptions).set({ status: "ACTIVE", pastDueSince: null, retryCount: 0, nextRetryAt: null }).where(eq(subscriptions.id, sub.id));
  }
  invalidateEntitlements(inv.tenantId);
  await audit({ tenantId: inv.tenantId, actorType: "system", action: "invoice.paid", resourceType: "invoice", resourceId: inv.id, metadata: { number: inv.number, total: inv.total } });
}

async function setSub(id: number, patch: Partial<typeof subscriptions.$inferInsert>) {
  await db().update(subscriptions).set(patch).where(eq(subscriptions.id, id));
  const [s] = await db().select().from(subscriptions).where(eq(subscriptions.id, id)).limit(1);
  return s;
}

async function markPastDue(sub: Subscription, invoiceNo: string) {
  const s = await setSub(sub.id, { status: "PAST_DUE", pastDueSince: new Date(), retryCount: 0, nextRetryAt: addDays(new Date(), RETRY_DAYS[0]) });
  await track("subscription_failed", { tenantId: sub.tenantId, props: { invoice: invoiceNo } });
  await billingNotice(
    sub.tenantId,
    "billing.payment_failed",
    "Payment failed — grace period started",
    `We couldn't collect payment for invoice ${invoiceNo}. Your store stays live during a ${GRACE_DAYS}-day grace period. Pay now to avoid read-only mode.`,
    `pastdue:${sub.id}:${invoiceNo}`
  );
  return s;
}

/** Applies due lifecycle transitions: TRIALING → ACTIVE → PAST_DUE → GRACE_PERIOD → READ_ONLY → SUSPENDED → CANCELLED. */
export async function advanceLifecycle(input: Subscription): Promise<Subscription> {
  let sub = input;
  for (let i = 0; i < 8; i++) {
    const now = new Date();
    const plan = await planById(sub.planId);
    let next: Subscription | null = null;
    if (sub.status === "TRIALING" && sub.trialEnd && sub.trialEnd <= now) {
      const free = await planByCode("free");
      next = await setSub(sub.id, { status: "ACTIVE", planId: free.id, currentPeriodStart: now, currentPeriodEnd: monthPeriod(now).endAt, remindersSentJson: [] });
      await billingNotice(
        sub.tenantId,
        "billing.trial_ended",
        "Trial ended — you're on the Free plan",
        plan.code === "free" ? "Your 7-day trial of paid features has ended. Your store continues on Free." : `Your ${plan.name} trial ended without payment, so your store moved to the Free plan. Your data is safe — upgrade anytime.`,
        `trialend:${sub.id}`
      );
    } else if (sub.status === "ACTIVE" && sub.currentPeriodEnd <= now) {
      if (sub.cancelAtPeriodEnd) {
        await setSub(sub.id, { status: "CANCELLED", isCurrent: false, cancelledAt: now });
        next = await startSubscription(sub.tenantId, "free", "monthly", { trial: false });
        await billingNotice(sub.tenantId, "billing.cancelled", "Subscription cancelled", "Your paid plan ended and your store moved to Free. Nothing was deleted.");
      } else {
        const targetPlan = sub.pendingPlanId ? await planById(sub.pendingPlanId) : plan;
        const cycle = sub.pendingCycle ?? sub.billingCycle;
        const periodStart = sub.currentPeriodEnd;
        const periodEnd = targetPlan.code === "free" ? monthPeriod(addDays(periodStart, 1)).endAt : cycleEnd(periodStart, cycle);
        const existing = await db()
          .select()
          .from(invoices)
          .where(and(eq(invoices.subscriptionId, sub.id), eq(invoices.kind, targetPlan.code === "free" ? "usage" : "renewal"), eq(invoices.periodStart, periodStart)))
          .limit(1);
        const inv =
          existing[0] ??
          (await createInvoice(sub.tenantId, sub, {
            kind: targetPlan.code === "free" ? "usage" : "renewal",
            plan: targetPlan,
            cycle,
            periodStart,
            periodEnd,
            includeFees: true,
            dueAt: targetPlan.code === "free" ? addDays(now, GRACE_DAYS) : now,
          }));
        if (!inv || inv.status === "paid" || targetPlan.code === "free") {
          next = await setSub(sub.id, {
            planId: targetPlan.id,
            billingCycle: cycle,
            pendingPlanId: null,
            pendingCycle: null,
            currentPeriodStart: periodStart,
            currentPeriodEnd: periodEnd,
            remindersSentJson: [],
          });
          if (sub.pendingPlanId) await billingNotice(sub.tenantId, "billing.plan_changed", `Now on ${targetPlan.name}`, `Your scheduled change to the ${targetPlan.name} plan is now active.`);
        } else if (await chargeSavedMethod(sub, inv)) {
          await setSub(sub.id, { pendingPlanId: null, pendingCycle: null, planId: targetPlan.id, billingCycle: cycle });
          await onInvoicePaid(inv.id);
          next = (await currentSub(sub.tenantId))!;
        } else {
          await setSub(sub.id, { pendingPlanId: null, pendingCycle: null, planId: targetPlan.id, billingCycle: cycle });
          next = await markPastDue(sub, inv.number);
        }
      }
    } else if (sub.status === "ACTIVE" && plan.code === "free") {
      // Free plan usage invoices left unpaid past due date follow the same dunning path.
      const [overdue] = await db()
        .select()
        .from(invoices)
        .where(and(eq(invoices.tenantId, sub.tenantId), eq(invoices.status, "open"), lte(invoices.dueAt, now)))
        .limit(1);
      if (overdue && overdue.kind === "usage") next = await markPastDue(sub, overdue.number);
    } else if (["PAST_DUE", "GRACE_PERIOD"].includes(sub.status) && sub.pastDueSince) {
      const since = sub.pastDueSince.getTime();
      if (sub.nextRetryAt && sub.nextRetryAt <= now && sub.retryCount < RETRY_DAYS.length) {
        const [openInv] = await db()
          .select()
          .from(invoices)
          .where(and(eq(invoices.tenantId, sub.tenantId), eq(invoices.status, "open")))
          .orderBy(asc(invoices.id))
          .limit(1);
        const retry = sub.retryCount + 1;
        if (openInv && (await chargeSavedMethod(sub, openInv))) {
          await onInvoicePaid(openInv.id);
          next = (await currentSub(sub.tenantId))!;
        } else {
          next = await setSub(sub.id, {
            status: "GRACE_PERIOD",
            retryCount: retry,
            nextRetryAt: retry < RETRY_DAYS.length ? new Date(since + RETRY_DAYS[retry] * DAY_MS) : null,
          });
          await billingNotice(sub.tenantId, "billing.retry_failed", `Payment retry ${retry} failed`, `Grace period ends ${addDays(sub.pastDueSince, GRACE_DAYS).toDateString()}. Pay the open invoice to keep full access.`, `retry:${sub.id}:${retry}`);
        }
      } else if (now.getTime() >= since + GRACE_DAYS * DAY_MS) {
        next = await setSub(sub.id, { status: "READ_ONLY", nextRetryAt: null });
        await billingNotice(sub.tenantId, "billing.read_only", "Account is now read-only", "Editing is paused but your storefront stays visible and data export and renewal remain available.", `readonly:${sub.id}:${since}`);
      } else if (sub.status === "PAST_DUE" && now.getTime() >= since + DAY_MS) {
        next = await setSub(sub.id, { status: "GRACE_PERIOD" });
      }
    } else if (sub.status === "READ_ONLY" && sub.pastDueSince && now.getTime() >= sub.pastDueSince.getTime() + (GRACE_DAYS + READ_ONLY_DAYS) * DAY_MS) {
      next = await setSub(sub.id, { status: "SUSPENDED" });
      await billingNotice(sub.tenantId, "billing.suspended", "Subscription suspended", "Your storefront now shows a maintenance page. Your data is retained and export is available. Pay the open invoice to restore.", `suspended:${sub.id}`);
    }
    if (!next) break;
    sub = next;
    invalidateEntitlements(sub.tenantId);
  }
  await sendReminders(sub);
  return sub;
}

async function sendReminders(sub: Subscription) {
  const now = new Date();
  const target = sub.status === "TRIALING" ? sub.trialEnd : sub.status === "ACTIVE" ? sub.currentPeriodEnd : null;
  if (!target) return;
  const plan = await planById(sub.planId);
  if (sub.status === "ACTIVE" && plan.code === "free") return;
  const daysLeft = Math.ceil((target.getTime() - now.getTime()) / DAY_MS);
  const sent = sub.remindersSentJson ?? [];
  for (const d of REMINDER_DAYS) {
    const key = `${target.toISOString().slice(0, 10)}:${d}`;
    if (daysLeft <= d && daysLeft > 0 && !sent.includes(key)) {
      // Only the closest reminder is sent; earlier ones are marked to avoid bursts after downtime.
      const keys = REMINDER_DAYS.filter(x => x >= d).map(x => `${target.toISOString().slice(0, 10)}:${x}`);
      await db()
        .update(subscriptions)
        .set({ remindersSentJson: Array.from(new Set([...sent, ...keys])) })
        .where(eq(subscriptions.id, sub.id));
      await billingNotice(
        sub.tenantId,
        "billing.renewal_reminder",
        sub.status === "TRIALING" ? `Trial ends in ${daysLeft} day(s)` : `Renewal in ${daysLeft} day(s)`,
        sub.status === "TRIALING"
          ? "Choose a paid plan to keep premium features after your trial."
          : `Your ${plan.name} plan renews on ${target.toDateString()}${sub.savedMethodJson ? ` using ${sub.savedMethodJson.label}` : ". Add a payment method or pay the invoice when it's issued"}.`,
        `reminder:${sub.id}:${key}`
      );
      break;
    }
  }
}

every("billing-lifecycle", 5 * 60_000, async () => {
  const soon = addDays(new Date(), 8);
  const due = await db()
    .select()
    .from(subscriptions)
    .where(
      and(
        eq(subscriptions.isCurrent, true),
        or(
          lte(subscriptions.trialEnd, soon),
          lte(subscriptions.currentPeriodEnd, soon),
          lte(subscriptions.nextRetryAt, new Date()),
          inArray(subscriptions.status, ["PAST_DUE", "GRACE_PERIOD", "READ_ONLY"])
        )
      )
    )
    .limit(500);
  for (const s of due) await advanceLifecycle(s);
  const free = await planByCode("free").catch(() => null);
  if (free) {
    const frees = await db()
      .select()
      .from(subscriptions)
      .where(and(eq(subscriptions.isCurrent, true), eq(subscriptions.planId, free.id), eq(subscriptions.status, "ACTIVE")))
      .limit(1000);
    for (const s of frees) await advanceLifecycle(s);
  }
});

/* ───────── Plan changes ───────── */
export async function changePlan(tenantId: number, planCode: PlanCode, cycle: "monthly" | "yearly", actorId: number) {
  const ent = await getEntitlements(tenantId, { fresh: true });
  const sub = (await currentSub(tenantId))!;
  const target = await planByCode(planCode);
  const current = await planById(sub.planId);
  if (cycle === "yearly" && !target.limitsJson.yearlyBilling) fail("VALIDATION", `${target.name} is billed monthly only`);
  const isUpgrade = planRank(target.code) > planRank(current.code) || sub.status === "TRIALING" || (target.id === current.id && cycle !== sub.billingCycle);
  if (target.code === "free") {
    if (current.code === "free") fail("INVALID_STATE", "You're already on the Free plan");
    if (sub.status === "TRIALING") {
      await setSub(sub.id, { planId: target.id });
      invalidateEntitlements(tenantId);
      return { action: "scheduled" as const, effectiveAt: sub.trialEnd };
    }
    await setSub(sub.id, { pendingPlanId: target.id, pendingCycle: "monthly" });
    invalidateEntitlements(tenantId);
    await audit({ tenantId, actorId, actorType: "merchant", action: "subscription.downgrade_scheduled", metadata: { to: "free" } });
    return { action: "scheduled" as const, effectiveAt: sub.currentPeriodEnd };
  }
  if (target.id === current.id && cycle === sub.billingCycle && sub.status !== "TRIALING") fail("INVALID_STATE", `You're already on ${target.name}`);
  if (isUpgrade) {
    const [existing] = await db()
      .select()
      .from(invoices)
      .where(and(eq(invoices.tenantId, tenantId), eq(invoices.status, "open"), eq(invoices.kind, "upgrade"), eq(invoices.planId, target.id)))
      .limit(1);
    const inv = existing ?? (await createInvoice(tenantId, sub, { kind: "upgrade", plan: target, cycle, periodStart: new Date(), periodEnd: cycleEnd(new Date(), cycle), includeFees: false }));
    await audit({ tenantId, actorId, actorType: "merchant", action: "subscription.upgrade_invoice", metadata: { to: target.code, cycle, invoice: inv?.number } });
    return { action: "pay" as const, invoiceId: inv!.id };
  }
  await setSub(sub.id, { pendingPlanId: target.id, pendingCycle: cycle });
  invalidateEntitlements(tenantId);
  await audit({ tenantId, actorId, actorType: "merchant", action: "subscription.downgrade_scheduled", metadata: { to: target.code } });
  void ent;
  return { action: "scheduled" as const, effectiveAt: sub.currentPeriodEnd };
}

export async function setCancelAtPeriodEnd(tenantId: number, cancel: boolean) {
  const sub = (await currentSub(tenantId))!;
  await setSub(sub.id, { cancelAtPeriodEnd: cancel, pendingPlanId: cancel ? null : sub.pendingPlanId });
  invalidateEntitlements(tenantId);
}
export async function setAutoRenew(tenantId: number, autoRenew: boolean) {
  const sub = (await currentSub(tenantId))!;
  await setSub(sub.id, { autoRenew });
  invalidateEntitlements(tenantId);
}
export async function saveMethod(tenantId: number, method: { provider: string; label: string; token: string } | null) {
  const sub = (await currentSub(tenantId))!;
  await setSub(sub.id, { savedMethodJson: method });
}

export async function billingOverview(tenantId: number, storeId: number) {
  const ent = await getEntitlements(tenantId, { fresh: true });
  const sub = (await currentSub(tenantId))!;
  const allPlans = await getPlans();
  const p = monthPeriod();
  const [feeSum] = await db()
    .select({ total: sql<string>`coalesce(sum(${feeLedger.feeAmount}),0)` })
    .from(feeLedger)
    .where(and(eq(feeLedger.tenantId, tenantId), eq(feeLedger.periodStart, p.start), ne(feeLedger.status, "void")));
  const invs = await db().select().from(invoices).where(eq(invoices.tenantId, tenantId)).orderBy(desc(invoices.id)).limit(50);
  const fees = await db().select().from(feeLedger).where(eq(feeLedger.tenantId, tenantId)).orderBy(desc(feeLedger.id)).limit(100);
  const [store] = await db().select({ id: stores.id }).from(stores).where(eq(stores.id, storeId)).limit(1);
  return {
    entitlements: ent,
    subscription: { ...sub, savedMethodJson: sub.savedMethodJson ? { provider: sub.savedMethodJson.provider, label: sub.savedMethodJson.label } : null },
    plans: allPlans.filter(x => x.status === "active"),
    usage: {
      products: { used: store ? await productCount(storeId) : 0, limit: ent.limits.products },
      orders: { used: await usageFor(tenantId, "orders"), included: ent.limits.monthlyOrdersIncluded, overageRatePercent: ent.limits.overageRatePercent },
      storage: { usedBytes: await storageUsedBytes(tenantId), limitMB: ent.limits.storageMB },
      feesThisMonth: feeSum?.total ?? "0.00",
      period: p,
    },
    invoices: invs,
    fees,
  };
}

export async function invoiceDetail(tenantId: number | null, invoiceId: number) {
  const [inv] = await db()
    .select()
    .from(invoices)
    .where(tenantId === null ? eq(invoices.id, invoiceId) : and(eq(invoices.id, invoiceId), eq(invoices.tenantId, tenantId)))
    .limit(1);
  if (!inv) fail("NOT_FOUND", "Invoice not found");
  const lines = await db().select().from(invoiceLines).where(eq(invoiceLines.invoiceId, inv.id));
  const [tenant] = await db().select().from(tenants).where(eq(tenants.id, inv.tenantId)).limit(1);
  return { invoice: inv, lines, tenant };
}

/** Super Admin testing helpers to move a subscription through its lifecycle. */
export async function adminSubscriptionAction(subId: number, action: "expire_trial" | "end_period" | "advance_days" | "fail_next_renewal" | "run_lifecycle", days = 1) {
  const [sub] = await db().select().from(subscriptions).where(eq(subscriptions.id, subId)).limit(1);
  if (!sub) fail("NOT_FOUND", "Subscription not found");
  const past = new Date(Date.now() - 1000);
  if (action === "expire_trial") await setSub(sub.id, { trialEnd: past, currentPeriodEnd: past });
  if (action === "end_period") await setSub(sub.id, { currentPeriodEnd: past });
  if (action === "fail_next_renewal")
    await db()
      .insert(platformSettings)
      .values({ key: `billing.failNextRenewal.${sub.tenantId}`, valueJson: true })
      .onDuplicateKeyUpdate({ set: { valueJson: true } });
  if (action === "advance_days") {
    const shift = (d: Date | null) => (d ? new Date(d.getTime() - days * DAY_MS) : null);
    await setSub(sub.id, {
      trialEnd: shift(sub.trialEnd),
      currentPeriodStart: shift(sub.currentPeriodStart)!,
      currentPeriodEnd: shift(sub.currentPeriodEnd)!,
      pastDueSince: shift(sub.pastDueSince),
      nextRetryAt: shift(sub.nextRetryAt),
    });
    await db()
      .update(invoices)
      .set({ dueAt: sql`DATE_SUB(${invoices.dueAt}, INTERVAL ${days} DAY)` })
      .where(and(eq(invoices.tenantId, sub.tenantId), eq(invoices.status, "open")));
  }
  invalidateEntitlements(sub.tenantId);
  const [fresh] = await db().select().from(subscriptions).where(eq(subscriptions.id, subId)).limit(1);
  if (action !== "fail_next_renewal") await advanceLifecycle(fresh);
  return getEntitlements(sub.tenantId, { fresh: true });
}
