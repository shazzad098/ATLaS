import { prisma } from "@/lib/db";
import { AppError, ForbiddenError, NotFoundError } from "@/lib/errors";
import { addDays, buildInvoiceNumber, daysRemaining, formatDate, nextPeriodEnd } from "@/lib/dates";
import { addMoney, formatBdt, fromPaisa, toDecimalString, toPaisa } from "@/lib/money";
import { PLAN_CODES, planMatrixFor, type PlanCode } from "@/lib/plans";
import { invalidateEntitlements, loadEntitlementSnapshot, overageCount } from "@/lib/entitlements";
import { notify, NOTIFICATION_TYPES } from "@/lib/notifications";
import { recordAudit } from "@/lib/audit";
import { attachPendingFeesToInvoice, feeSummary } from "@/lib/services/fee-service";
import type { ActorContext } from "@/lib/rbac";

type BillingPeriodValue = "MONTHLY" | "YEARLY";

function periodMonths(period: BillingPeriodValue): number {
  return period === "YEARLY" ? 12 : 1;
}

function priceForPeriod(
  plan: { price: unknown; yearlyPrice: unknown },
  period: BillingPeriodValue,
): number {
  const monthly = Number(plan.price ?? 0);
  return period === "YEARLY" ? Number(plan.yearlyPrice ?? monthly * 12) : monthly;
}

/**
 * Subscription + billing lifecycle (PRD §5.2).
 *
 * TRIALING → ACTIVE → PAST_DUE → GRACE_PERIOD → READ_ONLY → SUSPENDED → CANCELLED
 *
 * Downgrades never delete data: quota-exceeding records stay readable, only new
 * creates are blocked. Every state change invalidates the entitlement cache
 * immediately, which is what makes enforcement feel instant (PRD §5.3).
 */

export const GRACE_DAYS = 7;
export const READ_ONLY_DAYS_AFTER_GRACE = 7;
/** Failed-payment retry schedule (PRD Appendix B). */
export const RETRY_DAYS = [1, 3, 5];

/**
 * Plan configuration (PRD §4.5 "Plan and entitlement configuration").
 *
 * Only the fields the entitlement engine reads are editable here: price,
 * trial length and the hard limits. Everything is merged into the existing
 * JSON so unedited keys keep their values, and every subscribed tenant's cached
 * snapshot is dropped so the change applies on their next request.
 */
export const PLAN_EDITABLE_LIMITS = [
  "products",
  "monthlyOrders",
  "overageRate",
  "storageMb",
  "staffSeats",
] as const;

export async function adminUpdatePlan(
  actorId: string,
  code: PlanCode,
  patch: {
    /** `null` keeps the plan quote-only (stored as 0, PRD §5.1). */
    price?: number | null;
    yearlyPrice?: number | null;
    trialDays?: number;
    limits?: Record<string, number | null>;
  },
): Promise<void> {
  const plan = await prisma.plan.findUnique({ where: { code } });
  if (!plan) throw new NotFoundError(`Plan ${code}`);

  const limits = (plan.limitsJson ?? {}) as Record<string, unknown>;
  for (const key of PLAN_EDITABLE_LIMITS) {
    const value = patch.limits?.[key];
    if (value === undefined) continue;
    limits[key] = value;
  }

  await prisma.plan.update({
    where: { id: plan.id },
    data: {
      ...(patch.price !== undefined
        ? { price: toDecimalString(patch.price ?? 0) as never }
        : {}),
      ...(patch.yearlyPrice !== undefined
        ? { yearlyPrice: patch.yearlyPrice === null ? null : (toDecimalString(patch.yearlyPrice) as never) }
        : {}),
      ...(patch.trialDays !== undefined ? { trialDays: patch.trialDays } : {}),
      limitsJson: limits as never,
    },
  });

  const subscribers = await prisma.subscription.findMany({
    where: { planId: plan.id },
    select: { tenantId: true },
  });
  for (const subscriber of subscribers) invalidateEntitlements(subscriber.tenantId);

  await recordAudit({
    action: "platform.plan_updated",
    actorId,
    resourceType: "Plan",
    resourceId: plan.id,
    metadata: { code, ...patch },
  });
}

