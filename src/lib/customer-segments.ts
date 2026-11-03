/**
 * Customer segmentation rules (PRD §4.4).
 *
 * Kept free of database imports so the logic is directly unit-tested and the
 * same rules can be reused by exports and dashboards.
 */

export const CUSTOMER_SEGMENTS = [
  "all",
  "new",
  "repeat",
  "vip",
  "inactive",
  "blacklisted",
] as const;

export type CustomerSegment = (typeof CUSTOMER_SEGMENTS)[number];

export const SEGMENT_LABELS: Record<CustomerSegment, string> = {
  all: "সব",
  new: "নতুন",
  repeat: "পুনরায় ক্রেতা",
  vip: "VIP",
  inactive: "নিষ্ক্রিয়",
  blacklisted: "Blacklisted",
};

export const VIP_SPEND_PAISA = 1_000_000n; // ৳10,000 lifetime
export const VIP_ORDER_COUNT = 5;
export const INACTIVE_DAYS = 90;

export type CustomerSnapshot = {
  orderCount: number;
  lifetimePaisa: bigint;
  lastOrderAt: Date | null;
  isBlacklisted: boolean;
};

/**
 * Priority: blacklisted > vip > inactive > repeat > new.
 * `inactive` only applies to customers who have ordered at least once.
 */
export function classifyCustomer(
  input: CustomerSnapshot,
  now: Date = new Date(),
): Exclude<CustomerSegment, "all"> {
  if (input.isBlacklisted) return "blacklisted";
  if (input.lifetimePaisa >= VIP_SPEND_PAISA || input.orderCount >= VIP_ORDER_COUNT) return "vip";
  if (
    input.lastOrderAt &&
    now.getTime() - input.lastOrderAt.getTime() > INACTIVE_DAYS * 24 * 60 * 60 * 1000
  ) {
    return "inactive";
  }
  if (input.orderCount >= 2) return "repeat";
  return "new";
}
