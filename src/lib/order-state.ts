/**
 * Order state machine (PRD FR-04).
 *
 * Dependency-free on purpose: the transition table is the rule most likely to
 * regress, so it can be unit-tested (and reasoned about) without a database or a
 * Next.js runtime. `services/order-service.ts` re-exports everything here.
 */

export const ORDER_STATUSES = [
  "PENDING_PAYMENT",
  "PAID",
  "CONFIRMED",
  "PROCESSING",
  "SHIPPED",
  "DELIVERED",
  "CANCELLED",
  "REFUNDED",
  "RETURN_REQUESTED",
  "RETURNED",
] as const;

export type OrderStatusValue = (typeof ORDER_STATUSES)[number];

/** Anything not listed here is rejected by `applyTransition()`. */
export const ORDER_TRANSITIONS: Record<OrderStatusValue, OrderStatusValue[]> = {
  PENDING_PAYMENT: ["PAID", "CONFIRMED", "CANCELLED"],
  PAID: ["CONFIRMED", "CANCELLED", "REFUNDED"],
  CONFIRMED: ["PROCESSING", "SHIPPED", "CANCELLED", "REFUNDED"],
  PROCESSING: ["SHIPPED", "CANCELLED", "REFUNDED"],
  SHIPPED: ["DELIVERED", "RETURN_REQUESTED", "REFUNDED"],
  DELIVERED: ["RETURN_REQUESTED", "REFUNDED"],
  RETURN_REQUESTED: ["RETURNED", "DELIVERED", "REFUNDED"],
  RETURNED: ["REFUNDED"],
  CANCELLED: [],
  REFUNDED: [],
};

export const ORDER_STATUS_LABELS: Record<OrderStatusValue, string> = {
  PENDING_PAYMENT: "পেমেন্টের অপেক্ষায়",
  PAID: "পরিশোধিত",
  CONFIRMED: "নিশ্চিত",
  PROCESSING: "প্রস্তুত হচ্ছে",
  SHIPPED: "পাঠানো হয়েছে",
  DELIVERED: "ডেলিভার হয়েছে",
  CANCELLED: "বাতিল",
  REFUNDED: "ফেরত দেওয়া হয়েছে",
  RETURN_REQUESTED: "ফেরতের অনুরোধ",
  RETURNED: "ফেরত এসেছে",
};

/** Statuses where the merchant has taken ownership of the order. */
export const COMMITTED_STATUSES: OrderStatusValue[] = [
  "CONFIRMED",
  "PROCESSING",
  "SHIPPED",
  "DELIVERED",
];

export function canTransition(from: string, to: string): boolean {
  const allowed = ORDER_TRANSITIONS[from as OrderStatusValue];
  return Boolean(allowed?.includes(to as OrderStatusValue));
}

export function allowedNextStatuses(from: string): OrderStatusValue[] {
  return ORDER_TRANSITIONS[from as OrderStatusValue] ?? [];
}
