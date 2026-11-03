import { randomBytes } from "node:crypto";
import type {
  CourierEvent,
  CourierProviderName,
  CourierShipmentInput,
  ShipmentStatusValue,
} from "@/lib/couriers/types";
import { makeEvent } from "@/lib/couriers/events";

/** Deterministic-enough fake consignments for sandbox mode. */

const PREFIX: Record<CourierProviderName, string> = {
  PATHAO: "PTH",
  REDX: "RDX",
  STEADFAST: "SFD",
};

export function sandboxIds(provider: CourierProviderName, orderNo: string) {
  const suffix = randomBytes(3).toString("hex").toUpperCase();
  const clean = orderNo.replace(/[^A-Za-z0-9]/g, "").slice(-10) || "ORDER";
  return {
    consignmentId: `${PREFIX[provider]}-SBX-${clean}-${suffix}`,
    trackingCode: `${PREFIX[provider]}SBX${clean}${suffix}`,
  };
}

export function sandboxCreateEvents(
  provider: CourierProviderName,
  input: CourierShipmentInput,
  consignmentId: string,
): CourierEvent[] {
  return [
    makeEvent(
      "PENDING",
      `Sandbox: ${provider}-এ কনসাইনমেন্ট তৈরি হয়েছে (${consignmentId}) — ${input.recipientName}, ৳${input.codAmount}`,
    ),
  ];
}

/** Each sync advances one step; terminal statuses stay put. */
const FLOW: ShipmentStatusValue[] = ["PENDING", "PICKED_UP", "IN_TRANSIT", "OUT_FOR_DELIVERY", "DELIVERED"];

export function sandboxAdvance(
  provider: CourierProviderName,
  consignmentId: string,
  from: ShipmentStatusValue | undefined,
): { status: ShipmentStatusValue; events: CourierEvent[] } {
  const currentIndex = FLOW.indexOf(from ?? "PENDING");
  if (currentIndex === -1) {
    // A terminal status (RETURNED/CANCELLED/FAILED) — sandbox does not move it.
    return { status: from ?? "DELIVERED", events: [] };
  }
  const next = FLOW[Math.min(currentIndex + 1, FLOW.length - 1)];
  return {
    status: next,
    events: [
      makeEvent(next, `Sandbox: ${provider} ট্র্যাকিং আপডেট — ${next} (${consignmentId})`),
    ],
  };
}
