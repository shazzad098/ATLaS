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
 * Steadfast courier API.
 *
 * Live mode needs `STEADFAST_API_KEY` + `STEADFAST_SECRET_KEY`; the merchant's
 * Steadfast account store id is recorded on the delivery method for reference.
 */

function configured(): boolean {
  return env.courier.steadfast.configured;
}

function eventsFrom(data: Record<string, unknown>, rawStatus: string): CourierEvent[] {
  const rows = Array.isArray(data.events) ? data.events : [];

  const events = rows.map((row) => {
    const entry = record(row);
    const status = normalizeShipmentStatus(entry.status ?? entry.delivery_status, "IN_TRANSIT");
    return makeEvent(
      status,
      text(entry.message ?? entry.status) || "Steadfast আপডেট",
      text(entry.created_at ?? entry.updated_at ?? entry.time) || undefined,
      text(entry.id) || undefined,
    );
  });

  return events.length > 0
    ? events
    : [
        makeEvent(
          normalizeShipmentStatus(rawStatus, "IN_TRANSIT"),
          `Steadfast: ${rawStatus || "status update"}`,
        ),
      ];
}

export const steadfastAdapter: CourierAdapter = {
  provider: "STEADFAST",
  label: "Steadfast",
  notes: "Steadfast API — server-side API key and secret key are configured at the platform level.",
  isConfigured: configured,
  mode() {
    return resolveCourierMode("STEADFAST", configured());
  },

  async createShipment(input: CourierShipmentInput): Promise<CourierCreateResult> {
    if (this.mode() === "sandbox") {
      const ids = sandboxIds("STEADFAST", input.orderNo);
      return {
        ...ids,
        status: "PENDING",
        sandbox: true,
        raw: { sandbox: true, events: sandboxCreateEvents("STEADFAST", input, ids.consignmentId) },
      };
    }

    const response = await courierFetchJson("STEADFAST", `${env.courier.steadfast.baseUrl}/create_order`, {
      method: "POST",
      headers: {
        "Api-Key": env.courier.steadfast.apiKey,
        "Secret-Key": env.courier.steadfast.secretKey,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        invoice: input.orderNo,
        recipient_name: input.recipientName,
        recipient_phone: input.recipientPhone,
        recipient_address: input.recipientAddress,
        cod_amount: Number(input.codAmount || 0),
        note: input.note ?? "",
        item_description: input.itemDescription ?? "অর্ডার",
      }),
    });

    const data = record(field(response, "consignment") ?? field(response, "data") ?? response);
    const consignmentId = text(data.consignment_id);
    const trackingCode = text(data.tracking_code) || consignmentId;
    if (!consignmentId) {
      throw new CourierAdapterError("Steadfast consignment id ফেরত দেয়নি।", "STEADFAST", { response });
    }

    return {
      consignmentId,
      trackingCode,
      status: normalizeShipmentStatus(data.status, "PENDING"),
      sandbox: false,
      raw: record(response),
    };
  },

  async track(input: CourierTrackInput): Promise<CourierTrackResult> {
    if (this.mode() === "sandbox") {
      const advanced = sandboxAdvance("STEADFAST", input.consignmentId, input.advanceFrom);
      return { ...advanced, sandbox: true };
    }

    const response = await courierFetchJson(
      "STEADFAST",
      `${env.courier.steadfast.baseUrl}/status_by_cid/${encodeURIComponent(input.consignmentId)}`,
      {
        headers: {
          "Api-Key": env.courier.steadfast.apiKey,
          "Secret-Key": env.courier.steadfast.secretKey,
        },
      },
    );
    const data = record(field(response, "data") ?? response);
    const rawStatus = text(data.delivery_status ?? data.status);
    return {
      status: normalizeShipmentStatus(rawStatus, "IN_TRANSIT"),
      events: eventsFrom(data, rawStatus),
      sandbox: false,
      raw: record(response),
    };
  },
};
