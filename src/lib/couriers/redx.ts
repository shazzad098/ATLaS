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
 * RedX open API.
 *
 * Live mode needs `REDX_API_TOKEN` and `REDX_DEFAULT_AREA_ID` (RedX requires a
 * numeric delivery-area id; map your main service area in `.env`). The merchant
 * store id is kept for reference but RedX does not use it in this endpoint.
 */

function configured(): boolean {
  return env.courier.redx.configured;
}

function eventsFrom(data: Record<string, unknown>, rawStatus: string): CourierEvent[] {
  const rows = Array.isArray(data.tracking_history)
    ? data.tracking_history
    : Array.isArray(data.events)
      ? data.events
      : Array.isArray(data.trackings)
        ? data.trackings
        : [];

  const events = rows.map((row) => {
    const entry = record(row);
    const status = normalizeShipmentStatus(entry.status ?? entry.parcel_status, "IN_TRANSIT");
    return makeEvent(
      status,
      text(entry.message ?? entry.status ?? entry.parcel_status) || "RedX আপডেট",
      text(entry.created_at ?? entry.updated_at ?? entry.time) || undefined,
      text(entry.id) || undefined,
    );
  });

  return events.length > 0
    ? events
    : [makeEvent(normalizeShipmentStatus(rawStatus, "IN_TRANSIT"), `RedX: ${rawStatus || "status update"}`)];
}

export const redxAdapter: CourierAdapter = {
  provider: "REDX",
  label: "RedX",
  notes: "RedX open API — API token and default delivery area id are configured at the platform level.",
  isConfigured: configured,
  mode() {
    return resolveCourierMode("REDX", configured());
  },

  async createShipment(input: CourierShipmentInput): Promise<CourierCreateResult> {
    if (this.mode() === "sandbox") {
      const ids = sandboxIds("REDX", input.orderNo);
      return {
        ...ids,
        status: "PENDING",
        sandbox: true,
        raw: { sandbox: true, events: sandboxCreateEvents("REDX", input, ids.consignmentId) },
      };
    }

    const areaId = Number(env.courier.redx.defaultAreaId);
    if (!Number.isFinite(areaId) || areaId <= 0) {
      throw new CourierAdapterError(
        "REDX_DEFAULT_AREA_ID সেট করা নেই — RedX live করতে numeric delivery area id দিন।",
        "REDX",
      );
    }

    const response = await courierFetchJson("REDX", `${env.courier.redx.baseUrl}/v1.0.0-beta/parcel`, {
      method: "POST",
      headers: {
        "API-ACCESS-TOKEN": env.courier.redx.apiToken,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        customer_name: input.recipientName,
        customer_phone: input.recipientPhone,
        delivery_area: input.recipientCity || "Dhaka",
        delivery_area_id: areaId,
        customer_address: input.recipientAddress,
        merchant_invoice_id: input.orderNo,
        cash_collection_amount: Number(input.codAmount || 0),
        parcel_weight: 0.5,
        value: Number(input.codAmount || 0),
        instruction: input.note ?? "",
      }),
    });

    const data = record(field(response, "data") ?? response);
    const consignmentId = text(data.tracking_id) || text(data.parcel_id) || text(data.id);
    if (!consignmentId) {
      throw new CourierAdapterError("RedX tracking id ফেরত দেয়নি।", "REDX", { response });
    }

    return {
      consignmentId,
      trackingCode: text(data.tracking_code) || consignmentId,
      status: normalizeShipmentStatus(data.status ?? data.parcel_status, "PENDING"),
      sandbox: false,
      raw: record(response),
    };
  },

  async track(input: CourierTrackInput): Promise<CourierTrackResult> {
    if (this.mode() === "sandbox") {
      const advanced = sandboxAdvance("REDX", input.consignmentId, input.advanceFrom);
      return { ...advanced, sandbox: true };
    }

    const response = await courierFetchJson(
      "REDX",
      `${env.courier.redx.baseUrl}/v1.0.0-beta/parcel/trackings/${encodeURIComponent(input.trackingCode)}`,
      { headers: { "API-ACCESS-TOKEN": env.courier.redx.apiToken } },
    );
    const data = record(field(response, "data") ?? response);
    const rawStatus = text(data.status ?? data.parcel_status ?? data.current_status);
    return {
      status: normalizeShipmentStatus(rawStatus, "IN_TRANSIT"),
      events: eventsFrom(data, rawStatus),
      sandbox: false,
      raw: record(response),
    };
  },
};
