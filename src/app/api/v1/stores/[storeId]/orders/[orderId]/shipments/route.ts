import { assertCsrf } from "@/lib/auth/session";
import { clientIp, ok, parseBody, rateLimit, requireIdempotencyKey, route } from "@/lib/api";
import { authenticateRequest, resolveApiActor } from "@/lib/tenant";
import {
  createCourierShipment,
  createShipmentInputSchema,
  listCourierShipments,
} from "@/lib/services/courier-shipment-service";

type ShipmentRouteContext = { params: Promise<{ storeId: string; orderId: string }> };

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export const GET = route(async (request: Request, context: ShipmentRouteContext) => {
  const { storeId, orderId } = await context.params;
  const user = await authenticateRequest(request);
  const actor = await resolveApiActor(request, user);
  await rateLimit(`shipments:list:${actor.tenantId}:${clientIp(request)}`, 120);
  return ok(await listCourierShipments(actor, storeId, orderId));
});

export const POST = route(async (request: Request, context: ShipmentRouteContext) => {
  assertCsrf(request);
  const { storeId, orderId } = await context.params;
  const user = await authenticateRequest(request);
  const actor = await resolveApiActor(request, user);
  await rateLimit(`shipments:create:${actor.tenantId}`, 30);
  const input = await parseBody(request, createShipmentInputSchema);
  const result = await createCourierShipment(actor, storeId, orderId, requireIdempotencyKey(request), input);
  return ok(result, { status: result.replayed ? 200 : 201 });
});
