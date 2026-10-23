import { z } from "zod";
import { assertCsrf } from "@/lib/auth/session";
import { clientIp, ok, parseBody, rateLimit, route } from "@/lib/api";
import { authenticateRequest, resolveApiActor } from "@/lib/tenant";
import { requestReturn } from "@/lib/services/order-service";
import { recordAudit } from "@/lib/audit";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Context = { params: Promise<{ storeId: string; orderId: string }> };
const requestReturnSchema = z.object({ reason: z.string().trim().min(5).max(500) });

export const POST = route(async (request: Request, context: Context) => {
  assertCsrf(request);
  const { storeId, orderId } = await context.params;
  const user = await authenticateRequest(request);
  const actor = await resolveApiActor(request, user);
  await rateLimit(`returns:create:${actor.tenantId}`, 60);
  const input = await parseBody(request, requestReturnSchema);
  const order = await requestReturn(actor, storeId, orderId, input);
  await recordAudit({
    action: "order.return_requested_api",
    tenantId: actor.tenantId,
    actorId: actor.userId,
    resourceType: "Order",
    resourceId: orderId,
    metadata: { storeId, reason: input.reason },
    ip: clientIp(request),
  });
  return ok(order, { status: 201 });
});
