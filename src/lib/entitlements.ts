import { prisma } from "@/lib/db";
import { monthBounds } from "@/lib/dates";
import {
  PLAN_DEFINITIONS,
  planMatrixFor,
  type PlanCode,
  type PlanFeatures,
  type PlanLimits,
} from "@/lib/plans";

/**
 * Entitlement service (PRD §5.3).
 *
 * Every limit check runs on the server. The UI may hide a button, but nothing
 * is enforced by the frontend alone: mutations call `assert*` helpers before
 * writing. Snapshots are cached in-process and invalidated the moment billing
 * changes, which is the "immediate invalidation" the PRD asks for.
 */

export type Usage = {
  products: number;
  ordersThisPeriod: number;
  storageMb: number;
  staffSeats: number;
};

export type EntitlementSnapshot = {
  tenantId: string;
  planCode: PlanCode;
  planName: string;
  subscriptionStatus: string;
  limits: PlanLimits;
  features: PlanFeatures;
  overageRate: number;
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  usage: Usage;
  /** True when the subscription is in a state that blocks new writes. */
  readOnly: boolean;
  suspended: boolean;
};

const cache = new Map<string, { value: EntitlementSnapshot; expiresAt: number }>();
const CACHE_TTL_MS = 30_000;

export function invalidateEntitlements(tenantId: string): void {
  cache.delete(tenantId);
}

/** Thrown when a plan limit blocks an action. Shaped for the API error envelope. */
export class EntitlementError extends Error {
  readonly code = "PLAN_LIMIT_REACHED";
  readonly status = 402;
  constructor(
    message: string,
    readonly detail: {
      feature?: string;
      metric?: string;
      limit?: number | null;
      used?: number;
      planCode?: PlanCode;
      upgradeTo?: PlanCode;
    } = {},
  ) {
    super(message);
    this.name = "EntitlementError";
  }
}

const WRITE_BLOCKING_STATUSES = new Set(["READ_ONLY", "SUSPENDED", "CANCELLED"]);

export async function loadEntitlementSnapshot(
  tenantId: string,
  options: { force?: boolean } = {},
): Promise<EntitlementSnapshot> {
  const cached = cache.get(tenantId);
  if (!options.force && cached && cached.expiresAt > Date.now()) {
    return cached.value;
  }

  const subscription = await prisma.subscription.findUnique({
    where: { tenantId },
    include: { plan: true },
  });

  const planCode = resolvePlanCode(subscription?.plan?.code);
  const fallback = planMatrixFor(planCode);

  const limits: PlanLimits = subscription?.plan
    ? { ...fallback.$limits, ...(subscription.plan.limitsJson as Partial<PlanLimits>) }
    : fallback.$limits;
  const features: PlanFeatures = subscription?.plan
    ? { ...fallback.$features, ...(subscription.plan.featuresJson as Partial<PlanFeatures>) }
    : fallback.$features;

  const now = new Date();
  const bounds = monthBounds(now);
  const periodStart = subscription?.currentPeriodStart ?? bounds.start;
  const periodEnd = subscription?.currentPeriodEnd ?? bounds.end;

  const [products, ordersThisPeriod, staffSeats, assets] = await Promise.all([
    prisma.product.count({ where: { store: { tenantId }, deletedAt: null, status: { not: "ARCHIVED" } } }),
    prisma.order.count({
      where: {
        store: { tenantId },
        deletedAt: null,
        placedAt: { gte: periodStart, lte: periodEnd },
        status: { notIn: ["CANCELLED"] },
      },
    }),
    prisma.membership.count({ where: { tenantId, status: { in: ["ACTIVE", "INVITED"] } } }),
    prisma.asset.aggregate({ where: { store: { tenantId } }, _sum: { sizeBytes: true } }),
  ]);

  const subscriptionStatus = subscription?.status ?? "TRIALING";
  const storageMb = Math.ceil((assets._sum.sizeBytes ?? 0) / (1024 * 1024));

  const snapshot: EntitlementSnapshot = {
    tenantId,
    planCode,
    planName: subscription?.plan?.name ?? fallback.name,
    subscriptionStatus,
    limits,
    features,
    overageRate: limits.overageRate,
    currentPeriodStart: periodStart,
    currentPeriodEnd: periodEnd,
    usage: {
      products,
      ordersThisPeriod,
      storageMb,
      staffSeats,
    },
    readOnly: WRITE_BLOCKING_STATUSES.has(subscriptionStatus),
    suspended: subscriptionStatus === "SUSPENDED" || subscriptionStatus === "CANCELLED",
  };

  cache.set(tenantId, { value: snapshot, expiresAt: Date.now() + CACHE_TTL_MS });
  return snapshot;
}

function resolvePlanCode(code: string | undefined): PlanCode {
  if (code && code in PLAN_DEFINITIONS) return code as PlanCode;
  return "free";
}

function upgradeTargetFor(code: PlanCode): PlanCode {
  const order: PlanCode[] = ["free", "basic", "standard", "pro"];
  const index = order.indexOf(code);
  return order[Math.min(index + 1, order.length - 1)];
}

