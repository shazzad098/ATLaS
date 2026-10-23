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
export type OrderStatus = (typeof ORDER_STATUSES)[number];

/** Allowed order state transitions (PRD §6 FR-04). PAID is set only by verified payment callbacks. */
export const ORDER_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  PENDING_PAYMENT: ["PAID", "CONFIRMED", "CANCELLED"],
  PAID: ["CONFIRMED", "PROCESSING", "CANCELLED", "REFUNDED"],
  CONFIRMED: ["PROCESSING", "SHIPPED", "CANCELLED"],
  PROCESSING: ["SHIPPED", "CANCELLED"],
  SHIPPED: ["DELIVERED", "RETURNED"],
  DELIVERED: ["RETURN_REQUESTED", "REFUNDED"],
  RETURN_REQUESTED: ["RETURNED", "DELIVERED"],
  RETURNED: ["REFUNDED"],
  CANCELLED: [],
  REFUNDED: [],
};

/** Transitions a merchant may trigger manually from the admin panel. */
export const MERCHANT_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  ...ORDER_TRANSITIONS,
  PENDING_PAYMENT: ["CONFIRMED", "CANCELLED"],
};

export const ORDER_STATUS_LABELS: Record<OrderStatus, { en: string; bn: string; tone: string }> = {
  PENDING_PAYMENT: { en: "Pending payment", bn: "পেমেন্ট বাকি", tone: "amber" },
  PAID: { en: "Paid", bn: "পেইড", tone: "emerald" },
  CONFIRMED: { en: "Confirmed", bn: "কনফার্মড", tone: "blue" },
  PROCESSING: { en: "Processing", bn: "প্রসেসিং", tone: "indigo" },
  SHIPPED: { en: "Shipped", bn: "পাঠানো হয়েছে", tone: "violet" },
  DELIVERED: { en: "Delivered", bn: "ডেলিভারড", tone: "green" },
  CANCELLED: { en: "Cancelled", bn: "বাতিল", tone: "slate" },
  REFUNDED: { en: "Refunded", bn: "রিফান্ডেড", tone: "rose" },
  RETURN_REQUESTED: { en: "Return requested", bn: "রিটার্ন অনুরোধ", tone: "orange" },
  RETURNED: { en: "Returned", bn: "রিটার্নড", tone: "red" },
};

export const SUBSCRIPTION_STATUSES = [
  "TRIALING",
  "ACTIVE",
  "PAST_DUE",
  "GRACE_PERIOD",
  "READ_ONLY",
  "SUSPENDED",
  "CANCELLED",
] as const;
export type SubscriptionStatus = (typeof SUBSCRIPTION_STATUSES)[number];

export const PAYMENT_PROVIDERS = ["bkash", "nagad", "sslcommerz", "cod"] as const;
export type PaymentProvider = (typeof PAYMENT_PROVIDERS)[number];
export const ONLINE_PROVIDERS = ["bkash", "nagad", "sslcommerz"] as const;
export type OnlineProvider = (typeof ONLINE_PROVIDERS)[number];

export const PROVIDER_INFO: Record<PaymentProvider, { name: string; color: string; feePercent: number }> = {
  bkash: { name: "bKash", color: "#E2136E", feePercent: 1.85 },
  nagad: { name: "Nagad", color: "#EC1C24", feePercent: 1.49 },
  sslcommerz: { name: "SSLCommerz", color: "#2B5BA8", feePercent: 2.5 },
  cod: { name: "Cash on Delivery", color: "#10B981", feePercent: 0 },
};

export const COURIER_PROVIDERS = ["pathao", "steadfast", "redx", "paperfly", "manual"] as const;
export type CourierProvider = (typeof COURIER_PROVIDERS)[number];
export const COURIER_INFO: Record<CourierProvider, { name: string; color: string; thirdParty: boolean }> = {
  pathao: { name: "Pathao Courier", color: "#E83A30", thirdParty: true },
  steadfast: { name: "Steadfast", color: "#0E9F6E", thirdParty: true },
  redx: { name: "RedX", color: "#E11D48", thirdParty: true },
  paperfly: { name: "Paperfly", color: "#1D4ED8", thirdParty: true },
  manual: { name: "Own delivery (manual)", color: "#475569", thirdParty: false },
};
export const COURIER_FEE_RATE_PERCENT = 0.5;

export const ANALYTICS_EVENTS = [
  "signup_completed",
  "store_created",
  "theme_selected",
  "first_product_created",
  "store_published",
  "checkout_started",
  "payment_succeeded",
  "order_created",
  "subscription_started",
  "subscription_renewed",
  "subscription_failed",
  "plan_upgraded",
] as const;
export type AnalyticsEvent = (typeof ANALYTICS_EVENTS)[number];

export const STORE_CATEGORIES = [
  { value: "fashion", en: "Fashion & Clothing", bn: "ফ্যাশন ও পোশাক" },
  { value: "grocery", en: "Grocery & Food", bn: "গ্রোসারি ও খাবার" },
  { value: "electronics", en: "Gadgets & Electronics", bn: "গ্যাজেট ও ইলেকট্রনিক্স" },
  { value: "beauty", en: "Beauty & Cosmetics", bn: "বিউটি ও কসমেটিক্স" },
  { value: "handicraft", en: "Handicraft & Home", bn: "হস্তশিল্প ও হোম" },
  { value: "general", en: "General Store", bn: "জেনারেল স্টোর" },
  { value: "luxury", en: "Luxury & Gifts", bn: "লাক্সারি ও গিফট" },
] as const;

export const BD_DISTRICTS = [
  "Dhaka", "Gazipur", "Narayanganj", "Chattogram", "Cox's Bazar", "Cumilla", "Sylhet", "Moulvibazar",
  "Rajshahi", "Bogura", "Khulna", "Jashore", "Barishal", "Rangpur", "Dinajpur", "Mymensingh",
  "Tangail", "Faridpur", "Noakhali", "Feni", "Pabna", "Kushtia", "Narsingdi", "Savar",
] as const;

export const SLUG_RE = /^[a-z0-9](?:[a-z0-9-]{1,38}[a-z0-9])$/;
export const RESERVED_SLUGS = [
  "www", "app", "api", "admin", "atlas", "help", "support", "billing", "mail", "status", "docs", "blog",
  "static", "assets", "cdn", "store", "shop", "login", "signup", "dashboard",
];
export const BD_PHONE_RE = /^(?:\+?88)?01[3-9]\d{8}$/;
export function normalizeBdPhone(input: string): string | null {
  const digits = input.replace(/[\s-]/g, "");
  if (!BD_PHONE_RE.test(digits)) return null;
  return "+880" + digits.slice(-10);
}

export const ROOT_STORE_DOMAIN = "atlas.example";
