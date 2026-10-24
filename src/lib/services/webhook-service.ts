import { createHash, createHmac, randomBytes, randomUUID } from "node:crypto";
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { prisma } from "@/lib/db";
import { NotFoundError, ValidationError } from "@/lib/errors";
import { assertPermission, type ActorContext } from "@/lib/rbac";
import { recordAudit } from "@/lib/audit";
import { decryptSecretJson, encryptSecretJson } from "@/lib/secrets";

export const MERCHANT_WEBHOOK_EVENTS = [
  "order.created",
  "order.status_changed",
  "payment.succeeded",
  "payment.failed",
  "shipment.created",
  "shipment.updated",
] as const;

export type MerchantWebhookEvent = (typeof MERCHANT_WEBHOOK_EVENTS)[number];
const MAX_ATTEMPTS = 8;
const DELIVERY_TIMEOUT_MS = 10_000;

type EndpointInput = {
  name: string;
  url: string;
  eventTypes: MerchantWebhookEvent[];
  isActive?: boolean;
};

export function validateWebhookUrl(value: string): string {
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new ValidationError("Webhook URL সঠিক নয়।");
  }
  if (!['https:', 'http:'].includes(parsed.protocol)) {
    throw new ValidationError("Webhook URL-এ http বা https ব্যবহার করুন।");
  }
  return parsed.toString();
}

export async function createWebhookEndpoint(actor: ActorContext, input: EndpointInput) {
  assertPermission(actor, "settings:write");
  const url = validateWebhookUrl(input.url);
  const secret = `whsec_${randomBytes(24).toString("base64url")}`;
  const endpoint = await prisma.webhookEndpoint.create({
    data: {
      tenantId: actor.tenantId,
      name: input.name,
      url,
      encryptedSecretRef: encryptSecretJson({ secret }),
      eventTypes: input.eventTypes,
      isActive: input.isActive ?? true,
    },
  });
  await recordAudit({
    action: "webhook_endpoint.created",
    tenantId: actor.tenantId,
    actorId: actor.userId,
    resourceType: "WebhookEndpoint",
    resourceId: endpoint.id,
    metadata: { name: endpoint.name, url: endpoint.url, eventTypes: endpoint.eventTypes },
  });
  return { ...safeEndpoint(endpoint), secret };
}

export async function listWebhookEndpoints(actor: ActorContext) {
  assertPermission(actor, "settings:read");
  const endpoints = await prisma.webhookEndpoint.findMany({
    where: { tenantId: actor.tenantId },
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { deliveries: true } } },
  });
  return endpoints.map((endpoint) => ({ ...safeEndpoint(endpoint), deliveryCount: endpoint._count.deliveries }));
}

export async function updateWebhookEndpoint(
  actor: ActorContext,
  endpointId: string,
  input: Partial<EndpointInput> & { rotateSecret?: boolean },
) {
  assertPermission(actor, "settings:write");
  const existing = await prisma.webhookEndpoint.findFirst({ where: { id: endpointId, tenantId: actor.tenantId } });
  if (!existing) throw new NotFoundError("Webhook endpoint");

  const secret = input.rotateSecret ? `whsec_${randomBytes(24).toString("base64url")}` : undefined;
  const updated = await prisma.webhookEndpoint.update({
    where: { id: endpointId },
    data: {
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.url !== undefined ? { url: validateWebhookUrl(input.url) } : {}),
      ...(input.eventTypes !== undefined ? { eventTypes: input.eventTypes } : {}),
      ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
      ...(secret ? { encryptedSecretRef: encryptSecretJson({ secret }) } : {}),
    },
  });
  await recordAudit({
    action: "webhook_endpoint.updated",
    tenantId: actor.tenantId,
    actorId: actor.userId,
    resourceType: "WebhookEndpoint",
    resourceId: endpointId,
    metadata: { name: updated.name, isActive: updated.isActive, rotatedSecret: Boolean(secret) },
  });
  return { ...safeEndpoint(updated), ...(secret ? { secret } : {}) };
}

