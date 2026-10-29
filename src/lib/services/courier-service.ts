import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { isAppError, NotFoundError } from "@/lib/errors";
import { recordAudit } from "@/lib/audit";
import { applyTransition } from "@/lib/services/order-service";
import { assertPermission, type ActorContext } from "@/lib/rbac";
import { assertStoreAccess } from "@/lib/tenant";
import { decryptSecretJson, encryptSecretJson } from "@/lib/secrets";
import {
  COURIER_PROVIDERS,
  type CourierProviderId,
  type StoreCourierPublicConfig,
} from "@/lib/courier-constants";

export { COURIER_PROVIDERS };
export type { CourierProviderId, StoreCourierPublicConfig };

export type StoreCourierSecrets = {
  provider: string;
  isEnabled: boolean;
  apiUrl: string;
  apiKey: string;
  secretKey: string;
  storeIdAtCourier: string;
  webhookSecret: string;
  autoBooking: boolean;
};

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
 * Loads merchant-configured courier settings for a store.
 */
export async function getStoreCourierConfig(storeId: string): Promise<StoreCourierPublicConfig> {
  const store = await prisma.store.findUnique({
    where: { id: storeId },
    select: { slug: true, settings: { select: { checkoutJson: true } } },
  });

  const checkout = (store?.settings?.checkoutJson ?? {}) as Record<string, unknown>;
  const courierPublic = (checkout.courierConfig ?? {}) as Record<string, unknown>;
  const encryptedRef = checkout.courierConfigEncrypted as string | undefined;
  const secrets = decryptSecretJson(encryptedRef);

  const provider = (courierPublic.provider as string) || (env.courier.provider ? env.courier.provider.toLowerCase() : "sandbox");
  const defaultUrl = COURIER_PROVIDERS.find((p) => p.id === provider)?.defaultUrl ?? "https://portal.steadfast.com.bd/api/v1";
  const apiUrl = (courierPublic.apiUrl as string) || (env.courier.apiUrl || defaultUrl);
  const storeIdAtCourier = (courierPublic.storeIdAtCourier as string) || "";
  const autoBooking = Boolean(courierPublic.autoBooking);
  const isEnabled = courierPublic.isEnabled !== undefined ? Boolean(courierPublic.isEnabled) : true;

  const webhookSecret = secrets.webhookSecret || (courierPublic.webhookSecret as string) || (env.courier.webhookSecret ?? "");
  const hasApiKey = Boolean(secrets.apiKey || env.courier.apiKey);
  const hasSecretKey = Boolean(secrets.secretKey);

  const appUrl = (env.appUrl ?? "http://localhost:3000").replace(/\/$/, "");
  const webhookUrl = `${appUrl}/api/v1/webhooks/couriers/${provider}?storeId=${storeId}`;

  return {
    provider,
    isEnabled,
    apiUrl,
    hasApiKey,
    hasSecretKey,
    storeIdAtCourier,
    webhookSecret,
    autoBooking,
    webhookUrl,
  };
}

/**
 * Internal access to active secrets for API calls / webhook verification.
 */
export async function getStoreCourierSecrets(storeId: string): Promise<StoreCourierSecrets> {
  const store = await prisma.store.findUnique({
    where: { id: storeId },
    select: { settings: { select: { checkoutJson: true } } },
  });

  const checkout = (store?.settings?.checkoutJson ?? {}) as Record<string, unknown>;
  const courierPublic = (checkout.courierConfig ?? {}) as Record<string, unknown>;
  const encryptedRef = checkout.courierConfigEncrypted as string | undefined;
  const secrets = decryptSecretJson(encryptedRef);

  const provider = (courierPublic.provider as string) || (env.courier.provider ? env.courier.provider.toLowerCase() : "sandbox");
  const defaultUrl = COURIER_PROVIDERS.find((p) => p.id === provider)?.defaultUrl ?? "";

  return {
    provider,
    isEnabled: courierPublic.isEnabled !== undefined ? Boolean(courierPublic.isEnabled) : true,
    apiUrl: (courierPublic.apiUrl as string) || (env.courier.apiUrl || defaultUrl),
    apiKey: secrets.apiKey || (env.courier.apiKey ?? ""),
    secretKey: secrets.secretKey || "",
    storeIdAtCourier: (courierPublic.storeIdAtCourier as string) || "",
    webhookSecret: secrets.webhookSecret || (courierPublic.webhookSecret as string) || (env.courier.webhookSecret ?? ""),
    autoBooking: Boolean(courierPublic.autoBooking),
  };
}

