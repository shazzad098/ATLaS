/**
 * Order state machine — mirrors the Next.js `src/lib/services/order-service.ts`
 * so the two surfaces agree on which transitions are legal.
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

const COMMITTED_STATUSES: OrderStatusValue[] = ["CONFIRMED", "PROCESSING", "SHIPPED", "DELIVERED"];

export function canTransition(from: string, to: string): boolean {
  return Boolean(ORDER_TRANSITIONS[from as OrderStatusValue]?.includes(to as OrderStatusValue));
}

export function allowedNextStatuses(from: string): OrderStatusValue[] {
  return ORDER_TRANSITIONS[from as OrderStatusValue] ?? [];
}

export function isCommittedStatus(status: string): boolean {
  return COMMITTED_STATUSES.includes(status as OrderStatusValue);
}
