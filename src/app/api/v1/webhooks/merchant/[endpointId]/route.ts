import { z } from "zod";
import { assertCsrf } from "@/lib/auth/session";
import { ok, parseBody, rateLimit, route } from "@/lib/api";
import { authenticateRequest, resolveApiActor } from "@/lib/tenant";
import {
  deleteWebhookEndpoint,
  MERCHANT_WEBHOOK_EVENTS,
  updateWebhookEndpoint,
} from "@/lib/services/webhook-service";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type EndpointRouteContext = { params: Promise<{ endpointId: string }> };
const eventSchema = z.enum(MERCHANT_WEBHOOK_EVENTS);
const patchSchema = z.object({
  name: z.string().trim().min(2).max(80).optional(),
  url: z.string().trim().min(8).max(500).optional(),
  eventTypes: z.array(eventSchema).max(20).optional(),
  isActive: z.boolean().optional(),
  rotateSecret: z.boolean().optional(),
});

export const PATCH = route(async (request: Request, context: EndpointRouteContext) => {
  assertCsrf(request);
  const { endpointId } = await context.params;
  const user = await authenticateRequest(request);
  const actor = await resolveApiActor(request, user);
  await rateLimit(`merchant-webhooks:update:${actor.tenantId}`, 60);
  const input = await parseBody(request, patchSchema);
  return ok(await updateWebhookEndpoint(actor, endpointId, input));
});

export const DELETE = route(async (request: Request, context: EndpointRouteContext) => {
  assertCsrf(request);
  const { endpointId } = await context.params;
  const user = await authenticateRequest(request);
  const actor = await resolveApiActor(request, user);
  await rateLimit(`merchant-webhooks:delete:${actor.tenantId}`, 30);
  return ok(await deleteWebhookEndpoint(actor, endpointId));
});
