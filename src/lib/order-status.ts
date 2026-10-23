/**
 * Canonical financial-sale policy used by quota, fee, GMV and customer-value
 * calculations. Pending, cancelled, refunded and returned orders must not be
 * counted as successful sales.
 */
export const SUCCESSFUL_ORDER_STATUSES = [
  "PAID",
  "CONFIRMED",
  "PROCESSING",
  "SHIPPED",
  "DELIVERED",
] as const;

export type SuccessfulOrderStatus = (typeof SUCCESSFUL_ORDER_STATUSES)[number];

export function isSuccessfulSaleStatus(status: string): status is SuccessfulOrderStatus {
  return (SUCCESSFUL_ORDER_STATUSES as readonly string[]).includes(status);
}
