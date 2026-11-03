import { type NextRequest } from "next/server";
import { ok, rateLimitForTenant, route } from "@/lib/api";
import { loadEntitlementSnapshot } from "@/lib/entitlements";
import { assertPermission } from "@/lib/rbac";
import { authorizeApiRequest } from "@/lib/tenant";
import { getSubscriptionDetail } from "@/lib/services/billing-service";

/** Tenant subscription, quotas and overage (PRD §11.5, §5.3). */

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export const GET = route(async (request: NextRequest) => {
  const { actor } = await authorizeApiRequest(request);
  assertPermission(actor, "billing:read");
  await rateLimitForTenant(actor.tenantId, "billing:usage");

  const [detail, snapshot] = await Promise.all([
    getSubscriptionDetail(actor.tenantId),
    loadEntitlementSnapshot(actor.tenantId),
  ]);

  return ok({
    plan: { code: snapshot.planCode, name: snapshot.planName },
    status: detail.subscription.status,
    periodStart: detail.subscription.currentPeriodStart,
    periodEnd: detail.subscription.currentPeriodEnd,
    trialDaysRemaining: detail.trialDaysRemaining,
    usage: snapshot.usage,
    limits: snapshot.limits,
    overage: detail.overage,
    fees: detail.fees,
  });
});
