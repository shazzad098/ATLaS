import { z } from "zod";
import { assertCsrf } from "@/lib/auth/session";
import { ok, parseBody, rateLimit, route } from "@/lib/api";
import { authenticateRequest, resolveApiActor } from "@/lib/tenant";
import {
  createWebhookEndpoint,
  listWebhookEndpoints,
  MERCHANT_WEBHOOK_EVENTS,
} from "@/lib/services/webhook-service";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const eventSchema = z.enum(MERCHANT_WEBHOOK_EVENTS);
const createSchema = z.object({
  name: z.string().trim().min(2).max(80),
  url: z.string().trim().min(8).max(500),
  eventTypes: z.array(eventSchema).max(20).default([]),
  isActive: z.boolean().default(true),
});

export const GET = route(async (request: Request) => {
  const user = await authenticateRequest(request);
  const actor = await resolveApiActor(request, user);
  await rateLimit(`merchant-webhooks:list:${actor.tenantId}`, 120);
  return ok(await listWebhookEndpoints(actor));
});

export const POST = route(async (request: Request) => {
  assertCsrf(request);
  const user = await authenticateRequest(request);
  const actor = await resolveApiActor(request, user);
  await rateLimit(`merchant-webhooks:create:${actor.tenantId}`, 30);
  const input = await parseBody(request, createSchema);
  return ok(await createWebhookEndpoint(actor, input), { status: 201 });
});