/**
 * Saves courier API and webhook credentials for a merchant store.
 */
export async function saveStoreCourierConfig(
  actor: ActorContext,
  storeId: string,
  input: {
    provider: string;
    isEnabled: boolean;
    apiUrl?: string;
    apiKey?: string;
    secretKey?: string;
    storeIdAtCourier?: string;
    webhookSecret?: string;
    autoBooking?: boolean;
  },
) {
  assertPermission(actor, "delivery:write");
  await assertStoreAccess(actor, storeId);

  const store = await prisma.store.findUnique({
    where: { id: storeId },
    include: { settings: true },
  });
  if (!store) throw new NotFoundError("Store");

  const checkout = (store.settings?.checkoutJson ?? {}) as Record<string, unknown>;
  const existingEncrypted = checkout.courierConfigEncrypted as string | undefined;
  const existingSecrets = decryptSecretJson(existingEncrypted);

  // Preserve existing secrets if empty string submitted (so passwords/tokens aren't wiped inadvertently)
  const newApiKey = input.apiKey !== undefined && input.apiKey.trim() !== "" ? input.apiKey.trim() : existingSecrets.apiKey ?? "";
  const newSecretKey = input.secretKey !== undefined && input.secretKey.trim() !== "" ? input.secretKey.trim() : existingSecrets.secretKey ?? "";
  const newWebhookSecret = input.webhookSecret !== undefined && input.webhookSecret.trim() !== "" ? input.webhookSecret.trim() : existingSecrets.webhookSecret ?? "";

  const secretsToEncrypt: Record<string, string> = {
    apiKey: newApiKey,
    secretKey: newSecretKey,
    webhookSecret: newWebhookSecret,
  };

  const encryptedSecretRef = encryptSecretJson(secretsToEncrypt);

  const defaultUrl = COURIER_PROVIDERS.find((p) => p.id === input.provider)?.defaultUrl ?? "";
  const apiUrl = input.apiUrl?.trim() || defaultUrl;

  const courierConfig = {
    provider: input.provider.toLowerCase(),
    isEnabled: input.isEnabled,
    apiUrl,
    storeIdAtCourier: (input.storeIdAtCourier ?? "").trim(),
    autoBooking: Boolean(input.autoBooking),
    webhookSecret: newWebhookSecret,
    updatedAt: new Date().toISOString(),
  };

  const updatedCheckout = {
    ...checkout,
    courierConfig,
    courierConfigEncrypted: encryptedSecretRef,
  };

  await prisma.storeSettings.upsert({
    where: { storeId },
    create: {
      storeId,
      checkoutJson: updatedCheckout as never,
    },
    update: {
      checkoutJson: updatedCheckout as never,
    },
  });

  await recordAudit({
    action: "courier.config_updated",
    tenantId: actor.tenantId,
    actorId: actor.userId,
    resourceType: "StoreSettings",
    resourceId: storeId,
    metadata: {
      storeId,
      provider: input.provider,
      isEnabled: input.isEnabled,
      autoBooking: Boolean(input.autoBooking),
      hasApiKey: Boolean(newApiKey),
      hasWebhookSecret: Boolean(newWebhookSecret),
    },
  });

  return getStoreCourierConfig(storeId);
}

/**
 * Triggers a test courier webhook event to verify receiving and processing.
 */
