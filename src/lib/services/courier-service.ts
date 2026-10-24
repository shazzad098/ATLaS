import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { isAppError } from "@/lib/errors";
import { recordAudit } from "@/lib/audit";
import { applyTransition } from "@/lib/services/order-service";

export type CourierWebhookOutcome = {
  received: boolean;
  duplicate: boolean;
  signatureValid: boolean;
  status: string;
  orderNo?: string;
  trackingCode?: string;
  message?: string;
};

type CourierEvent = {
  eventKey: string;
  orderNo: string | null;
  trackingCode: string | null;
  rawStatus: string;
  shipmentStatus: string;
  orderStatus: "SHIPPED" | "DELIVERED" | "CANCELLED" | null;
  raw: Record<string, unknown>;
};

/**
 * Generic courier callback handler. Provider payloads are normalized at the
 * boundary so the order service only deals with ATLaS statuses. Providers can
 * use JSON or form-encoded callbacks; both are accepted, but every callback
 * must carry an HMAC signature in `x-courier-signature` (or `x-signature`).
 */
export async function handleCourierWebhook(
  providerName: string,
  request: Request,
  rawBody: string,
): Promise<CourierWebhookOutcome> {
  const provider = providerName.trim().toLowerCase();
  if (!provider) {
    return { received: false, duplicate: false, signatureValid: false, status: "INVALID_PROVIDER", message: "Courier provider missing" };
  }

  const event = parseCourierEvent(provider, request, rawBody);
  const signatureValid = verifyCourierSignature(rawBody, request.headers.get("x-courier-signature") ?? request.headers.get("x-signature"));
  const payloadHash = createHash("sha256").update(rawBody).digest("hex");

  // Verify authenticity before idempotency lookup. An attacker must not be
  // able to replay a real event key with a forged signature and receive the
  // previously processed event as if the forged request were trusted.
  if (!signatureValid) {
    const existing = await prisma.courierWebhookEvent.findUnique({ where: { provider_eventKey: { provider, eventKey: event.eventKey } } });
    if (!existing) {
      await prisma.courierWebhookEvent.create({
        data: {
          provider,
          eventKey: event.eventKey,
          signatureValid: false,
          payloadHash,
          payloadJson: event.raw as never,
          status: "REJECTED_SIGNATURE",
          processedAt: new Date(),
          error: "Signature invalid or COURIER_WEBHOOK_SECRET missing",
        },
      });
    }
    return { received: true, duplicate: Boolean(existing), signatureValid: false, status: "REJECTED_SIGNATURE", message: "Signature invalid" };
  }

  const claim = await claimCourierEvent({ provider, eventKey: event.eventKey, signatureValid, payloadHash, payload: event.raw });

  if (claim.duplicate) {
    return {
      received: true,
      duplicate: true,
      signatureValid: claim.event.signatureValid,
      status: claim.event.status,
      trackingCode: event.trackingCode ?? undefined,
      message: "Already processed",
    };
  }

  if (!event.trackingCode) {
    await prisma.courierWebhookEvent.update({
      where: { id: claim.event.id },
      data: { status: "INVALID_PAYLOAD", processedAt: new Date(), error: "trackingCode/awb is required" },
    });
    return { received: true, duplicate: false, signatureValid: true, status: "INVALID_PAYLOAD", message: "Tracking code missing" };
  }

  const order = event.orderNo
    ? await prisma.order.findFirst({ where: { orderNo: event.orderNo }, include: { items: true, store: { select: { tenantId: true } } } })
    : await findOrderByShipment(provider, event.trackingCode);

  if (!order) {
    await prisma.courierWebhookEvent.update({ where: { id: claim.event.id }, data: { status: "ORDER_NOT_FOUND", processedAt: new Date() } });
    return {
      received: true,
      duplicate: false,
      signatureValid: true,
      status: "ORDER_NOT_FOUND",
      trackingCode: event.trackingCode,
      message: "No matching order",
    };
  }

  const now = new Date();
  await prisma.courierShipment.upsert({
    where: { provider_trackingCode: { provider, trackingCode: event.trackingCode } },
    create: {
      storeId: order.storeId,
      orderId: order.id,
      provider,
      trackingCode: event.trackingCode,
      status: event.shipmentStatus,
      payloadJson: event.raw as never,
      ...(event.orderStatus === "SHIPPED" ? { shippedAt: now } : {}),
      ...(event.orderStatus === "DELIVERED" ? { shippedAt: now, deliveredAt: now } : {}),
    },
    update: {
      orderId: order.id,
      storeId: order.storeId,
      status: event.shipmentStatus,
      payloadJson: event.raw as never,
      ...(event.orderStatus === "SHIPPED" ? { shippedAt: now } : {}),
      ...(event.orderStatus === "DELIVERED" ? { deliveredAt: now } : {}),
    },
  });

  let status = "PROCESSED";
  let message = undefined as string | undefined;
  if (event.orderStatus && order.status !== event.orderStatus) {
    try {
      await applyTransition({
        orderId: order.id,
        from: order.status,
        to: event.orderStatus,
        actorType: "SYSTEM",
        note: `${provider} courier: ${event.rawStatus}`,
        items: order.items,
        storeId: order.storeId,
      });
    } catch (error) {
      if (!isAppError(error) || error.code !== "CONFLICT") throw error;
      status = "ORDER_TRANSITION_SKIPPED";
      message = `Order is already in ${order.status}; shipment was recorded.`;
    }
  }

  await prisma.courierWebhookEvent.update({ where: { id: claim.event.id }, data: { status, processedAt: new Date(), error: message } });
  await recordAudit({
    action: "courier.webhook_processed",
    tenantId: order.store.tenantId,
    resourceType: "Order",
    resourceId: order.id,
    metadata: { provider, trackingCode: event.trackingCode, shipmentStatus: event.shipmentStatus, orderStatus: event.orderStatus, eventKey: event.eventKey },
  });

  return {
    received: true,
    duplicate: false,
    signatureValid: true,
    status,
    orderNo: order.orderNo,
    trackingCode: event.trackingCode,
    message,
  };
}

