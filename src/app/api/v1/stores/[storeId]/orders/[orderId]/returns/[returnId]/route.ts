import { z } from "zod";
import { assertCsrf } from "@/lib/auth/session";
import { clientIp, ok, parseBody, rateLimit, route } from "@/lib/api";
import { authenticateRequest, resolveApiActor } from "@/lib/tenant";
import { resolveReturn } from "@/lib/services/order-service";
import { recordAudit } from "@/lib/audit";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Context = { params: Promise<{ storeId: string; orderId: string; returnId: string }> };
const resolveReturnSchema = z.object({
  status: z.enum(["APPROVED", "REJECTED", "RECEIVED", "REFUNDED"]),
  resolution: z.string().trim().max(500).optional(),
});

export const PATCH = route(async (request: Request, context: Context) => {
  assertCsrf(request);
  const { storeId, orderId, returnId } = await context.params;
  const user = await authenticateRequest(request);
  const actor = await resolveApiActor(request, user);
  await rateLimit(`returns:resolve:${actor.tenantId}`, 60);
  const input = await parseBody(request, resolveReturnSchema);
  const order = await resolveReturn(actor, storeId, returnId, input, orderId);
  await recordAudit({
    action: "order.return_resolved_api",
    tenantId: actor.tenantId,
    actorId: actor.userId,
    resourceType: "Return",
    resourceId: returnId,
    metadata: { storeId, orderId, status: input.status },
    ip: clientIp(request),
  });
  return ok(order);
});