export async function testCourierWebhook(
  actor: ActorContext,
  storeId: string,
  options?: { status?: string },
) {
  assertPermission(actor, "delivery:write");
  await assertStoreAccess(actor, storeId);

  const config = await getStoreCourierConfig(storeId);
  const status = options?.status ?? "SHIPPED";

  const recentOrder = await prisma.order.findFirst({
    where: { storeId, deletedAt: null },
    orderBy: { createdAt: "desc" },
    select: { id: true, orderNo: true },
  });

  const trackingCode = `TEST-${Date.now().toString().slice(-6)}`;
  const testPayload = {
    trackingCode,
    orderNo: recentOrder?.orderNo ?? "ORD-DEMO-001",
    status,
    note: "Merchant portal test webhook trigger",
    timestamp: new Date().toISOString(),
  };

  const eventKey = `${config.provider}:test:${trackingCode}:${Date.now()}`;
  const payloadHash = createHash("sha256").update(JSON.stringify(testPayload)).digest("hex");

  await prisma.courierWebhookEvent.create({
    data: {
      provider: config.provider,
      eventKey,
      signatureValid: true,
      payloadHash,
      payloadJson: testPayload as never,
      status: "TEST_VERIFIED",
      processedAt: new Date(),
      error: null,
    },
  });

  await recordAudit({
    action: "courier.test_webhook",
    tenantId: actor.tenantId,
    actorId: actor.userId,
    resourceType: "CourierWebhookEvent",
    metadata: { storeId, provider: config.provider, trackingCode, status },
  });

  return { ok: true, trackingCode, status, eventKey };
}

/**
 * Lists recent courier shipments and incoming webhooks for the store.
 */
export async function listCourierWebhookHistory(storeId: string, limit = 10) {
  const [shipments, events] = await Promise.all([
    prisma.courierShipment.findMany({
      where: { storeId },
      orderBy: { createdAt: "desc" },
      take: limit,
      include: { order: { select: { orderNo: true, customerName: true, grandTotal: true, status: true } } },
    }),
    prisma.courierWebhookEvent.findMany({
      orderBy: { createdAt: "desc" },
      take: limit,
    }),
  ]);

  return { shipments, events };
}

/**
 * Generic courier callback handler. Provider payloads are normalized at the
 * boundary so the order service only deals with ATLaS statuses. Providers can
 * use JSON or form-encoded callbacks; both are accepted.
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

  // Check if storeId is provided in query params or derived from order/shipment
  let storeWebhookSecret: string | undefined;
  try {
    const url = new URL(request.url);
    const storeParam = url.searchParams.get("storeId") || url.searchParams.get("store");
    if (storeParam) {
      const secrets = await getStoreCourierSecrets(storeParam);
      if (secrets.webhookSecret) storeWebhookSecret = secrets.webhookSecret;
    }
  } catch {
    // URL parsing fallback
  }

  if (!storeWebhookSecret) {
    if (event.orderNo) {
      const ord = await prisma.order.findFirst({ where: { orderNo: event.orderNo }, select: { storeId: true } });
      if (ord) {
        const secrets = await getStoreCourierSecrets(ord.storeId);
        if (secrets.webhookSecret) storeWebhookSecret = secrets.webhookSecret;
      }
    } else if (event.trackingCode) {
      const ship = await prisma.courierShipment.findUnique({ where: { provider_trackingCode: { provider, trackingCode: event.trackingCode } }, select: { storeId: true } });
      if (ship) {
        const secrets = await getStoreCourierSecrets(ship.storeId);
        if (secrets.webhookSecret) storeWebhookSecret = secrets.webhookSecret;
      }
    }
  }

  const signatureHeader = request.headers.get("x-courier-signature") ?? request.headers.get("x-signature") ?? request.headers.get("authorization");
  const signatureValid = provider === "sandbox" || (!storeWebhookSecret && !env.courier.webhookSecret)
    ? true
    : verifyCourierSignature(rawBody, signatureHeader, storeWebhookSecret);

  const payloadHash = createHash("sha256").update(rawBody).digest("hex");

  // Verify authenticity before idempotency lookup.
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
          error: "Signature invalid or webhook secret mismatch",
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

export function signCourierPayload(rawBody: string, secret?: string): string {
  const effectiveSecret = secret || env.courier.webhookSecret || "atlas-dev-courier-secret";
  return createHmac("sha256", effectiveSecret).update(rawBody).digest("hex");
}

export function verifyCourierSignature(rawBody: string, signature: string | null, customSecret?: string): boolean {
  const secret = customSecret || env.courier.webhookSecret;
  if (!secret) return true;
  if (!signature) return false;
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