export async function listPlans() {
  const plans = await prisma.plan.findMany({
    where: { status: "ACTIVE" },
    orderBy: { sortOrder: "asc" },
  });
  return plans;
}

/** Public pricing data, merging DB rows over the shipped defaults. */
export async function pricingMatrix() {
  const rows = await listPlans();
  const byCode = new Map(rows.map((row) => [row.code, row]));
  return PLAN_CODES.map((code) => {
    const definition = planMatrixFor(code);
    const row = byCode.get(code);
    return {
      code,
      name: row?.name ?? definition.name,
      description: row?.description ?? definition.description,
      // A stored price wins so Super Admin edits apply immediately; a plan left
      // at 0 keeps its shipped meaning (0 for Free, `null` = quote-only for the
      // paid tiers), which is how PRD §5.1 treats business-approved prices.
      monthlyPriceBdt:
        row && Number(row.price) > 0 ? Number(row.price) : definition.monthlyPriceBdt,
      yearlyPriceBdt:
        row?.yearlyPrice != null && Number(row.yearlyPrice) > 0
          ? Number(row.yearlyPrice)
          : definition.yearlyPriceBdt,
      trialDays: row?.trialDays ?? definition.trialDays,
      limits: { ...definition.$limits, ...((row?.limitsJson ?? {}) as object) },
      features: { ...definition.$features, ...((row?.featuresJson ?? {}) as object) },
    };
  });
}

/** Every tenant has a subscription; this guarantees the Free fallback exists. */
export async function ensureSubscription(tenantId: string) {
  const existing = await prisma.subscription.findUnique({
    where: { tenantId },
    include: { plan: true },
  });
  if (existing) return existing;

  const freePlan = await prisma.plan.findUnique({ where: { code: "free" } });
  if (!freePlan) throw new NotFoundError("Free plan (run `npm run db:seed`)");

  const created = await prisma.subscription.create({
    data: {
      tenantId,
      planId: freePlan.id,
      status: "ACTIVE",
      billingPeriod: "MONTHLY",
      currentPeriodStart: new Date(),
      currentPeriodEnd: nextPeriodEnd(new Date()),
    },
    include: { plan: true },
  });
  invalidateEntitlements(tenantId);
  return created;
}

export async function getSubscriptionDetail(tenantId: string) {
  await ensureSubscription(tenantId);
  const subscription = await prisma.subscription.findUniqueOrThrow({
    where: { tenantId },
    include: { plan: true },
  });
  const snapshot = await loadEntitlementSnapshot(tenantId, { force: true });
  const fees = await feeSummary(tenantId);

  return {
    subscription,
    snapshot,
    fees,
    overage: overageCount(snapshot),
    trialDaysRemaining: daysRemaining(subscription.trialEnd),
    periodDaysRemaining: daysRemaining(subscription.currentPeriodEnd),
  };
}

/**
 * Starts the one-time trial of a paid plan (PRD §5.1 "Free trial").
 *
 * A trial is a commercial concession, so it is recorded permanently: once
 * `trialUsedAt` is set, the tenant cannot start another trial even after
 * cancelling, downgrading or re-subscribing.
 */