export async function deleteWebhookEndpoint(actor: ActorContext, endpointId: string) {
  assertPermission(actor, "settings:write");
  const endpoint = await prisma.webhookEndpoint.findFirst({ where: { id: endpointId, tenantId: actor.tenantId } });
  if (!endpoint) throw new NotFoundError("Webhook endpoint");
  await prisma.webhookEndpoint.delete({ where: { id: endpointId } });
  await recordAudit({
    action: "webhook_endpoint.deleted",
    tenantId: actor.tenantId,
    actorId: actor.userId,
    resourceType: "WebhookEndpoint",
    resourceId: endpointId,
    metadata: { name: endpoint.name, url: endpoint.url },
  });
  return { id: endpointId, deleted: true };
}

/** Enqueue one signed delivery for every active endpoint subscribed to the event. */
export async function enqueueMerchantWebhook(input: {
  tenantId: string;
  eventType: MerchantWebhookEvent;
  data: Record<string, unknown>;
}) {
  const endpoints = await prisma.webhookEndpoint.findMany({
    where: { tenantId: input.tenantId, isActive: true },
  });
  const subscribed = endpoints.filter((endpoint) => endpoint.eventTypes.length === 0 || endpoint.eventTypes.includes(input.eventType));
  if (subscribed.length === 0) return [];

  const payload = {
    id: `evt_${randomUUID()}`,
    event: input.eventType,
    createdAt: new Date().toISOString(),
    data: input.data,
  };
  const payloadJson = payload as never;
  const payloadHash = createHash("sha256").update(JSON.stringify(payload)).digest("hex");
  const rows = await prisma.$transaction(
    subscribed.map((endpoint) =>
      prisma.webhookDelivery.create({
        data: {
          tenantId: input.tenantId,
          endpointId: endpoint.id,
          eventType: input.eventType,
          endpoint: endpoint.url,
          payloadJson,
          payloadHash,
          status: "PENDING",
        },
      }),
    ),
  );
  return rows.map((row) => row.id);
}

/** Event emission must never roll back a successful order/payment transition. */
export async function emitMerchantWebhook(input: Parameters<typeof enqueueMerchantWebhook>[0]) {
  try {
    return await enqueueMerchantWebhook(input);
  } catch (error) {
    console.error("[merchant-webhook] enqueue failed", error);
    return [];
  }
}

export async function createTestWebhookDelivery(actor: ActorContext, endpointId: string) {
  assertPermission(actor, "settings:write");
  const endpoint = await prisma.webhookEndpoint.findFirst({ where: { id: endpointId, tenantId: actor.tenantId } });
  if (!endpoint) throw new NotFoundError("Webhook endpoint");
  const payload = {
    id: `evt_test_${randomUUID()}`,
    event: "webhook.test",
    createdAt: new Date().toISOString(),
    data: { message: "ATLaS webhook connection test" },
  };
  const delivery = await prisma.webhookDelivery.create({
    data: {
      tenantId: actor.tenantId,
      endpointId: endpoint.id,
      eventType: "webhook.test",
      endpoint: endpoint.url,
      payloadJson: payload as never,
      payloadHash: createHash("sha256").update(JSON.stringify(payload)).digest("hex"),
      status: "PENDING",
    },
  });
  const result = await deliverWebhookDelivery(delivery.id);
  return { deliveryId: delivery.id, ...result };
}

export async function deliverPendingWebhooks(limit = 50) {
  const now = new Date();
  const candidates = await prisma.webhookDelivery.findMany({
    where: {
      status: { in: ["PENDING", "FAILED"] },
      attempts: { lt: MAX_ATTEMPTS },
      OR: [{ nextRetryAt: null }, { nextRetryAt: { lte: now } }],
    },
    orderBy: { createdAt: "asc" },
    take: limit,
    select: { id: true },
  });
  const results = [];
  for (const candidate of candidates) results.push(await deliverWebhookDelivery(candidate.id));
  return results;
}

