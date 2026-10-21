import { type NextRequest } from "next/server";
import { ok, rateLimit, route } from "@/lib/api";
import { assertPermission } from "@/lib/rbac";
import { assertStoreAccess, authenticateRequest, resolveApiActor } from "@/lib/tenant";
import { getSubscriptionDetail, listInvoices, pricingMatrix } from "@/lib/services/billing-service";

/**
 * Subscription + invoices (PRD §11.2 "billing").
 *
 * Read-only: plan changes stay on the merchant billing screens where the
 * proration/upgrade copy lives. The tenant id always comes from the resolved
 * actor, never from the URL, so a store id can only ever read its own tenant's
 * billing.
 */

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type StoreRouteContext = { params: Promise<{ storeId: string }> };

export const GET = route(async (request: NextRequest, context: StoreRouteContext) => {
  const { storeId } = await context.params;

  const user = await authenticateRequest(request);
  const actor = await resolveApiActor(request, user);
  assertPermission(actor, "billing:read");
  await assertStoreAccess(actor, storeId);
  rateLimit(`billing:read:${actor.tenantId}`, 120);

  const [detail, invoices, plans] = await Promise.all([
    getSubscriptionDetail(actor.tenantId),
    listInvoices(actor.tenantId, 24),
    pricingMatrix(),
  ]);

  return ok({
    subscription: {
      status: detail.subscription.status,
      billingPeriod: detail.subscription.billingPeriod,
      planCode: detail.snapshot.planCode,
      planName: detail.snapshot.planName,
      currentPeriodStart: detail.subscription.currentPeriodStart,
      currentPeriodEnd: detail.subscription.currentPeriodEnd,
      trialEnd: detail.subscription.trialEnd,
      cancelAtPeriodEnd: detail.subscription.cancelAtPeriodEnd,
      graceEndsAt: detail.subscription.graceEndsAt,
    },
    usage: {
      products: detail.snapshot.usage.products,
      ordersThisPeriod: detail.snapshot.usage.ordersThisPeriod,
      storageMb: detail.snapshot.usage.storageMb,
      includedOrders: detail.snapshot.limits.monthlyOrders,
      overageOrders: detail.overage,
      overageRate: detail.snapshot.limits.overageRate,
    },
    fees: detail.fees,
    trialDaysRemaining: detail.trialDaysRemaining,
    periodDaysRemaining: detail.periodDaysRemaining,
    invoices: invoices.map((invoice) => ({
      id: invoice.id,
      number: invoice.number,
      status: invoice.status,
      currency: invoice.currency,
      total: String(invoice.total),
      dueAt: invoice.dueAt,
      paidAt: invoice.paidAt,
      createdAt: invoice.createdAt,
      lines: invoice.linesJson,
    })),
    plans: plans.map((plan) => ({
      code: plan.code,
      name: plan.name,
      monthlyPriceBdt: plan.monthlyPriceBdt,
      yearlyPriceBdt: plan.yearlyPriceBdt,
    })),
  });
});