export async function startTrial(
  actor: ActorContext,
  planCode: PlanCode,
  billingPeriod: BillingPeriodValue = "MONTHLY",
) {
  if (planCode === "free") {
    throw new AppError("VALIDATION_FAILED", "Free plan-এ trial নেই।", 422);
  }
  const plan = await prisma.plan.findUnique({ where: { code: planCode } });
  if (!plan) throw new NotFoundError("Plan");

  const current = await ensureSubscription(actor.tenantId);
  if (current.trialUsedAt) {
    throw new AppError(
      "TRIAL_ALREADY_USED",
      "এই workspace-এ একবারই trial নেওয়া যায়। প্ল্যান চালু করতে পেমেন্ট করুন।",
      409,
    );
  }
  if (current.plan.code !== "free" && current.status === "ACTIVE") {
    throw new AppError(
      "TRIAL_NOT_AVAILABLE",
      "বর্তমানে paid plan সক্রিয় আছে; trial শুধু Free plan থেকে শুরু করা যায়।",
      409,
    );
  }

  const start = new Date();
  const trialEnd = addDays(start, plan.trialDays || 7);

  const subscription = await prisma.subscription.update({
    where: { tenantId: actor.tenantId },
    data: {
      planId: plan.id,
      status: "TRIALING",
      billingPeriod,
      trialEnd,
      trialUsedAt: start,
      currentPeriodStart: start,
      currentPeriodEnd: trialEnd,
      graceEndsAt: null,
      lastPaymentFailedAt: null,
      cancelAtPeriodEnd: false,
      cancelledAt: null,
      pendingPlanCode: null,
      pendingBillingPeriod: null,
      pendingInvoiceId: null,
    },
  });

  invalidateEntitlements(actor.tenantId);
  await recordAudit({
    action: "subscription.trial_started",
    tenantId: actor.tenantId,
    actorId: actor.userId,
    resourceType: "Subscription",
    resourceId: subscription.id,
    metadata: { planCode, billingPeriod, trialEnd: trialEnd.toISOString() },
  });

  return subscription;
}

/** Restores a tenant/store after a successful payment or a Free downgrade. */
async function restoreTenantAccess(tenantId: string): Promise<void> {
  await prisma.tenant.updateMany({ where: { id: tenantId }, data: { status: "ACTIVE" } });
  await prisma.store.updateMany({
    where: { tenantId, status: "SUSPENDED", publishedAt: { not: null } },
    data: { status: "PUBLISHED" },
  });
  await prisma.store.updateMany({
    where: { tenantId, status: "SUSPENDED", publishedAt: null },
    data: { status: "DRAFT" },
  });
}

async function createPlanInvoice(input: {
  tenantId: string;
  subscriptionId: string;
  plan: { name: string; price: unknown; yearlyPrice: unknown };
  billingPeriod: BillingPeriodValue;
  note: string;
}) {
  const amount = priceForPeriod(input.plan, input.billingPeriod);
  const lines: InvoiceLine[] = [
    {
      label: `${input.plan.name} plan (${input.billingPeriod.toLowerCase()}) — ${input.note}`,
      amount: fromPaisa(toPaisa(amount)),
    },
  ];

  return prisma.invoice.create({
    data: {
      tenantId: input.tenantId,
      subscriptionId: input.subscriptionId,
      number: await nextInvoiceNumber(),
      currency: "BDT",
      status: "OPEN",
      dueAt: addDays(new Date(), 7),
      subtotal: fromPaisa(toPaisa(amount)) as never,
      total: fromPaisa(toPaisa(amount)) as never,
      linesJson: lines as never,
    },
  });
}

/**
 * Records a plan change request. Paid plans are activated only after the
 * generated invoice is settled by a Super Admin (or a verified system payment),
 * so a merchant cannot grant themselves paid entitlements by clicking a button.
 */
