import { createHmac, timingSafeEqual } from "node:crypto";
import { env } from "@/lib/env";
import { pathaoAdapter } from "@/lib/couriers/pathao";
import { redxAdapter } from "@/lib/couriers/redx";
import { steadfastAdapter } from "@/lib/couriers/steadfast";
import { normalizeShipmentStatus } from "@/lib/couriers/status";
import {
  CourierAdapterError,
  field,
  record,
  text,
  type CourierAdapter,
  type CourierMode,
  type CourierProviderName,
  type ShipmentStatusValue,
} from "@/lib/couriers/types";

const REGISTRY: Record<CourierProviderName, CourierAdapter> = {
  PATHAO: pathaoAdapter,
  REDX: redxAdapter,
  STEADFAST: steadfastAdapter,
};

export const COURIER_PROVIDER_NAMES = Object.keys(REGISTRY) as CourierProviderName[];

export function isCourierProvider(value: string): value is CourierProviderName {
  return (COURIER_PROVIDER_NAMES as string[]).includes(value);
}

export function getCourierAdapter(provider: string): CourierAdapter {
  const key = provider.toUpperCase() as CourierProviderName;
  const adapter = REGISTRY[key];
  if (!adapter) {
    throw new CourierAdapterError(`অজানা courier provider: ${provider}`, "PATHAO", {
      supported: COURIER_PROVIDER_NAMES,
    });
  }
  return adapter;
}

/** Merchant-facing status shown in Admin → ডেলিভারি and the order page. */
export function courierAdapterStatus(): Array<{
  provider: CourierProviderName;
  label: string;
  notes: string;
  configured: boolean;
  mode: CourierMode;
}> {
  return COURIER_PROVIDER_NAMES.map((provider) => {
    const adapter = REGISTRY[provider];
    let mode: CourierMode = env.courier.mode === "live" ? "live" : "sandbox";
    try {
      mode = adapter.mode();
    } catch {
      // COURIER_MODE=live with missing credentials — surfaced in the UI.
    }
    return {
      provider,
      label: adapter.label,
      notes: adapter.notes,
      configured: adapter.isConfigured(),
      mode,
    };
  });
}

// ── Webhook authenticity ─────────────────────────────────────────────────────

export const COURIER_SIGNATURE_HEADER = "x-atlas-signature";

export function signCourierWebhookPayload(rawBody: string): string {
  return createHmac("sha256", env.courier.webhookSecret || env.authSecret)
    .update(`courier:${rawBody}`)
    .digest("hex");
}

export function verifyCourierWebhookSignature(rawBody: string, signature: string | null): boolean {
  if (!signature) return false;
  const expected = Buffer.from(signCourierWebhookPayload(rawBody), "hex");
  const received = Buffer.from(signature, "hex");
  if (expected.length === 0 || expected.length !== received.length) return false;
  return timingSafeEqual(expected, received);
}

/**
 * Couriers POST to the public webhook. A dedicated `COURIER_WEBHOOK_SECRET`
 * authenticates the call (HMAC header, or `?token=` for providers that cannot
 * set headers). Without it, sandbox mode stays open in development only.
 */
export function authenticateCourierWebhook(
  rawBody: string,
  signature: string | null,
  token: string | null,
): { valid: boolean; configured: boolean } {
  const secret = env.courier.webhookSecret;
  if (!secret) return { valid: env.isDev, configured: false };
  if (signature && verifyCourierWebhookSignature(rawBody, signature)) {
    return { valid: true, configured: true };
  }
  if (token) {
    const expected = Buffer.from(secret);
    const received = Buffer.from(token);
    if (expected.length === received.length && timingSafeEqual(expected, received)) {
      return { valid: true, configured: true };
    }
  }
  return { valid: false, configured: true };
}

// ── Webhook payload normalization ────────────────────────────────────────────

export type NormalizedCourierWebhook = {
  consignmentId: string | null;
  trackingCode: string | null;
  /** Merchant order number, used as a fallback lookup key. */
  orderNo: string | null;
  status: ShipmentStatusValue;
  eventId: string | null;
  message: string;
  occurredAt: string | null;
  raw: Record<string, unknown>;
};

/**
 * Providers use different field names for the same fields. Read the known
 * variants and let the caller look up the shipment by consignment id *or*
 * tracking code.
 */
export function parseCourierWebhook(provider: CourierProviderName, rawBody: string): NormalizedCourierWebhook {
  let payload: Record<string, unknown> = {};
  try {
    const parsed = JSON.parse(rawBody || "{}");
    payload = record(parsed);
  } catch {
    throw new CourierAdapterError(`${provider} webhook body JSON নয়।`, provider);
  }

  const data = record(field(payload, "data") ?? field(payload, "consignment") ?? payload);

  const consignmentId =
    text(data.consignment_id) ||
    text(data.tracking_id) ||
    text(field(payload, "consignment", "consignment_id")) ||
    null;
  const trackingCode =
    text(data.tracking_code) || text(data.tracking_id) || text(data.consignment_id) || null;
  const orderNo =
    text(data.merchant_order_id) ||
    text(data.merchant_invoice_id) ||
    text(data.invoice) ||
    text(payload.merchant_order_id) ||
    null;

  const rawStatus =
    data.order_status ??
    data.delivery_status ??
    data.parcel_status ??
    data.status ??
    payload.order_status ??
    payload.delivery_status ??
    payload.parcel_status ??
    payload.status ??
    payload.event;

  if (!consignmentId && !trackingCode && !orderNo) {
    throw new CourierAdapterError(`${provider} webhook-এ consignment/tracking/order id নেই।`, provider, {
      payload,
    });
  }

  return {
    consignmentId,
    trackingCode,
    orderNo,
    status: normalizeShipmentStatus(rawStatus, "IN_TRANSIT"),
    eventId: text(data.event_id) || text(data.id) || text(payload.event_id) || null,
    message: text(data.message) || text(data.note) || `${provider}: ${text(rawStatus) || "status update"}`,
    occurredAt:
      text(data.updated_at) || text(data.occurred_at) || text(data.created_at) || text(data.time) || null,
    raw: payload,
  };
}

export type {
  CourierAdapter,
  CourierMode,
  CourierProviderName,
  ShipmentStatusValue,
} from "@/lib/couriers/types";
export { TERMINAL_SHIPMENT_STATUSES } from "@/lib/couriers/types";
export { normalizeShipmentStatus, statusLabel } from "@/lib/couriers/status";