export async function deliverWebhookDelivery(deliveryId: string) {
  const claimed = await prisma.webhookDelivery.updateMany({
    where: {
      id: deliveryId,
      status: { in: ["PENDING", "FAILED"] },
      attempts: { lt: MAX_ATTEMPTS },
      OR: [{ nextRetryAt: null }, { nextRetryAt: { lte: new Date() } }],
    },
    data: { status: "PROCESSING", attempts: { increment: 1 } },
  });
  if (claimed.count !== 1) {
    const current = await prisma.webhookDelivery.findUnique({ where: { id: deliveryId }, select: { id: true, status: true, attempts: true } });
    return { id: deliveryId, status: current?.status ?? "NOT_FOUND", attempts: current?.attempts ?? 0 };
  }

  const delivery = await prisma.webhookDelivery.findUnique({
    where: { id: deliveryId },
    include: { webhookEndpoint: true },
  });
  if (!delivery) return { id: deliveryId, status: "NOT_FOUND", attempts: 0 };
  if (!delivery.webhookEndpoint?.isActive) {
    await prisma.webhookDelivery.update({ where: { id: deliveryId }, data: { status: "DEAD", lastError: "Webhook endpoint is inactive" } });
    return { id: deliveryId, status: "DEAD", attempts: delivery.attempts };
  }

  const body = JSON.stringify(delivery.payloadJson);
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const secret = decryptSecretJson(delivery.webhookEndpoint.encryptedSecretRef).secret;
  if (!secret) return markDeliveryFailure(delivery, "Webhook secret could not be decrypted");
  const signature = createHmac("sha256", secret).update(`${timestamp}.${body}`).digest("hex");

  try {
    await assertSafeWebhookTarget(delivery.webhookEndpoint.url);
    const response = await fetch(delivery.webhookEndpoint.url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "user-agent": "ATLaS-Webhooks/1.0",
        "x-atlas-delivery-id": delivery.id,
        "x-atlas-event": delivery.eventType,
        "x-atlas-timestamp": timestamp,
        "x-atlas-signature": `sha256=${signature}`,
      },
      body,
      signal: AbortSignal.timeout(DELIVERY_TIMEOUT_MS),
    });
    if (!response.ok) throw new Error(`Merchant endpoint returned HTTP ${response.status}`);
    await prisma.webhookDelivery.update({ where: { id: delivery.id }, data: { status: "DELIVERED", deliveredAt: new Date(), lastError: null, nextRetryAt: null } });
    return { id: delivery.id, status: "DELIVERED", attempts: delivery.attempts };
  } catch (error) {
    return markDeliveryFailure(delivery, error instanceof Error ? error.message : "Webhook delivery failed");
  }
}

async function assertSafeWebhookTarget(value: string) {
  const url = new URL(value);
  if (process.env.NODE_ENV !== "production") return;
  if (url.protocol !== "https:") throw new Error("Production merchant webhooks must use HTTPS");
  const host = url.hostname.toLowerCase();
  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local")) {
    throw new Error("Private webhook host is not allowed in production");
  }
  const addresses = isIP(host) ? [{ address: host }] : await lookup(host, { all: true });
  if (addresses.some(({ address }) => isPrivateAddress(address))) {
    throw new Error("Private webhook address is not allowed in production");
  }
}

function isPrivateAddress(address: string) {
  if (isIP(address) === 6) {
    const value = address.toLowerCase();
    return value === "::1" || value.startsWith("fc") || value.startsWith("fd") || value.startsWith("fe8") || value.startsWith("fe9") || value.startsWith("fea") || value.startsWith("feb");
  }
  const octets = address.split(".").map(Number);
  if (octets.length !== 4 || octets.some((octet) => !Number.isInteger(octet))) return true;
  const [a, b] = octets;
  return a === 0 || a === 10 || a === 127 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168);
}

async function markDeliveryFailure(delivery: { id: string; attempts: number }, reason: string) {
  const dead = delivery.attempts >= MAX_ATTEMPTS;
  const delay = Math.min(60 * 60 * 1000, 2 ** Math.max(delivery.attempts - 1, 0) * 1000);
  const updated = await prisma.webhookDelivery.update({
    where: { id: delivery.id },
    data: {
      status: dead ? "DEAD" : "FAILED",
      lastError: reason.slice(0, 1000),
      nextRetryAt: dead ? null : new Date(Date.now() + delay),
    },
  });
  return { id: updated.id, status: updated.status, attempts: updated.attempts, error: reason };
}

function safeEndpoint(endpoint: {
  id: string;
  name: string;
  url: string;
  eventTypes: string[];
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: endpoint.id,
    name: endpoint.name,
    url: endpoint.url,
    eventTypes: endpoint.eventTypes,
    isActive: endpoint.isActive,
    createdAt: endpoint.createdAt,
    updatedAt: endpoint.updatedAt,
  };
}