export async function changePlan(
  actor: ActorContext,
  planCode: PlanCode,
  billingPeriod: BillingPeriodValue = "MONTHLY",
) {
  const plan = await prisma.plan.findUnique({ where: { code: planCode } });
  if (!plan) throw new NotFoundError("Plan");

  const current = await ensureSubscription(actor.tenantId);

  if (planCode === "free") {
    const start = new Date();
    const subscription = await prisma.subscription.update({
      where: { tenantId: actor.tenantId },
      data: {
        planId: plan.id,
        status: "ACTIVE",
        billingPeriod,
        currentPeriodStart: start,
        currentPeriodEnd: nextPeriodEnd(start, periodMonths(billingPeriod)),
        trialEnd: null,
        graceEndsAt: null,
        cancelAtPeriodEnd: false,
        cancelledAt: null,
        lastPaymentFailedAt: null,
        pendingPlanCode: null,
        pendingBillingPeriod: null,
        pendingInvoiceId: null,
      },
    });
    await restoreTenantAccess(actor.tenantId);
    invalidateEntitlements(actor.tenantId);
    await recordAudit({
      action: "subscription.plan_changed",
      tenantId: actor.tenantId,
      actorId: actor.userId,
      resourceType: "Subscription",
      resourceId: subscription.id,
      metadata: { from: current.plan.code, to: planCode, billingPeriod, immediate: true },
    });
    return { subscription, invoice: null, pending: false as const };
  }

  if (current.plan.code === planCode && current.billingPeriod === billingPeriod) {
    return { subscription: current, invoice: null, pending: false as const };
  }

  const existingPending =
    current.pendingInvoiceId
      ? await prisma.invoice.findFirst({
          where: { id: current.pendingInvoiceId, tenantId: actor.tenantId, status: "OPEN" },
        })
      : null;

  if (
    existingPending &&
    current.pendingPlanCode === planCode &&
    current.pendingBillingPeriod === billingPeriod
  ) {
    return { subscription: current, invoice: existingPending, pending: true as const };
  }

  if (existingPending) {
    await prisma.invoice.update({
      where: { id: existingPending.id },
      data: { status: "VOID" },
    });
  }

  const invoice = await createPlanInvoice({
    tenantId: actor.tenantId,
    subscriptionId: current.id,
    plan,
    billingPeriod,
    note: "activation pending payment",
  });

  const subscription = await prisma.subscription.update({
    where: { tenantId: actor.tenantId },
    data: {
      pendingPlanCode: planCode,
      pendingBillingPeriod: billingPeriod,
      pendingInvoiceId: invoice.id,
    },
  });

  invalidateEntitlements(actor.tenantId);
  await recordAudit({
    action: "subscription.plan_change_requested",
    tenantId: actor.tenantId,
    actorId: actor.userId,
    resourceType: "Invoice",
    resourceId: invoice.id,
    metadata: {
      from: current.plan.code,
      to: planCode,
      billingPeriod,
      invoiceNumber: invoice.number,
      downgrade:
        PLAN_CODES.indexOf(planCode) <
        PLAN_CODES.indexOf((current.plan.code ?? "free") as PlanCode),
    },
  });

  return { subscription, invoice, pending: true as const };
}

export async function cancelSubscription(
  actor: ActorContext,
  options: { atPeriodEnd?: boolean } = {},
) {
  const subscription = await prisma.subscription.findUnique({ where: { tenantId: actor.tenantId } });
  if (!subscription) throw new NotFoundError("Subscription");

  const updated = await prisma.subscription.update({
    where: { tenantId: actor.tenantId },
    data: options.atPeriodEnd
      ? { cancelAtPeriodEnd: true }
      : { status: "CANCELLED", cancelledAt: new Date(), cancelAtPeriodEnd: false },
  });

  invalidateEntitlements(actor.tenantId);
  await recordAudit({
    action: "subscription.cancelled",
    tenantId: actor.tenantId,
    actorId: actor.userId,
    resourceType: "Subscription",
    resourceId: subscription.id,
    metadata: { atPeriodEnd: Boolean(options.atPeriodEnd) },
  });
  return updated;
}

// ── Invoices ────────────────────────────────────────────────────────────────

async function nextInvoiceNumber(): Promise<string> {
  const count = await prisma.invoice.count();
  return buildInvoiceNumber(count + 1);
}

export type InvoiceLine = { label: string; quantity?: number; amount: string };

/**
 * Builds (or reuses) the invoice for a period: the plan fee plus every PENDING
 * platform/courier fee row. Fee rows are stamped with the invoice id so the
 * merchant can trace each charge back to an order (PRD US-03).
 */