/** Blocks new writes while the subscription is read-only or suspended (PRD §5.2). */
export function assertTenantWritable(snapshot: EntitlementSnapshot): void {
  if (!snapshot.readOnly) return;
  throw new EntitlementError(
    snapshot.suspended
      ? "Your store is suspended. Contact support or renew your subscription to continue."
      : "Your subscription is read-only. Renew to create new records — reading and exporting still work.",
    { planCode: snapshot.planCode, upgradeTo: upgradeTargetFor(snapshot.planCode) },
  );
}

export function assertProductQuota(snapshot: EntitlementSnapshot, adding = 1): void {
  const limit = snapshot.limits.products;
  if (limit === null) return;
  if (snapshot.usage.products + adding <= limit) return;
  throw new EntitlementError(
    `আপনার ${snapshot.planName} plan-এ সর্বোচ্চ ${limit}টি product রাখা যাবে। আরও যোগ করতে plan upgrade করুন।`,
    {
      metric: "products",
      limit,
      used: snapshot.usage.products,
      planCode: snapshot.planCode,
      upgradeTo: upgradeTargetFor(snapshot.planCode),
    },
  );
}

export function assertStorageQuota(snapshot: EntitlementSnapshot, addingMb = 0): void {
  const limit = snapshot.limits.storageMb;
  if (limit === null) return;
  if (snapshot.usage.storageMb + addingMb <= limit) return;
  throw new EntitlementError(
    `Storage limit (${limit}MB) প্রায় শেষ। Plan upgrade করুন বা পুরনো image মুছুন।`,
    {
      metric: "storage_mb",
      limit,
      used: snapshot.usage.storageMb,
      planCode: snapshot.planCode,
      upgradeTo: upgradeTargetFor(snapshot.planCode),
    },
  );
}

export function assertStaffSeatAvailable(snapshot: EntitlementSnapshot): void {
  const limit = snapshot.limits.staffSeats;
  if (snapshot.usage.staffSeats < limit) return;
  throw new EntitlementError(
    `${snapshot.planName} plan-এ সর্বোচ্চ ${limit}টি staff seat আছে।`,
    {
      metric: "staff_seats",
      limit,
      used: snapshot.usage.staffSeats,
      planCode: snapshot.planCode,
      upgradeTo: upgradeTargetFor(snapshot.planCode),
    },
  );
}

export function assertFeature(
  snapshot: EntitlementSnapshot,
  feature: keyof PlanFeatures | string,
): void {
  const value = (snapshot.features as Record<string, unknown>)[feature];
  if (value === true) return;
  throw new EntitlementError(`${snapshot.planName} plan-এ এই feature নেই।`, {
    feature: String(feature),
    planCode: snapshot.planCode,
    upgradeTo: upgradeTargetFor(snapshot.planCode),
  });
}

export function assertCustomDomain(snapshot: EntitlementSnapshot): void {
  if (snapshot.limits.customDomain) return;
  throw new EntitlementError(
    "Custom domain শুধু Standard ও Pro plan-এ পাওয়া যায়। Upgrade করুন।",
    {
      feature: "domain.custom",
      planCode: snapshot.planCode,
      upgradeTo: "standard",
    },
  );
}

export function assertReportLevel(snapshot: EntitlementSnapshot, minimum: "CSV" | "ADVANCED") {
  const rank = { BASIC: 0, CSV: 1, ADVANCED: 2, ADVANCED_SCHEDULED: 3 } as const;
  if (rank[snapshot.limits.reports] >= rank[minimum]) return;
  throw new EntitlementError(`${minimum} report আপনার plan-এ নেই।`, {
    feature: minimum === "CSV" ? "reports.csv" : "reports.advanced",
    planCode: snapshot.planCode,
    upgradeTo: minimum === "CSV" ? "basic" : "standard",
  });
}

/** True when the plan allows picking a different theme right now (PRD §5.1, US-04). */
export function canSwitchTheme(snapshot: EntitlementSnapshot, hasPublishedTheme: boolean): boolean {
  if (snapshot.limits.themeSwitching === "ALLOWED") return true;
  // Free: the first pick is allowed; switching afterwards is not.
  if (snapshot.limits.themeSwitching === "STARTER_ONLY") return !hasPublishedTheme;
  // Basic: locked for the duration of the active subscription.
  return !hasPublishedTheme;
}

export function themeAllowedOnPlan(snapshot: EntitlementSnapshot, themeCode: string): boolean {
  return snapshot.limits.themes.includes(themeCode);
}

/**
 * Overages do not block the merchant — they are billed (PRD US-03). This returns
 * how many orders are already past the included quota.
 */
export function overageCount(snapshot: EntitlementSnapshot): number {
  const included = snapshot.limits.monthlyOrders;
  if (included === null) return 0;
  return Math.max(0, snapshot.usage.ordersThisPeriod - included);
}

/**
 * Maintains the UsageCounter ledger. Counters are for reporting and invoicing;
 * live counts above remain the enforcement source of truth.
 */
export async function recordUsage(
  tenantId: string,
  metric: string,
  delta = 1,
): Promise<void> {
  const { start, end } = monthBounds();
  await prisma.usageCounter.upsert({
    where: { tenantId_metric_periodStart: { tenantId, metric, periodStart: start } },
    create: { tenantId, metric, periodStart: start, periodEnd: end, quantity: delta },
    update: { quantity: { increment: delta } },
  });
}
