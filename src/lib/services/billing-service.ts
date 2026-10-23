import { prisma } from "@/lib/db";
import { AppError, NotFoundError } from "@/lib/errors";
import { addDays, buildInvoiceNumber, daysRemaining, formatDate, nextPeriodEnd } from "@/lib/dates";
import { addMoney, formatBdt, fromPaisa, toDecimalString, toPaisa } from "@/lib/money";
import { PLAN_CODES, planMatrixFor, type PlanCode } from "@/lib/plans";
import { invalidateEntitlements, loadEntitlementSnapshot, overageCount } from "@/lib/entitlements";
import { notify, NOTIFICATION_TYPES } from "@/lib/notifications";
import { recordAudit } from "@/lib/audit";
import { attachPendingFeesToInvoice, feeSummary } from "@/lib/services/fee-service";
import type { ActorContext } from "@/lib/rbac";

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

/** Starts the 7-day trial of a paid plan (PRD §5.1 "Free trial"). */
export async function startTrial(
  actor: ActorContext,
  planCode: PlanCode,
  billingPeriod: "MONTHLY" | "YEARLY" = "MONTHLY",
) {
  if (planCode === "free") {
    throw new AppError("VALIDATION_FAILED", "Free plan-এ trial নেই।", 422);
  }
  const plan = await prisma.plan.findUnique({ where: { code: planCode } });
  if (!plan) throw new NotFoundError("Plan");

  const start = new Date();
  const trialEnd = addDays(start, plan.trialDays || 7);

  const subscription = await prisma.subscription.upsert({
    where: { tenantId: actor.tenantId },
    create: {
      tenantId: actor.tenantId,
      planId: plan.id,
      status: "TRIALING",
      billingPeriod,
      trialEnd,
      currentPeriodStart: start,
      currentPeriodEnd: trialEnd,
      cancelAtPeriodEnd: false,
    },
    update: {
      planId: plan.id,
      status: "TRIALING",
      billingPeriod,
      trialEnd,
      currentPeriodStart: start,
      currentPeriodEnd: trialEnd,
      cancelAtPeriodEnd: false,
      cancelledAt: null,
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

export async function changePlan(
  actor: ActorContext,
  planCode: PlanCode,
  billingPeriod: "MONTHLY" | "YEARLY" = "MONTHLY",
) {
  const plan = await prisma.plan.findUnique({ where: { code: planCode } });
  if (!plan) throw new NotFoundError("Plan");

  const current = await prisma.subscription.findUnique({
    where: { tenantId: actor.tenantId },
    include: { plan: true },
  });

  const start = new Date();
  const subscription = await prisma.subscription.upsert({
    where: { tenantId: actor.tenantId },
    create: {
      tenantId: actor.tenantId,
      planId: plan.id,
      status: "ACTIVE",
      billingPeriod,
      currentPeriodStart: start,
      currentPeriodEnd: nextPeriodEnd(start, billingPeriod === "YEARLY" ? 12 : 1),
    },
    update: {
      planId: plan.id,
      status: "ACTIVE",
      billingPeriod,
      currentPeriodStart: start,
      currentPeriodEnd: nextPeriodEnd(start, billingPeriod === "YEARLY" ? 12 : 1),
      trialEnd: null,
      graceEndsAt: null,
      cancelAtPeriodEnd: false,
      cancelledAt: null,
      lastPaymentFailedAt: null,
    },
  });

  invalidateEntitlements(actor.tenantId);
  await recordAudit({
    action: "subscription.plan_changed",
    tenantId: actor.tenantId,
    actorId: actor.userId,
    resourceType: "Subscription",
    resourceId: subscription.id,
    metadata: {
      from: current?.plan.code ?? null,
      to: planCode,
      billingPeriod,
      downgrade: PLAN_CODES.indexOf(planCode) < PLAN_CODES.indexOf((current?.plan.code ?? "free") as PlanCode),
    },
  });

  return subscription;
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

  const monthly = Number(subscription.plan.price ?? 0);
  const planAmount =
    subscription.billingPeriod === "YEARLY"
      ? Number(subscription.plan.yearlyPrice ?? monthly * 12)
      : monthly;

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

export async function markInvoicePaid(actor: ActorContext, invoiceId: string) {
  const invoice = await prisma.invoice.findFirst({
    where: { id: invoiceId, tenantId: actor.tenantId },
  });
  if (!invoice) throw new NotFoundError("Invoice");

  const paid = await prisma.invoice.update({
    where: { id: invoiceId },
    data: { status: "PAID", paidAt: new Date() },
  });

  const subscription = await prisma.subscription.findUnique({ where: { tenantId: actor.tenantId } });
  if (subscription) {
    await prisma.subscription.update({
      where: { tenantId: actor.tenantId },
      data: {
        status: "ACTIVE",
        currentPeriodStart: new Date(),
        currentPeriodEnd: nextPeriodEnd(
          new Date(),
          subscription.billingPeriod === "YEARLY" ? 12 : 1,
        ),
        graceEndsAt: null,
        lastPaymentFailedAt: null,
      },
    });
  }

  invalidateEntitlements(actor.tenantId);
  await recordAudit({
    action: "invoice.paid",
    tenantId: actor.tenantId,
    actorId: actor.userId,
    resourceType: "Invoice",
    resourceId: invoiceId,
    metadata: { total: String(invoice.total) },
  });
  return paid;
}

export async function listInvoices(tenantId: string, limit = 50) {
  return prisma.invoice.findMany({
    where: { tenantId },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
}

// ── Lifecycle sweep ────────────────────────────────────────────────────────

export type SweepResult = {
  trialDowngrades: number;
  invoicesRaised: number;
  reminders: number;
  movedToReadOnly: number;
  suspended: number;
};

/**
 * Daily billing job. Kept as a single function so it can run from a route
 * handler today and a worker/cron once the platform scales (PRD §8.2 Worker).
 */
export async function runBillingSweep(now = new Date()): Promise<SweepResult> {
  const result: SweepResult = {
    trialDowngrades: 0,
    invoicesRaised: 0,
    reminders: 0,
    movedToReadOnly: 0,
    suspended: 0,
  };

  const freePlan = await prisma.plan.findUnique({ where: { code: "free" } });

  const subscriptions = await prisma.subscription.findMany({
    include: { plan: true, tenant: { select: { ownerUserId: true, name: true } } },
  });

  for (const subscription of subscriptions) {
    const ownerId = subscription.tenant.ownerUserId;

    // 1. Trial finished without conversion → fall back to Free.
    if (subscription.status === "TRIALING" && subscription.trialEnd && subscription.trialEnd <= now) {
      if (freePlan) {
        await prisma.subscription.update({
          where: { id: subscription.id },
          data: {
            planId: freePlan.id,
            status: "ACTIVE",
            trialEnd: null,
            currentPeriodStart: now,
            currentPeriodEnd: nextPeriodEnd(now),
          },
        });
        invalidateEntitlements(subscription.tenantId);
        result.trialDowngrades += 1;
        await notify({
          userId: ownerId,
          type: "subscription.trial_ended",
          title: "Trial শেষ — Free plan-এ ফিরে গেছেন",
          body: "Paid feature ব্যবহার চালু রাখতে plan upgrade করুন।",
        });
      }
      continue;
    }

    // 2. Trial / renewal reminders: 7, 3 and 1 day before the period ends.
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

    // 3. Period ended → raise the invoice and mark past due.
    if (
      subscription.status === "ACTIVE" &&
      subscription.currentPeriodEnd &&
      subscription.currentPeriodEnd <= now
    ) {
      await generateInvoice(subscription.tenantId, {
        periodStart: subscription.currentPeriodStart,
        periodEnd: subscription.currentPeriodEnd,
      });
      await prisma.subscription.update({
        where: { id: subscription.id },
        data: {
          status: subscription.cancelAtPeriodEnd ? "CANCELLED" : "PAST_DUE",
          lastPaymentFailedAt: now,
          cancelledAt: subscription.cancelAtPeriodEnd ? now : null,
        },
      });
      invalidateEntitlements(subscription.tenantId);
      result.invoicesRaised += 1;
      await notify({
        userId: ownerId,
        type: NOTIFICATION_TYPES.SUBSCRIPTION_FAILED,
        title: "Renewal payment ব্যর্থ",
        body: `${GRACE_DAYS} দিনের grace period শুরু হয়েছে।`,
      });
      continue;
    }

    // 4. Failed-payment retries on day 1, 3 and 5, then grace → read-only.
    if (subscription.status === "PAST_DUE" && subscription.lastPaymentFailedAt) {
      const elapsed = Math.floor(
        (now.getTime() - subscription.lastPaymentFailedAt.getTime()) / 86_400_000,
      );

      if (RETRY_DAYS.includes(elapsed + 1)) {
        await notify({
          userId: ownerId,
          type: "subscription.payment_retry",
          title: `Payment retry (day ${elapsed + 1})`,
          body: "billing method যাচাই করে আবার চেষ্টা করুন।",
        });
      }

      if (elapsed >= GRACE_DAYS) {
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

    // 5. Read-only long enough → suspend the storefront (data is retained).
    if (subscription.status === "READ_ONLY" && subscription.graceEndsAt && subscription.graceEndsAt <= now) {
      await prisma.subscription.update({
        where: { id: subscription.id },
        data: { status: "SUSPENDED" },
      });
      await prisma.store.updateMany({
        where: { tenantId: subscription.tenantId },
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