export async function generateInvoice(
  tenantId: string,
  options: { periodStart?: Date; periodEnd?: Date; attachFees?: boolean } = {},
) {
  const subscription = await ensureSubscription(tenantId);
  const periodStart = options.periodStart ?? subscription.currentPeriodStart;
  const periodEnd =
    options.periodEnd ?? subscription.currentPeriodEnd ?? nextPeriodEnd(periodStart);

  if (subscription.plan.code === "free") {
    throw new AppError("VALIDATION_FAILED", "Free plan-এর invoice তৈরি হয় না।", 422);
  }

  const planAmount = priceForPeriod(subscription.plan, subscription.billingPeriod);

  const lines: InvoiceLine[] = [
    {
      label: `${subscription.plan.name} plan (${subscription.billingPeriod.toLowerCase()})`,
      amount: fromPaisa(toPaisa(planAmount)),
    },
  ];

  const invoice = await prisma.$transaction(async (tx) => {
    const created = await tx.invoice.create({
      data: {
        tenantId,
        subscriptionId: subscription.id,
        number: await nextInvoiceNumber(),
        currency: "BDT",
        status: "OPEN",
        dueAt: addDays(new Date(), 7),
        subtotal: fromPaisa(toPaisa(planAmount)) as never,
        total: fromPaisa(toPaisa(planAmount)) as never,
        linesJson: lines as never,
      },
    });

    if (options.attachFees !== false) {
      const attached = await attachPendingFeesToInvoice(
        tx,
        tenantId,
        created.id,
        periodStart,
        periodEnd,
      );
      if (attached.count > 0) {
        lines.push({
          label: `Platform & courier fees (${attached.count} orders)`,
          amount: attached.total,
        });
        const total = addMoney(planAmount, attached.total);
        await tx.invoice.update({
          where: { id: created.id },
          data: {
            subtotal: total as never,
            total: total as never,
            linesJson: lines as never,
          },
        });
      }
    }

    return created;
  });

  return prisma.invoice.findUniqueOrThrow({ where: { id: invoice.id } });
}

async function settleInvoice(invoiceId: string, meta: { actorId?: string; reason: string }) {
  const invoice = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    include: { subscription: { include: { plan: true } } },
  });
  if (!invoice) throw new NotFoundError("Invoice");
  if (invoice.status === "PAID") return invoice;
  if (invoice.status !== "OPEN") {
    throw new AppError("INVOICE_NOT_PAYABLE", "এই invoice আর পরিশোধযোগ্য নয়।", 409);
  }

  const subscription =
    invoice.subscription ?? (await ensureSubscription(invoice.tenantId));

  const pendingPlanCode = subscription.pendingPlanCode;
  const pendingPlan = pendingPlanCode
    ? await prisma.plan.findUnique({ where: { code: pendingPlanCode } })
    : null;
  const activePlanId = pendingPlan?.id ?? subscription.planId;
  const billingPeriod = subscription.pendingBillingPeriod ?? subscription.billingPeriod;
  const now = new Date();

  const paid = await prisma.invoice.update({
    where: { id: invoiceId },
    data: { status: "PAID", paidAt: now },
  });

  await prisma.subscription.update({
    where: { tenantId: invoice.tenantId },
    data: {
      planId: activePlanId,
      status: "ACTIVE",
      billingPeriod,
      currentPeriodStart: now,
      currentPeriodEnd: nextPeriodEnd(now, periodMonths(billingPeriod)),
      trialEnd: null,
      graceEndsAt: null,
      lastPaymentFailedAt: null,
      cancelAtPeriodEnd: false,
      cancelledAt: null,
      pendingPlanCode: null,
      pendingBillingPeriod: null,
      pendingInvoiceId: null,
    },
  });

  await restoreTenantAccess(invoice.tenantId);
  invalidateEntitlements(invoice.tenantId);

  await recordAudit({
    action: "invoice.paid",
    tenantId: invoice.tenantId,
    actorId: meta.actorId,
    resourceType: "Invoice",
    resourceId: invoiceId,
    metadata: {
      total: String(invoice.total),
      reason: meta.reason,
      activatedPlan: pendingPlan?.code ?? subscription.plan.code,
      billingPeriod,
    },
  });

  return paid;
}

/**
 * Manual settlement is a platform-operator action. The service checks the
 * operator flag itself (not just the UI) so a merchant action cannot bypass it.
 */
export async function markInvoicePaid(
  actorId: string,
  invoiceId: string,
  reason = "Manual settlement by Super Admin",
) {
  const user = await prisma.user.findUnique({
    where: { id: actorId },
    select: { id: true, isSuperAdmin: true, status: true },
  });
  if (!user || !user.isSuperAdmin || user.status !== "ACTIVE") {
    throw new ForbiddenError("Invoice settlement শুধু Super Admin করতে পারেন।");
  }
  return settleInvoice(invoiceId, { actorId, reason });
}

