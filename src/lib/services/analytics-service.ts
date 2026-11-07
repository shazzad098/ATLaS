import { prisma } from "@/lib/db";
import { addDays } from "@/lib/dates";

/**
 * Lightweight product analytics (FR-09).
 *
 * Events are append-only and never allowed to break a request: a tracking
 * failure is logged, not surfaced to the shopper. Aggregate dashboards read
 * these rows directly; `DailyStoreMetric` (reports) is the heavier rollup.
 */

/** Storefront funnel events (FR-09). */
export const ANALYTICS_EVENTS = [
  "store.view",
  "product.view",
  "cart.add",
  "checkout.start",
  "checkout.success",
  "order.paid",
] as const;

/**
 * Platform lifecycle events. These have a tenant but no store, so they are
 * written with `storeId: null` and read by platform-wide reporting rather than
 * the per-store developer dashboard.
 */
export const PLATFORM_ANALYTICS_EVENTS = [
  "signup_completed",
  "store_created",
  "trial_started",
  "plan_change_requested",
  "plan_upgraded",
  "plan_downgraded",
] as const;

export const ALL_ANALYTICS_EVENTS = [
  ...ANALYTICS_EVENTS,
  ...PLATFORM_ANALYTICS_EVENTS,
] as const;

/** The known names are documented here; custom names are still accepted. */
export type AnalyticsEventName = (typeof ALL_ANALYTICS_EVENTS)[number] | string;

export async function trackEvent(input: {
  tenantId?: string | null;
  storeId?: string | null;
  name: AnalyticsEventName;
  path?: string | null;
  referrer?: string | null;
  userAgent?: string | null;
  sessionId?: string | null;
  metadata?: Record<string, unknown>;
  occurredAt?: Date;
}): Promise<void> {
  try {
    await prisma.analyticsEvent.create({
      data: {
        tenantId: input.tenantId ?? null,
        storeId: input.storeId ?? null,
        name: input.name.slice(0, 80),
        path: input.path?.slice(0, 500) ?? null,
        referrer: input.referrer?.slice(0, 500) ?? null,
        userAgent: input.userAgent?.slice(0, 400) ?? null,
        sessionId: input.sessionId?.slice(0, 80) ?? null,
        metadataJson: (input.metadata ?? {}) as never,
        occurredAt: input.occurredAt ?? new Date(),
      },
    });
  } catch (error) {
    console.error("[analytics] track failed", input.name, error);
  }
}

export async function analyticsSummary(storeId: string, days = 30) {
  const from = addDays(new Date(), -days);
  const [byName, total, recent] = await Promise.all([
    prisma.analyticsEvent.groupBy({
      by: ["name"],
      where: { storeId, occurredAt: { gte: from } },
      _count: { _all: true },
      orderBy: { _count: { name: "desc" } },
    }),
    prisma.analyticsEvent.count({ where: { storeId, occurredAt: { gte: from } } }),
    prisma.analyticsEvent.findMany({
      where: { storeId },
      orderBy: { occurredAt: "desc" },
      take: 20,
      select: { id: true, name: true, path: true, occurredAt: true },
    }),
  ]);

  return {
    total,
    byName: byName.map((row) => ({ name: row.name, count: row._count._all })),
    recent,
  };
}

/**
 * Platform lifecycle rollup (signups, stores, plan changes). Storefront funnel
 * events are excluded by name so a store-level `store.view` never skews the
 * platform counts.
 */
export async function platformAnalyticsSummary(days = 30) {
  const from = addDays(new Date(), -days);
  const where = {
    occurredAt: { gte: from },
    name: { in: [...PLATFORM_ANALYTICS_EVENTS] },
  };

  const [byName, total, recent] = await Promise.all([
    prisma.analyticsEvent.groupBy({
      by: ["name"],
      where,
      _count: { _all: true },
      orderBy: { _count: { name: "desc" } },
    }),
    prisma.analyticsEvent.count({ where }),
    prisma.analyticsEvent.findMany({
      where,
      orderBy: { occurredAt: "desc" },
      take: 20,
      select: { id: true, name: true, tenantId: true, occurredAt: true },
    }),
  ]);

  return {
    total,
    byName: byName.map((row) => ({ name: row.name, count: row._count._all })),
    recent,
  };
}
