import type { PlanLimits } from "../drizzle/schema";

export type PlanCode = "free" | "basic" | "standard" | "pro";
export const PLAN_ORDER: PlanCode[] = ["free", "basic", "standard", "pro"];

export type PlanSeed = {
  code: PlanCode;
  name: string;
  tagline: string;
  priceMonthly: string;
  priceYearly: string;
  limits: PlanLimits;
  features: string[];
};

/** PRD §5.1 matrix. Prices are business-approved placeholders editable from the Super Admin console. */
export const PLAN_SEEDS: PlanSeed[] = [
  {
    code: "free",
    name: "Free",
    tagline: "Start selling at ৳0 and pay only when you grow.",
    priceMonthly: "0.00",
    priceYearly: "0.00",
    limits: {
      products: 25,
      monthlyOrdersIncluded: 50,
      overageRatePercent: 2.5,
      storageMB: 100,
      staffSeats: 1,
      themeTier: "starter",
      themeSwitching: "starter_only",
      customDomain: false,
      customDomainWithSubdomain: false,
      couponLevel: "basic",
      reportsLevel: "basic",
      courierLevel: "manual",
      maxCourierConnections: 0,
      apiAccess: "read_public",
      apiRateLimitPerMin: 60,
      support: "community",
      twoFactor: false,
      yearlyBilling: false,
      bulkTools: false,
      trialDays: 7,
    },
    features: ["25 products", "50 fee-free sales / month", "2.5% per sale after quota", "100 MB storage", "2 starter themes", "ATLaS subdomain", "Basic reports", "Community support"],
  },
  {
    code: "basic",
    name: "Basic",
    tagline: "For new shops ready for steady orders.",
    priceMonthly: "990.00",
    priceYearly: "9900.00",
    limits: {
      products: 250,
      monthlyOrdersIncluded: 500,
      overageRatePercent: 2,
      storageMB: 1024,
      staffSeats: 2,
      themeTier: "curated",
      themeSwitching: "locked",
      customDomain: false,
      customDomainWithSubdomain: false,
      couponLevel: "basic",
      reportsLevel: "csv",
      courierLevel: "third_party",
      maxCourierConnections: 1,
      apiAccess: "api_webhooks",
      apiRateLimitPerMin: 120,
      support: "standard",
      twoFactor: false,
      yearlyBilling: true,
      bulkTools: true,
      trialDays: 7,
    },
    features: ["250 products", "500 orders / month included", "2% per sale after quota", "1 GB storage", "5 curated themes", "CSV import & export", "1 courier integration", "API + webhooks", "2 staff seats"],
  },
  {
    code: "standard",
    name: "Standard",
    tagline: "Your brand, your domain, your team.",
    priceMonthly: "2490.00",
    priceYearly: "24900.00",
    limits: {
      products: 1000,
      monthlyOrdersIncluded: 2000,
      overageRatePercent: 1,
      storageMB: 5120,
      staffSeats: 5,
      themeTier: "standard",
      themeSwitching: "allowed",
      customDomain: true,
      customDomainWithSubdomain: false,
      couponLevel: "advanced",
      reportsLevel: "advanced",
      courierLevel: "more",
      maxCourierConnections: 3,
      apiAccess: "full",
      apiRateLimitPerMin: 300,
      support: "priority",
      twoFactor: false,
      yearlyBilling: true,
      bulkTools: true,
      trialDays: 7,
    },
    features: ["1,000 products", "2,000 orders / month included", "1% per sale after quota", "5 GB storage", "All standard themes", "Custom domain", "Advanced coupons & reports", "3 courier integrations", "5 staff seats", "Priority support"],
  },
  {
    code: "pro",
    name: "Pro",
    tagline: "Unlimited scale with zero sale fees.",
    priceMonthly: "4990.00",
    priceYearly: "49900.00",
    limits: {
      products: null,
      monthlyOrdersIncluded: null,
      overageRatePercent: 0,
      storageMB: null,
      staffSeats: 10,
      themeTier: "all",
      themeSwitching: "allowed",
      customDomain: true,
      customDomainWithSubdomain: true,
      couponLevel: "advanced",
      reportsLevel: "advanced_scheduled",
      courierLevel: "all",
      maxCourierConnections: null,
      apiAccess: "full_plus",
      apiRateLimitPerMin: 1000,
      support: "priority_onboarding",
      twoFactor: true,
      yearlyBilling: true,
      bulkTools: true,
      trialDays: 7,
    },
    features: ["Unlimited products", "Unlimited orders, 0% sale fee", "Unlimited storage (fair use)", "All themes + Pro-exclusive", "Custom domain + subdomain together", "Scheduled reports", "All couriers", "10 staff seats", "2FA for owners", "Priority onboarding"],
  },
];

export const FREE_TRIAL_PLAN: PlanCode = "standard";
export const GRACE_DAYS = 7;
export const READ_ONLY_DAYS = 7;
export const RETRY_DAYS = [1, 3, 5];
export const REMINDER_DAYS = [7, 3, 1];
export const STORAGE_FAIR_USE_MB = 51200;

export const THEME_TIER_RANK = { starter: 0, curated: 1, standard: 2, pro_exclusive: 3 } as const;
export const PLAN_THEME_RANK = { starter: 0, curated: 1, standard: 2, all: 3 } as const;

export type ComparisonRow = { label: string; values: [string, string, string, string] };
export const COMPARISON_ROWS: ComparisonRow[] = [
  { label: "Products", values: ["25", "250", "1,000", "Unlimited"] },
  { label: "Monthly orders included", values: ["50", "500", "2,000", "Unlimited"] },
  { label: "Fee after quota", values: ["2.5% per sale", "2% per sale", "1% per sale", "0%"] },
  { label: "Storage", values: ["100 MB", "1 GB", "5 GB", "Unlimited (fair use)"] },
  { label: "Themes", values: ["2 starter", "5 curated", "All standard", "All + Pro-exclusive"] },
  { label: "Theme switching", values: ["Starter only", "Locked during subscription", "Allowed", "Allowed"] },
  { label: "Custom domain", values: ["—", "—", "Yes", "Yes + subdomain together"] },
  { label: "Products / variants / inventory", values: ["Core", "Core + bulk tools", "Advanced", "Advanced"] },
  { label: "Coupons & discounts", values: ["Basic", "Basic", "Advanced", "Advanced"] },
  { label: "Reports", values: ["Basic", "CSV export", "Advanced", "Advanced + scheduled"] },
  { label: "Courier integrations", values: ["Manual", "Third-party (0.5% charge)", "More integrations", "All integrations"] },
  { label: "Staff seats", values: ["1", "2", "5", "10"] },
  { label: "API access", values: ["Read-only public", "API + webhooks", "Full scoped API", "Full API + higher limits"] },
  { label: "Support", values: ["Community", "Standard", "Priority", "Priority + onboarding"] },
  { label: "Yearly billing", values: ["—", "Yes", "Yes", "Yes"] },
  { label: "Trial", values: ["7 days of paid features", "7-day trial", "7-day trial", "7-day trial"] },
];

export function formatLimit(v: number | null, unit = ""): string {
  if (v === null) return "Unlimited";
  return v.toLocaleString("en-US") + unit;
}
