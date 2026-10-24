import { assertCsrf } from "@/lib/auth/session";
import { ok, rateLimit, route } from "@/lib/api";
import { authenticateRequest, resolveApiActor } from "@/lib/tenant";
import { createTestWebhookDelivery } from "@/lib/services/webhook-service";

type EndpointRouteContext = { params: Promise<{ endpointId: string }> };

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export const POST = route(async (request: Request, context: EndpointRouteContext) => {
  assertCsrf(request);
  const { endpointId } = await context.params;
  const user = await authenticateRequest(request);
  const actor = await resolveApiActor(request, user);
  await rateLimit(`merchant-webhooks:test:${actor.tenantId}`, 10);
  return ok(await createTestWebhookDelivery(actor, endpointId));
});
