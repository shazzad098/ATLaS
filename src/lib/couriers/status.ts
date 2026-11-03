import type { ShipmentStatusValue } from "@/lib/couriers/types";

/**
 * Provider status strings → one internal enum.
 *
 * Couriers all use slightly different labels ("In_Transit", "in transit",
 * "At_Sorting_Center", "out for delivery", …). Matching is done on a normalized
 * lowercase string with word separators collapsed, with ordered substring
 * fallbacks for new labels a provider may add later.
 */
const EXACT: Record<string, ShipmentStatusValue> = {
  pending: "PENDING",
  created: "PENDING",
  in_review: "PENDING",
  pickup_requested: "PENDING",
  approved: "PENDING",
  picked: "PICKED_UP",
  picked_up: "PICKED_UP",
  pickup: "PICKED_UP",
  in_transit: "IN_TRANSIT",
  transit: "IN_TRANSIT",
  at_sorting_center: "IN_TRANSIT",
  at_local_hub: "IN_TRANSIT",
  received_at_hub: "IN_TRANSIT",
  assigned_for_delivery: "OUT_FOR_DELIVERY",
  out_for_delivery: "OUT_FOR_DELIVERY",
  delivered: "DELIVERED",
  partial_delivery: "PARTIAL_DELIVERED",
  partially_delivered: "PARTIAL_DELIVERED",
  partial_delivered: "PARTIAL_DELIVERED",
  return: "RETURNED",
  returned: "RETURNED",
  return_to_merchant: "RETURNED",
  return_in_transit: "RETURNED",
  cancelled: "CANCELLED",
  canceled: "CANCELLED",
  failed: "FAILED",
  delivery_failed: "FAILED",
  pickup_failed: "FAILED",
  hold: "FAILED",
};

export function normalizeShipmentStatus(
  raw: unknown,
  fallback: ShipmentStatusValue = "IN_TRANSIT",
): ShipmentStatusValue {
  const key = String(raw ?? "")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
  if (!key) return fallback;
  const direct = EXACT[key];
  if (direct) return direct;

  if (key.includes("partial")) return "PARTIAL_DELIVERED";
  if (key.includes("out") && key.includes("deliver")) return "OUT_FOR_DELIVERY";
  if (key.includes("deliver")) return key.includes("fail") ? "FAILED" : "DELIVERED";
  if (key.includes("return")) return "RETURNED";
  if (key.includes("cancel")) return "CANCELLED";
  if (key.includes("transit") || key.includes("sorting") || key.includes("hub")) return "IN_TRANSIT";
  if (key.includes("pick")) return key.includes("fail") ? "FAILED" : "PICKED_UP";
  if (key.includes("fail")) return "FAILED";
  if (key.includes("pending") || key.includes("review") || key.includes("request")) return "PENDING";
  return fallback;
}

export function statusLabel(status: ShipmentStatusValue): string {
  return (
    {
      PENDING: "পিকআপের অপেক্ষায়",
      PICKED_UP: "পিকআপ হয়েছে",
      IN_TRANSIT: "ট্রানজিটে",
      OUT_FOR_DELIVERY: "ডেলিভারির পথে",
      DELIVERED: "ডেলিভার হয়েছে",
      PARTIAL_DELIVERED: "আংশিক ডেলিভারি",
      RETURNED: "ফেরত এসেছে",
      CANCELLED: "বাতিল",
      FAILED: "ব্যর্থ",
    } satisfies Record<ShipmentStatusValue, string>
  )[status];
}
