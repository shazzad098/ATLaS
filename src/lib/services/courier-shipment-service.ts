import { z } from "zod";
import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { AppError, ConflictError, NotFoundError } from "@/lib/errors";
import { assertPermission, type ActorContext } from "@/lib/rbac";
import { assertStoreAccess } from "@/lib/tenant";
import { recordAudit } from "@/lib/audit";
import { applyTransition, canTransition } from "@/lib/services/order-service";
import { emitMerchantWebhook } from "@/lib/services/webhook-service";
import { getStoreCourierSecrets } from "@/lib/services/courier-service";

export const createShipmentInputSchema = z.object({
  provider: z.string().trim().min(2).max(40).regex(/^[a-zA-Z0-9_-]+$/).optional(),
  serviceType: z.string().trim().max(80).optional(),
  notes: z.string().trim().max(500).optional(),
});

export type CreateShipmentInput = z.infer<typeof createShipmentInputSchema>;

export async function createCourierShipment(
  actor: ActorContext,
  storeId: string,
  orderId: string,
  idempotencyKey: string,
  input: CreateShipmentInput,
) {
  assertPermission(actor, "delivery:write");
  await assertStoreAccess(actor, storeId);

  const existing = await prisma.courierShipment.findUnique({
    where: { storeId_idempotencyKey: { storeId, idempotencyKey } },
  });
  if (existing) {
    if (existing.orderId !== orderId) throw new ConflictError("এই Idempotency-Key অন্য order-এ ব্যবহার হয়েছে।");
    return { shipment: existing, replayed: true };
  }

  const order = await prisma.order.findFirst({
    where: { id: orderId, storeId, deletedAt: null },
    include: { items: true },
  });
  if (!order) throw new NotFoundError("Order");
  if (order.status !== "SHIPPED" && !canTransition(order.status, "SHIPPED")) {
    throw new AppError("VALIDATION_FAILED", "এই order এখন courier shipment-এর জন্য প্রস্তুত নয়।", 422, { status: order.status });
  }

  const storeCourier = await getStoreCourierSecrets(storeId);
  const provider = (input.provider ?? storeCourier.provider ?? env.courier.provider ?? "sandbox").trim().toLowerCase();

  const isSandbox = provider === "sandbox" || (!storeCourier.apiKey && !env.courier.apiKey);
  const courier = isSandbox
    ? { trackingCode: `${provider.toUpperCase().slice(0, 3)}-${order.orderNo}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`, status: "CREATED", raw: { sandbox: true } }
    : await createRemoteShipment(provider, order, idempotencyKey, input, storeCourier);

  const shipment = await prisma.courierShipment.create({
    data: {
      storeId,
      orderId,
      provider,
      trackingCode: courier.trackingCode,
      idempotencyKey,
      status: courier.status,
      payloadJson: courier.raw as never,
    },
  });

  if (order.status !== "SHIPPED") {
    try {
      await applyTransition({
        orderId,
        from: order.status,
        to: "SHIPPED",
        actorType: "STAFF",
        actorId: actor.userId,
        note: `Courier shipment created via ${provider}`,
        items: order.items,
        storeId,
      });
    } catch (error) {
      const current = await prisma.order.findUnique({ where: { id: orderId }, select: { status: true } });
      if (current?.status !== "SHIPPED") {
        await prisma.courierShipment.update({ where: { id: shipment.id }, data: { status: "ERROR" } });
        throw error;
      }
    }
  }

  await emitMerchantWebhook({
    tenantId: actor.tenantId,
    eventType: "shipment.created",
    data: { shipmentId: shipment.id, orderId, orderNo: order.orderNo, provider, trackingCode: shipment.trackingCode, status: shipment.status },
  });
  await recordAudit({
    action: "courier.shipment_created",
    tenantId: actor.tenantId,
    actorId: actor.userId,
    resourceType: "CourierShipment",
    resourceId: shipment.id,
    metadata: { storeId, orderId, provider, trackingCode: shipment.trackingCode },
  });

  return { shipment, replayed: false };
}

export async function listCourierShipments(actor: ActorContext, storeId: string, orderId: string) {
  assertPermission(actor, "delivery:read");
  await assertStoreAccess(actor, storeId);
  const order = await prisma.order.findFirst({ where: { id: orderId, storeId }, select: { id: true } });
  if (!order) throw new NotFoundError("Order");
  return prisma.courierShipment.findMany({ where: { storeId, orderId }, orderBy: { createdAt: "desc" } });
}

async function createRemoteShipment(
  provider: string,
  order: {
    orderNo: string;
    customerName: string;
    customerPhone: string;
    addressSnapshotJson: unknown;
    grandTotal: unknown;
    currency: string;
  },
  idempotencyKey: string,
  input: CreateShipmentInput,
  storeCourier?: { apiUrl?: string; apiKey?: string; secretKey?: string; storeIdAtCourier?: string },
) {
  const apiUrl = storeCourier?.apiUrl || env.courier.apiUrl;
  const apiKey = storeCourier?.apiKey || env.courier.apiKey;

  if (!apiUrl || !apiKey) {
    throw new AppError("INTEGRATION_FAILED", `${provider} courier credentials configure করা হয়নি।`, 503, { provider });
  }
  const response = await fetch(`${apiUrl.replace(/\/$/, "")}/shipments`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${apiKey}`,
      "idempotency-key": idempotencyKey,
      ...(storeCourier?.secretKey ? { "x-secret-key": storeCourier.secretKey } : {}),
      ...(storeCourier?.storeIdAtCourier ? { "x-store-id": storeCourier.storeIdAtCourier } : {}),
    },
    body: JSON.stringify({
      provider,
      orderNo: order.orderNo,
      customer: { name: order.customerName, phone: order.customerPhone, address: order.addressSnapshotJson },
      amount: String(order.grandTotal),
      currency: order.currency,
      serviceType: input.serviceType,
      notes: input.notes,
    }),
    signal: AbortSignal.timeout(15_000),
  });
  let body: Record<string, unknown> = {};
  try {
    body = (await response.json()) as Record<string, unknown>;
  } catch {
    // Keep a useful integration error below.
  }
  if (!response.ok) {
    throw new AppError("INTEGRATION_FAILED", "Courier shipment creation ব্যর্থ হয়েছে।", 502, { provider, status: response.status });
  }
  const trackingCode = body.trackingCode ?? body.tracking_code ?? body.awb ?? body.waybill ?? (body.data as Record<string, unknown> | undefined)?.trackingCode;
  if (typeof trackingCode !== "string" || trackingCode.length < 2) {
    throw new AppError("INTEGRATION_FAILED", "Courier response-এ tracking code পাওয়া যায়নি।", 502, { provider });
  }
  return { trackingCode, status: typeof body.status === "string" ? body.status : "CREATED", raw: body };
}
