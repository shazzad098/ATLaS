import { env } from "@/lib/env";
import { courierFetchJson } from "@/lib/couriers/http";
import { resolveCourierMode } from "@/lib/couriers/mode";
import { sandboxAdvance, sandboxCreateEvents, sandboxIds } from "@/lib/couriers/sandbox";
import { normalizeShipmentStatus } from "@/lib/couriers/status";
import { makeEvent } from "@/lib/couriers/events";
import {
  CourierAdapterError,
  field,
  record,
  text,
  type CourierAdapter,
  type CourierCreateResult,
  type CourierEvent,
  type CourierShipmentInput,
  type CourierTrackInput,
  type CourierTrackResult,
} from "@/lib/couriers/types";

/**
 * Pathao merchant API.
 *
 * Live mode needs `PATHAO_CLIENT_ID/SECRET/USERNAME/PASSWORD`; the merchant's
 * own Pathao store id comes from Admin → ডেলিভারি. Token is cached per process
 * until shortly before it expires.
 */

let tokenCache: { token: string; expiresAt: number } | null = null;

function configured(): boolean {
  return env.courier.pathao.configured;
}

async function accessToken(): Promise<string> {
  const { baseUrl, clientId, clientSecret, username, password } = env.courier.pathao;
  if (tokenCache && tokenCache.expiresAt > Date.now() + 30_000) return tokenCache.token;

  const response = await courierFetchJson("PATHAO", `${baseUrl}/aladdin/api/v1/issue-token`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      client_id: clientId,
      client_secret: clientSecret,
      username,
      password,
      grant_type: "password",
    }),
  });

  const token = text(field(response, "access_token")) || text(field(response, "data", "access_token"));
  if (!token) {
    throw new CourierAdapterError("Pathao token পাওয়া যায়নি — credentials যাচাই করুন।", "PATHAO", {
      response,
    });
  }
  const expiresIn = Number(field(response, "expires_in") ?? field(response, "data", "expires_in") ?? 3600);
  tokenCache = { token, expiresAt: Date.now() + Math.max(60, expiresIn) * 1000 };
  return token;
}

function eventsFrom(data: Record<string, unknown>, fallbackStatus: string): CourierEvent[] {
  const logs = Array.isArray(data.order_logs)
    ? data.order_logs
    : Array.isArray(data.events)
      ? data.events
      : Array.isArray(field(data, "data", "order_logs"))
        ? (field(data, "data", "order_logs") as unknown[])
        : [];

  const events = logs
    .map((row) => {
      const entry = record(row);
      const status = normalizeShipmentStatus(entry.order_status ?? entry.status, "IN_TRANSIT");
      const message = text(entry.message ?? entry.order_status ?? entry.status) || "Pathao আপডেট";
      const when = text(entry.created_at ?? entry.updated_at ?? entry.time);
      return makeEvent(status, message, when || undefined, text(entry.id) || undefined);
    })
    .filter(Boolean) as CourierEvent[];

  if (events.length > 0) return events;
  return [makeEvent(normalizeShipmentStatus(fallbackStatus, "IN_TRANSIT"), `Pathao: ${fallbackStatus || "status update"}`)];
}

export const pathaoAdapter: CourierAdapter = {
  provider: "PATHAO",
  label: "Pathao",
  notes: "Pathao merchant API — store id needed from the Pathao merchant panel.",
  isConfigured: configured,
  mode() {
    return resolveCourierMode("PATHAO", configured());
  },

  async createShipment(input: CourierShipmentInput): Promise<CourierCreateResult> {
    if (this.mode() === "sandbox") {
      const ids = sandboxIds("PATHAO", input.orderNo);
      return {
        ...ids,
        status: "PENDING",
        sandbox: true,
        raw: { sandbox: true, events: sandboxCreateEvents("PATHAO", input, ids.consignmentId) },
      };
    }

    const token = await accessToken();
    const storeId = Number(input.courierStoreId);
    if (!Number.isFinite(storeId)) {
      throw new CourierAdapterError("Pathao store id সংখ্যা হতে হবে।", "PATHAO", {
        courierStoreId: input.courierStoreId,
      });
    }

    const response = await courierFetchJson("PATHAO", `${env.courier.pathao.baseUrl}/aladdin/api/v1/orders`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        store_id: storeId,
        merchant_order_id: input.orderNo,
        recipient_name: input.recipientName,
        recipient_phone: input.recipientPhone,
        recipient_address: input.recipientAddress,
        recipient_city: Number(env.courier.pathao.defaultCityId),
        recipient_zone: Number(env.courier.pathao.defaultZoneId),
        delivery_type: 48,
        item_type: 2,
        special_instruction: input.note ?? "",
        item_quantity: input.itemQuantity ?? 1,
        item_weight: "0.5",
        amount_to_collect: Number(input.codAmount || 0),
        item_description: input.itemDescription ?? "অর্ডার",
      }),
    });

    const data = record(field(response, "data") ?? response);
    const consignmentId = text(data.consignment_id) || text(data.order_id);
    const trackingCode = text(data.tracking_code) || consignmentId;
    if (!consignmentId) {
      throw new CourierAdapterError("Pathao consignment id ফেরত দেয়নি।", "PATHAO", { response });
    }

    return {
      consignmentId,
      trackingCode,
      status: normalizeShipmentStatus(data.order_status ?? data.status, "PENDING"),
      sandbox: false,
      raw: record(response),
    };
  },

  async track(input: CourierTrackInput): Promise<CourierTrackResult> {
    if (this.mode() === "sandbox") {
      const advanced = sandboxAdvance("PATHAO", input.consignmentId, input.advanceFrom);
      return { ...advanced, sandbox: true };
    }

    const token = await accessToken();
    const response = await courierFetchJson(
      "PATHAO",
      `${env.courier.pathao.baseUrl}/aladdin/api/v1/orders/${encodeURIComponent(input.consignmentId)}/info`,
      { headers: { authorization: `Bearer ${token}` } },
    );
    const data = record(field(response, "data") ?? response);
    const rawStatus = text(data.order_status ?? data.status);
    return {
      status: normalizeShipmentStatus(rawStatus, "IN_TRANSIT"),
      events: eventsFrom(data, rawStatus),
      sandbox: false,
      raw: record(response),
    };
  },
};