export function signCourierPayload(rawBody: string, secret = env.courier.webhookSecret): string {
  if (!secret) throw new Error("COURIER_WEBHOOK_SECRET is not configured");
  return createHmac("sha256", secret).update(rawBody).digest("hex");
}

export function verifyCourierSignature(rawBody: string, signature: string | null): boolean {
  const secret = env.courier.webhookSecret;
  if (!secret || !signature) return false;
  const normalized = signature.startsWith("sha256=") ? signature.slice(7) : signature;
  if (!/^[a-f0-9]{64}$/i.test(normalized)) return false;
  const expected = Buffer.from(signCourierPayload(rawBody, secret), "hex");
  const received = Buffer.from(normalized, "hex");
  return expected.length === received.length && timingSafeEqual(expected, received);
}

function parseCourierEvent(provider: string, request: Request, rawBody: string): CourierEvent {
  const raw = parsePayload(request, rawBody);
  const get = (...keys: string[]) => keys.map((key) => raw[key]).find((value) => value !== undefined && value !== null && value !== "");
  const rawStatus = String(get("status", "delivery_status", "event", "current_status") ?? "UNKNOWN").toUpperCase().replace(/[\s-]+/g, "_");
  const trackingCode = get("trackingCode", "tracking_code", "awb", "waybill", "consignment_id", "consignmentId");
  const orderNo = get("orderNo", "order_no", "order_id", "merchantInvoiceNumber", "merchant_invoice_number");
  const eventKey = String(get("eventKey", "event_id", "eventId", "webhook_id", "id") ?? `${provider}:${trackingCode ?? "unknown"}:${rawStatus}:${createHash("sha256").update(rawBody).digest("hex").slice(0, 16)}`);
  const orderStatus = rawStatus === "DELIVERED" ? "DELIVERED" : ["PICKED_UP", "IN_TRANSIT", "SHIPPED", "DISPATCHED", "OUT_FOR_DELIVERY"].includes(rawStatus) ? "SHIPPED" : rawStatus === "CANCELLED" ? "CANCELLED" : null;
  return {
    eventKey,
    orderNo: orderNo ? String(orderNo) : null,
    trackingCode: trackingCode ? String(trackingCode) : null,
    rawStatus,
    shipmentStatus: rawStatus,
    orderStatus,
    raw,
  };
}

function parsePayload(request: Request, rawBody: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(rawBody || "{}");
    if (parsed && typeof parsed === "object") return parsed as Record<string, unknown>;
  } catch {
    // Fall through to form-urlencoded parsing.
  }
  return Object.fromEntries(new URLSearchParams(rawBody).entries());
}

async function findOrderByShipment(provider: string, trackingCode: string) {
  const shipment = await prisma.courierShipment.findUnique({
    where: { provider_trackingCode: { provider, trackingCode } },
    include: { order: { include: { items: true, store: { select: { tenantId: true } } } } },
  });
  return shipment?.order ?? null;
}

async function claimCourierEvent(input: { provider: string; eventKey: string; signatureValid: boolean; payloadHash: string; payload: Record<string, unknown> }) {
  const existing = await prisma.courierWebhookEvent.findUnique({ where: { provider_eventKey: { provider: input.provider, eventKey: input.eventKey } } });
  if (existing?.processedAt) return { event: existing, duplicate: true } as const;
  if (existing) {
    const claimed = await prisma.courierWebhookEvent.updateMany({
      where: { id: existing.id, processedAt: null, status: { not: "PROCESSING" } },
      data: { status: "PROCESSING", signatureValid: input.signatureValid, payloadHash: input.payloadHash, payloadJson: input.payload as never },
    });
    return { event: await prisma.courierWebhookEvent.findUniqueOrThrow({ where: { id: existing.id } }), duplicate: claimed.count === 0 } as const;
  }
  try {
    const event = await prisma.courierWebhookEvent.create({ data: { provider: input.provider, eventKey: input.eventKey, signatureValid: input.signatureValid, payloadHash: input.payloadHash, payloadJson: input.payload as never, status: "PROCESSING" } });
    return { event, duplicate: false } as const;
  } catch (error) {
    const raced = await prisma.courierWebhookEvent.findUnique({ where: { provider_eventKey: { provider: input.provider, eventKey: input.eventKey } } });
    if (!raced) throw error;
    return { event: raced, duplicate: Boolean(raced.processedAt || raced.status === "PROCESSING") } as const;
  }
}
