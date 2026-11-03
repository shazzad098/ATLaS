import { createHash, createHmac, randomBytes } from "node:crypto";
import { prisma } from "@/lib/db";
import { NotFoundError, ValidationError } from "@/lib/errors";
import { assertPermission, type ActorContext } from "@/lib/rbac";
import { assertApiAccess, requireWritableTenant } from "@/lib/entitlements";
import { recordAudit } from "@/lib/audit";
import { assertSafeWebhookUrl, webhookPolicy } from "@/lib/webhook-url";

/**
 * Outbound merchant webhooks (PRD §11.10).
 *
 * Delivery is best-effort and fully logged. A slow or broken endpoint must never
 * roll back an order, so every emit is wrapped and failures only update the
 * delivery row for the retry cron. Signing uses HMAC-SHA256 over
 * `<timestamp>.<raw body>` so receivers can reject replays.
 */

export const WEBHOOK_EVENTS = [
  "order.created",
  "order.paid",
  "order.shipped",
  "order.delivered",
  "order.cancelled",
  "order.refunded",
  "payment.received",
  "payment.failed",
  "return.requested",
] as const;

export type WebhookEvent = (typeof WEBHOOK_EVENTS)[number] | "*";

export const RETRY_DELAYS_MINUTES = [1, 5, 30, 120, 360];
const MAX_ATTEMPTS = RETRY_DELAYS_MINUTES.length + 1;
const DELIVERY_TIMEOUT_MS = 6_000;

export function webhookSignature(secret: string, timestamp: string, body: string): string {
  return `sha256=${createHmac("sha256", secret).update(`${timestamp}.${body}`).digest("hex")}`;
}

export async function createWebhookEndpoint(
  actor: ActorContext,
  input: { url: string; events: unknown },
): Promise<{ id: string; secret: string }> {
  assertPermission(actor, "settings:write");
  const snapshot = await requireWritableTenant(actor.tenantId);
  assertApiAccess(snapshot, "FULL");

  // HTTPS-only in production and never loopback/private/metadata addresses.
  const url = await assertSafeWebhookUrl(input.url, webhookPolicy());
  if (!Array.isArray(input.events) || input.events.length === 0) {
    throw new ValidationError("অন্তত একটি event নির্বাচন করুন।");
  }
  const allowed = new Set<string>([...WEBHOOK_EVENTS, "*"]);
  const events = [...new Set(input.events.map(String))].filter((event) => allowed.has(event));
  if (events.length === 0) throw new ValidationError("বৈধ event নির্বাচন করুন।");

  const secret = `whsec_${randomBytes(24).toString("base64url")}`;
  const created = await prisma.webhookEndpoint.create({
    data: {
      tenantId: actor.tenantId,
      url: url.toString(),
      secret,
      eventsJson: events as never,
    },
  });

  await recordAudit({
    action: "webhook.endpoint_created",
    tenantId: actor.tenantId,
    actorId: actor.userId,
    resourceType: "WebhookEndpoint",
    resourceId: created.id,
    metadata: { url: created.url, events },
  });

  return { id: created.id, secret };
}

export async function listWebhookEndpoints(tenantId: string) {
  const rows = await prisma.webhookEndpoint.findMany({
    where: { tenantId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      tenantId: true,
      url: true,
      eventsJson: true,
      status: true,
      failureCount: true,
      lastDeliveryAt: true,
      createdAt: true,
      updatedAt: true,
      _count: { select: { deliveries: true } },
      deliveries: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { status: true, createdAt: true },
      },
    },
  });
  return rows.map((row) => ({
    ...row,
    events: Array.isArray(row.eventsJson) ? (row.eventsJson as string[]) : [],
  }));
}

export async function deleteWebhookEndpoint(actor: ActorContext, endpointId: string): Promise<void> {
  assertPermission(actor, "settings:write");
  await requireWritableTenant(actor.tenantId);

  const row = await prisma.webhookEndpoint.findFirst({
    where: { id: endpointId, tenantId: actor.tenantId },
    select: { id: true, url: true },
  });
  if (!row) throw new NotFoundError("Webhook endpoint");

  await prisma.webhookEndpoint.delete({ where: { id: row.id } });
  await recordAudit({
    action: "webhook.endpoint_deleted",
    tenantId: actor.tenantId,
    actorId: actor.userId,
    resourceType: "WebhookEndpoint",
    resourceId: row.id,
    metadata: { url: row.url },
  });
}