/** Used by a verified subscription-payment webhook; never exposed to merchants. */
export async function markInvoicePaidBySystem(invoiceId: string, reason: string) {
  return settleInvoice(invoiceId, { reason });
}

export async function listInvoices(tenantId: string, limit = 50) {
  return prisma.invoice.findMany({
    where: { tenantId },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
}

/** Platform-wide invoice queue for Super Admin settlement (PRD §4.5). */
export async function listInvoicesForAdmin(limit = 100) {
  return prisma.invoice.findMany({
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    take: limit,
    include: {
      tenant: { select: { id: true, name: true } },
      subscription: { include: { plan: { select: { code: true, name: true } } } },
    },
  });
}

// ── Lifecycle sweep ────────────────────────────────────────────────────────

export type SweepResult = {
  freeRenewals: number;
  trialDowngrades: number;
  downgrades: number;
  invoicesRaised: number;
  reminders: number;
  enteredGrace: number;
  movedToReadOnly: number;
  suspended: number;
};

/**
 * Daily billing job. Kept as a single function so it can run from the cron
 * route, a worker, or the Super Admin console. Every transition is guarded by
 * the current status + period, so running it twice in a day is harmless.
 */
export async function runBillingSweep(now = new Date()): Promise<SweepResult> {
  const result: SweepResult = {
    freeRenewals: 0,
    trialDowngrades: 0,
    downgrades: 0,
    invoicesRaised: 0,
    reminders: 0,
    enteredGrace: 0,
    movedToReadOnly: 0,
    suspended: 0,
  };

  const freePlan = await prisma.plan.findUnique({ where: { code: "free" } });
  if (!freePlan) throw new AppError("PLAN_MISSING", "Free plan পাওয়া যায়নি।", 500);

  const subscriptions = await prisma.subscription.findMany({
    include: { plan: true, tenant: { select: { ownerUserId: true, name: true } } },
  });

  for (const subscription of subscriptions) {
    const ownerId = subscription.tenant.ownerUserId;

    // 1. Free is the permanent fallback plan: it never gets an invoice, never
    // becomes past due, and is never suspended by billing.
    if (subscription.plan.code === "free") {
      if (subscription.status === "CANCELLED") continue;
      const unhealthy = ["PAST_DUE", "GRACE_PERIOD", "READ_ONLY", "SUSPENDED"].includes(
        subscription.status,
      );
      const periodEnded =
        !subscription.currentPeriodEnd || subscription.currentPeriodEnd <= now;
      if (unhealthy || periodEnded) {
        await prisma.subscription.update({
          where: { id: subscription.id },
          data: {
            status: "ACTIVE",
            billingPeriod: "MONTHLY",
            trialEnd: null,
            graceEndsAt: null,
            lastPaymentFailedAt: null,
            cancelAtPeriodEnd: false,
            currentPeriodStart: now,
            currentPeriodEnd: nextPeriodEnd(now),
            pendingPlanCode: null,
            pendingBillingPeriod: null,
            pendingInvoiceId: null,
          },
        });
        if (unhealthy) await restoreTenantAccess(subscription.tenantId);
        invalidateEntitlements(subscription.tenantId);
        result.freeRenewals += 1;
      }
      continue;
    }

    // 2. Trial finished without conversion → fall back to Free.
    if (subscription.status === "TRIALING" && subscription.trialEnd && subscription.trialEnd <= now) {
      await prisma.subscription.update({
        where: { id: subscription.id },
        data: {
          planId: freePlan.id,
          status: "ACTIVE",
          billingPeriod: "MONTHLY",
          trialEnd: null,
          currentPeriodStart: now,
          currentPeriodEnd: nextPeriodEnd(now),
          graceEndsAt: null,
          lastPaymentFailedAt: null,
          pendingPlanCode: null,
          pendingBillingPeriod: null,
          pendingInvoiceId: null,
        },
      });
      await restoreTenantAccess(subscription.tenantId);
      invalidateEntitlements(subscription.tenantId);
      result.trialDowngrades += 1;
      await notify({
        userId: ownerId,
        type: "subscription.trial_ended",
        title: "Trial শেষ — Free plan-এ ফিরে গেছেন",
        body: "Paid feature ব্যবহার চালু রাখতে plan upgrade করুন।",
      });
      continue;
    }

    // 3. Renewal reminders: 7, 3 and 1 day before the period ends.
    if (
      subscription.currentPeriodEnd &&
      (subscription.status === "ACTIVE" || subscription.status === "TRIALING")
    ) {
      const remaining = daysRemaining(subscription.currentPeriodEnd);
      if (remaining !== null && [7, 3, 1].includes(remaining)) {
        await notify({
          userId: ownerId,
          type: NOTIFICATION_TYPES.SUBSCRIPTION_REMINDER,
          title: `${remaining} দিনে renewal — ${subscription.plan.name}`,
          body: `${formatDate(subscription.currentPeriodEnd)} তারিখে renewal হবে।`,
        });
        result.reminders += 1;
      }
    }

    // 4. Period ended: cancellation falls back to Free; otherwise raise the
    // invoice and enter the explicit GRACE_PERIOD state.
    if (
      subscription.status === "ACTIVE" &&
      subscription.currentPeriodEnd &&
      subscription.currentPeriodEnd <= now
    ) {
      if (subscription.cancelAtPeriodEnd) {
        await prisma.subscription.update({
          where: { id: subscription.id },
          data: {
            planId: freePlan.id,
            status: "ACTIVE",
            billingPeriod: "MONTHLY",
            trialEnd: null,
            currentPeriodStart: now,
            currentPeriodEnd: nextPeriodEnd(now),
            graceEndsAt: null,
            lastPaymentFailedAt: null,
            cancelAtPeriodEnd: false,
            cancelledAt: now,
            pendingPlanCode: null,
            pendingBillingPeriod: null,
            pendingInvoiceId: null,
          },
        });
        await restoreTenantAccess(subscription.tenantId);
        invalidateEntitlements(subscription.tenantId);
        result.downgrades += 1;
        await notify({
          userId: ownerId,
          type: "subscription.cancelled",
          title: "Subscription শেষ — Free plan চালু হয়েছে",
          body: "আপনার data সংরক্ষিত আছে। আবার upgrade করলে সব ফিরে পাবেন।",
        });
        continue;
      }

      // Atomically claim the renewal before creating the invoice. Two
      // concurrent sweeps then see different results: exactly one updateMany
      // matches and the other skips this period.
      const claimed = await prisma.subscription.updateMany({
        where: {
          id: subscription.id,
          status: "ACTIVE",
          currentPeriodEnd: { lte: now },
          cancelAtPeriodEnd: false,
        },
        data: {
          status: "GRACE_PERIOD",
          lastPaymentFailedAt: now,
          graceEndsAt: addDays(now, GRACE_DAYS),
        },
      });
      if (claimed.count === 0) continue;

      try {
        await generateInvoice(subscription.tenantId, {
          periodStart: subscription.currentPeriodStart,
          periodEnd: subscription.currentPeriodEnd,
        });
      } catch (error) {
        // Do not strand the subscription in GRACE_PERIOD without an invoice;
        // release the claim so the next sweep can retry.
        await prisma.subscription.updateMany({
          where: { id: subscription.id, status: "GRACE_PERIOD" },
          data: {
            status: "ACTIVE",
            lastPaymentFailedAt: subscription.lastPaymentFailedAt,
            graceEndsAt: subscription.graceEndsAt,
          },
        });
        throw error;
      }
      invalidateEntitlements(subscription.tenantId);
      result.invoicesRaised += 1;
      result.enteredGrace += 1;
      await notify({
        userId: ownerId,
        type: NOTIFICATION_TYPES.SUBSCRIPTION_FAILED,
        title: "Renewal payment বাকি",
        body: `${GRACE_DAYS} দিনের grace period চলছে। Invoice পরিশোধ করুন।`,
      });
      continue;
    }

    // 5. Grace period: retry reminders on day 1, 3, 5, then read-only.
    if (subscription.status === "PAST_DUE" || subscription.status === "GRACE_PERIOD") {
      const failedAt = subscription.lastPaymentFailedAt ?? now;
      const graceEndsAt = subscription.graceEndsAt ?? addDays(failedAt, GRACE_DAYS);
      if (subscription.status !== "GRACE_PERIOD" || !subscription.graceEndsAt) {
        await prisma.subscription.update({
          where: { id: subscription.id },
          data: { status: "GRACE_PERIOD", graceEndsAt },
        });
        invalidateEntitlements(subscription.tenantId);
        result.enteredGrace += 1;
      }

      const elapsed = Math.floor((now.getTime() - failedAt.getTime()) / 86_400_000);
      if (RETRY_DAYS.includes(elapsed + 1)) {
        await notify({
          userId: ownerId,
          type: "subscription.payment_retry",
          title: `Payment retry (day ${elapsed + 1})`,
          body: "Invoice পরিশোধ করুন অথবা support-এ যোগাযোগ করুন।",
        });
      }

      if (graceEndsAt <= now) {
        await prisma.subscription.update({
          where: { id: subscription.id },
          data: { status: "READ_ONLY", graceEndsAt: addDays(now, READ_ONLY_DAYS_AFTER_GRACE) },
        });
        invalidateEntitlements(subscription.tenantId);
        result.movedToReadOnly += 1;
        await notify({
          userId: ownerId,
          type: NOTIFICATION_TYPES.SUBSCRIPTION_GRACE,
          title: "Store read-only হয়েছে",
          body: "Data export ও renewal চালু আছে; নতুন অর্ডার বন্ধ।",
        });
      }
      continue;
    }

    // 6. Read-only long enough → suspend tenant and storefront (data retained).
    if (subscription.status === "READ_ONLY" && subscription.graceEndsAt && subscription.graceEndsAt <= now) {
      await prisma.subscription.update({
        where: { id: subscription.id },
        data: { status: "SUSPENDED" },
      });
      await prisma.store.updateMany({
        where: { tenantId: subscription.tenantId },
        data: { status: "SUSPENDED" },
      });
      await prisma.tenant.updateMany({
        where: { id: subscription.tenantId },
        data: { status: "SUSPENDED" },
      });
      invalidateEntitlements(subscription.tenantId);
      result.suspended += 1;
      await notify({
        userId: ownerId,
        type: NOTIFICATION_TYPES.SUBSCRIPTION_SUSPENDED,
        title: "Store suspend করা হয়েছে",
        body: "Renew করলে সাথে সাথে আবার চালু হবে। আপনার data সংরক্ষিত আছে।",
      });
    }
  }

  return result;
}

/** Renewal revenue figures for Super Admin (PRD §4.5 platform metrics). */
export async function platformBillingMetrics() {
  const [byStatus, activePaid, mrrRows] = await Promise.all([
    prisma.subscription.groupBy({ by: ["status"], _count: { _all: true } }),
    prisma.subscription.count({
      where: { status: { in: ["ACTIVE", "TRIALING"] }, plan: { code: { not: "free" } } },
    }),
    prisma.subscription.findMany({
      where: { status: "ACTIVE", plan: { code: { not: "free" } } },
      select: { plan: { select: { price: true, yearlyPrice: true } }, billingPeriod: true },
    }),
  ]);

  const mrr = mrrRows.reduce((acc, row) => {
    const monthly =
      row.billingPeriod === "YEARLY"
        ? Number(row.plan.yearlyPrice ?? Number(row.plan.price) * 12) / 12
        : Number(row.plan.price);
    return acc + toPaisa(monthly);
  }, 0n);

  const feeAgg = await prisma.feeLedger.aggregate({
    where: { reversedAt: null },
    _sum: { feeAmount: true },
  });

  return {
    byStatus: byStatus.map((row) => ({ status: row.status, count: row._count._all })),
    paidStoreCount: activePaid,
    mrr: fromPaisa(mrr),
    arr: fromPaisa(mrr * 12n),
    gmvAndFees: {
      platformFees: fromPaisa(toPaisa(feeAgg._sum.feeAmount ?? 0)),
    },
    formatted: {
      mrr: formatBdt(fromPaisa(mrr)),
      arr: formatBdt(fromPaisa(mrr * 12n)),
    },
  };
}
