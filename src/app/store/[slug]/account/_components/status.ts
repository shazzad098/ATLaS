/** Bengali labels for order/payment statuses shown in the buyer panel. */

export const ORDER_STATUS_LABEL: Record<string, string> = {
  PENDING_PAYMENT: "পেমেন্ট বাকি",
  PAID: "পরিশোধিত",
  CONFIRMED: "নিশ্চিত হয়েছে",
  PROCESSING: "প্রস্তুত হচ্ছে",
  SHIPPED: "পাঠানো হয়েছে",
  DELIVERED: "ডেলিভারি হয়েছে",
  CANCELLED: "বাতিল",
  REFUNDED: "রিফান্ড হয়েছে",
  RETURN_REQUESTED: "রিটার্ন অনুরোধ",
  RETURNED: "ফেরত দেওয়া হয়েছে",
};

export const PAYMENT_STATUS_LABEL: Record<string, string> = {
  PENDING: "বাকি",
  PAID: "পরিশোধিত",
  PARTIALLY_REFUNDED: "আংশিক রিফান্ড",
  REFUNDED: "রিফান্ড",
  FAILED: "ব্যর্থ",
  CANCELLED: "বাতিল",
};

export type StatusTone = "success" | "warning" | "danger" | "neutral" | "info";

export function orderStatusTone(status: string): StatusTone {
  if (status === "DELIVERED" || status === "PAID") return "success";
  if (status === "CANCELLED" || status === "REFUNDED" || status === "FAILED") return "danger";
  if (status === "PENDING_PAYMENT" || status === "RETURN_REQUESTED") return "warning";
  if (status === "SHIPPED" || status === "PROCESSING") return "info";
  return "neutral";
}
