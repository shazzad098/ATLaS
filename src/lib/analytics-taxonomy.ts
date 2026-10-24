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

export type AnalyticsEventName = (typeof ANALYTICS_EVENTS)[number];
