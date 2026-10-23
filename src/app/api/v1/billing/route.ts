import { z } from "zod";
import { assertCsrf } from "@/lib/auth/session";
import { authenticateRequest, resolveApiActor } from "@/lib/tenant";
import { clientIp, ok, parseBody, rateLimit, route } from "@/lib/api";
import {
  cancelSubscription,
  changePlan,
  getSubscriptionDetail,
  startTrial,
} from "@/lib/services/billing-service";
import { recordAudit } from "@/lib/audit";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const billingInputSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("start_trial"), planCode: z.enum(["basic", "standard", "pro"]), billingPeriod: z.enum(["MONTHLY", "YEARLY"]).optional() }),
  z.object({ action: z.literal("change_plan"), planCode: z.enum(["free", "basic", "standard", "pro"]), billingPeriod: z.enum(["MONTHLY", "YEARLY"]).optional() }),
  z.object({ action: z.literal("cancel"), atPeriodEnd: z.boolean().optional() }),
]);

export const GET = route(async (request: Request) => {
  const user = await authenticateRequest(request);
  const actor = await resolveApiActor(request, user);
  await rateLimit(`billing:get:${actor.tenantId}`, 60);
  return ok(await getSubscriptionDetail(actor.tenantId));
});

export const POST = route(async (request: Request) => {
  assertCsrf(request);
  const user = await authenticateRequest(request);
  const actor = await resolveApiActor(request, user);
  await rateLimit(`billing:write:${actor.tenantId}`, 30);
  const input = await parseBody(request, billingInputSchema);
  let result;
  if (input.action === "start_trial") {
    result = await startTrial(actor, input.planCode, input.billingPeriod ?? "MONTHLY");
  } else if (input.action === "change_plan") {
    result = await changePlan(actor, input.planCode, input.billingPeriod ?? "MONTHLY");
  } else {
    result = await cancelSubscription(actor, { atPeriodEnd: input.atPeriodEnd });
  }
  await recordAudit({
    action: `billing.${input.action}`,
    tenantId: actor.tenantId,
    actorId: actor.userId,
    resourceType: "Subscription",
    resourceId: actor.tenantId,
    metadata: input,
    ip: clientIp(request),
  });
  return ok(result);
});
