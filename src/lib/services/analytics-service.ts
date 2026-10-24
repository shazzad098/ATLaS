import { prisma } from "@/lib/db";
import { ANALYTICS_EVENTS, type AnalyticsEventName } from "@/lib/analytics-taxonomy";

export { ANALYTICS_EVENTS } from "@/lib/analytics-taxonomy";
export type { AnalyticsEventName } from "@/lib/analytics-taxonomy";

type TrackEventInput = {
  name: AnalyticsEventName;
  tenantId?: string;
  storeId?: string;
  actorId?: string;
  properties?: Record<string, unknown>;
  occurredAt?: Date;
};

/**
 * Analytics is deliberately best-effort: a metrics outage must not roll back a
 * checkout, signup or subscription change. The event is still awaited so serverless
 * runtimes have time to persist it before the request finishes.
 */
export async function trackEvent(input: TrackEventInput): Promise<void> {
  try {
    await prisma.analyticsEvent.create({
      data: {
        name: input.name,
        tenantId: input.tenantId,
        storeId: input.storeId,
        actorId: input.actorId,
        properties: (input.properties ?? {}) as never,
        occurredAt: input.occurredAt,
      },
    });
  } catch (error) {
    console.error("[analytics] event write failed", { name: input.name, error });
  }
}

export async function analyticsOverview(days = 30) {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const [byEvent, total, activeTenants] = await Promise.all([
    prisma.analyticsEvent.groupBy({
      by: ["name"],
      where: { occurredAt: { gte: since } },
      _count: { _all: true },
      orderBy: { _count: { name: "desc" } },
    }),
    prisma.analyticsEvent.count({ where: { occurredAt: { gte: since } } }),
    prisma.analyticsEvent.findMany({
      where: { occurredAt: { gte: since }, tenantId: { not: null } },
      distinct: ["tenantId"],
      select: { tenantId: true },
    }),
  ]);

  const counts = Object.fromEntries(byEvent.map((row) => [row.name, row._count._all]));
  const funnel = Object.fromEntries(
    ANALYTICS_EVENTS.map((event) => [event, counts[event] ?? 0]),
  ) as Record<AnalyticsEventName, number>;

  return { days, since, total, activeTenants: activeTenants.length, funnel };
}