async function deliverOnce(deliveryId: string): Promise<void> {
  const delivery = await prisma.webhookDelivery.findUnique({
    where: { id: deliveryId },
    include: { endpointRef: true },
  });
  if (!delivery || delivery.status === "DELIVERED" || delivery.status === "DEAD") return;
  if (!delivery.endpointRef || delivery.endpointRef.status !== "ACTIVE") {
    await prisma.webhookDelivery.update({
      where: { id: delivery.id },
      data: { status: "DEAD", lastError: "Endpoint removed or disabled" },
    });
    return;
  }

  const body = JSON.stringify(delivery.payloadJson);
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const attempts = delivery.attempts + 1;
  const endpointId = delivery.endpointRef.id;

  try {
    // Re-validate on every attempt: DNS can change after the endpoint was saved.
    const target = await assertSafeWebhookUrl(delivery.endpointRef.url, webhookPolicy());
    const response = await fetch(target, {
      method: "POST",
      // A redirect could bounce a public URL into the private network.
      redirect: "manual",
      headers: {
        "content-type": "application/json",
        "user-agent": "ATLaS-Webhooks/1.0",
        "x-atlas-event": delivery.eventType,
        "x-atlas-delivery": delivery.id,
        "x-atlas-timestamp": timestamp,
        "x-atlas-signature": webhookSignature(delivery.endpointRef.secret, timestamp, body),
      },
      body,
      signal: AbortSignal.timeout(DELIVERY_TIMEOUT_MS),
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      throw new Error(`HTTP ${response.status}: ${detail.slice(0, 200)}`);
    }

    await prisma.$transaction(async (tx) => {
      await tx.webhookDelivery.update({
        where: { id: delivery.id },
        data: {
          status: "DELIVERED",
          attempts,
          deliveredAt: new Date(),
          lastError: null,
          nextRetryAt: null,
        },
      });
      await tx.webhookEndpoint.update({
        where: { id: endpointId },
        data: { lastDeliveryAt: new Date(), failureCount: 0 },
      });
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Webhook delivery failed";
    const dead = attempts >= MAX_ATTEMPTS;
    const delay = RETRY_DELAYS_MINUTES[Math.min(attempts - 1, RETRY_DELAYS_MINUTES.length - 1)];
    await prisma.$transaction(async (tx) => {
      await tx.webhookDelivery.update({
        where: { id: delivery.id },
        data: {
          status: dead ? "DEAD" : "PENDING",
          attempts,
          lastError: message.slice(0, 300),
          nextRetryAt: dead ? null : new Date(Date.now() + delay * 60_000),
        },
      });
      await tx.webhookEndpoint.update({
        where: { id: endpointId },
        data: { failureCount: { increment: 1 } },
      });
    });
  }
}

/** Fan-out used by order/payment services. Never throws into the caller. */
export async function emitWebhookEvent(
  tenantId: string,
  eventType: WebhookEvent,
  payload: Record<string, unknown>,
): Promise<void> {
  try {
    const endpoints = await prisma.webhookEndpoint.findMany({
      where: { tenantId, status: "ACTIVE" },
    });
    const targets = endpoints.filter((endpoint) => {
      const events = Array.isArray(endpoint.eventsJson) ? (endpoint.eventsJson as string[]) : [];
      return events.includes("*") || events.includes(eventType);
    });
    if (targets.length === 0) return;

    const body = JSON.stringify(payload);
    const payloadHash = createHash("sha256").update(body).digest("hex");
    const deliveries = await Promise.all(
      targets.map((endpoint) =>
        prisma.webhookDelivery.create({
          data: {
            tenantId,
            webhookEndpointId: endpoint.id,
            eventType,
            endpoint: endpoint.url,
            payloadJson: payload as never,
            payloadHash,
          },
          select: { id: true },
        }),
      ),
    );

    await Promise.allSettled(deliveries.map((delivery) => deliverOnce(delivery.id)));
  } catch (error) {
    console.error("[webhook] emit failed", eventType, error);
  }
}

/** Cron entry point: retries deliveries whose backoff window has elapsed. */
export async function retryDueWebhooks(limit = 50): Promise<{ attempted: number }> {
  const rows = await prisma.webhookDelivery.findMany({
    where: {
      status: "PENDING",
      nextRetryAt: { lte: new Date() },
    },
    orderBy: { nextRetryAt: "asc" },
    take: limit,
    select: { id: true },
  });
  await Promise.allSettled(rows.map((row) => deliverOnce(row.id)));
  return { attempted: rows.length };
}
