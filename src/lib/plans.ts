/**
 * Plan + entitlement matrix (PRD §5.1).
 *
 * These objects are the *default* matrix. The authoritative copy lives in the
 * `Plan` table so that Super Admin can reconfigure limits without a deploy
 * (PRD §4.5), and `loadPlanMatrix()` prefers the database row when present.
 */

export const PLAN_CODES = ["free", "basic", "standard", "pro"] as const;
export type PlanCode = (typeof PLAN_CODES)[number];

export type ThemeSwitchingPolicy = "STARTER_ONLY" | "NOT_ALLOWED" | "ALLOWED";
export type ApiAccessLevel = "READ_ONLY_PUBLIC" | "READ_WEBHOOKS" | "SCOPED" | "FULL";
export type ReportLevel = "BASIC" | "CSV" | "ADVANCED" | "ADVANCED_SCHEDULED";
export type DiscountLevel = "BASIC" | "ADVANCED";
export type SupportLevel = "COMMUNITY" | "STANDARD" | "PRIORITY" | "PRIORITY_ONBOARDING";

/** `null` means unlimited. */
export type PlanLimits = {
  products: number | null;
  /** Orders included each billing period before overage starts. */
  monthlyOrders: number | null;
  storageMb: number | null;
  /** Theme codes available on the plan. Explicit list keeps enforcement simple. */
  themes: string[];
  themeSwitching: ThemeSwitchingPolicy;
  customDomain: boolean;
  subdomain: boolean;
  /** Custom domain *and* subdomain resolving together (Standard+). */
  domainWithSubdomain: boolean;
  staffSeats: number;
  bulkTools: boolean;
  automation: boolean;
  discounts: DiscountLevel;
  reports: ReportLevel;
  apiAccess: ApiAccessLevel;
  requestsPerMinute: number;
  support: SupportLevel;
  /** Percentage of the fee-base charged per order past `monthlyOrders`, e.g. 0.025. */
  overageRate: number;
};

export type PlanFeatures = {
  /** Merchant may change the published theme while the subscription is active. */
  publishStore: boolean;
  discountCampaigns: boolean;
  scheduledExport: boolean;
  prioritySupport: boolean;
  onboardingAssistance: boolean;
  thirdPartyCouriers: boolean;
};

export type PlanDefinition = {
  code: PlanCode;
  name: string;
  description: string;
  sortOrder: number;
  /** `null` = quote-only (business approved), per PRD §5.1. */
  monthlyPriceBdt: number | null;
  yearlyPriceBdt: number | null;
  trialDays: number;
  $limits: PlanLimits;
  $features: PlanFeatures;
};

export const PLAN_DEFINITIONS: Record<PlanCode, PlanDefinition> = {
  free: {
    code: "free",
    name: "Free",
    description: "শুরু করার জন্য — 25টি product, COD checkout, 50টি sale পর্যন্ত fee-free।",
    sortOrder: 1,
    monthlyPriceBdt: 0,
    yearlyPriceBdt: 0,
    trialDays: 7,
    $limits: {
      products: 25,
      monthlyOrders: 50,
      storageMb: 100,
      themes: ["nokshi", "bazar"],
      themeSwitching: "STARTER_ONLY",
      customDomain: false,
      subdomain: true,
      domainWithSubdomain: false,
      staffSeats: 1,
      bulkTools: false,
      automation: false,
      discounts: "BASIC",
      reports: "BASIC",
      apiAccess: "READ_ONLY_PUBLIC",
      requestsPerMinute: 60,
      support: "COMMUNITY",
      overageRate: 0.025,
    },
    $features: {
      publishStore: true,
      discountCampaigns: false,
      scheduledExport: false,
      prioritySupport: false,
      onboardingAssistance: false,
      thirdPartyCouriers: false,
    },
  },
  basic: {
    code: "basic",
    name: "Basic",
    description: "বাড়তে থাকা ব্যবসার জন্য — 250 products, 500 orders, 1GB storage।",
    sortOrder: 2,
    monthlyPriceBdt: null,
    yearlyPriceBdt: null,
    trialDays: 7,
    $limits: {
      products: 250,
      monthlyOrders: 500,
      storageMb: 1024,
      themes: ["nokshi", "bazar", "studio"],
      themeSwitching: "NOT_ALLOWED",
      customDomain: false,
      subdomain: true,
      domainWithSubdomain: false,
      staffSeats: 2,
      bulkTools: true,
      automation: false,
      discounts: "BASIC",
      reports: "CSV",
      apiAccess: "READ_WEBHOOKS",
      requestsPerMinute: 120,
      support: "STANDARD",
      overageRate: 0.02,
    },
    $features: {
      publishStore: true,
      discountCampaigns: false,
      scheduledExport: false,
      prioritySupport: false,
      onboardingAssistance: false,
      thirdPartyCouriers: true,
    },
  },
  standard: {
    code: "standard",
    name: "Standard",
    description: "Custom domain, advanced reports আর দ্রুত support সহ পূর্ণ catalog।",
    sortOrder: 3,
    monthlyPriceBdt: null,
    yearlyPriceBdt: null,
    trialDays: 7,
    $limits: {
      products: 1000,
      monthlyOrders: 2000,
      storageMb: 5120,
      themes: ["nokshi", "bazar", "studio"],
      themeSwitching: "ALLOWED",
      customDomain: true,
      subdomain: true,
      domainWithSubdomain: true,
      staffSeats: 5,
      bulkTools: true,
      automation: true,
      discounts: "ADVANCED",
      reports: "ADVANCED",
      apiAccess: "SCOPED",
      requestsPerMinute: 300,
      support: "PRIORITY",
      overageRate: 0.01,
    },
    $features: {
      publishStore: true,
      discountCampaigns: true,
      scheduledExport: false,
      prioritySupport: true,
      onboardingAssistance: false,
      thirdPartyCouriers: true,
    },
  },
  pro: {
    code: "pro",
    name: "Pro",
    description: "Unlimited products ও orders, সব theme, full API আর onboarding সহায়তা।",
    sortOrder: 4,
    monthlyPriceBdt: null,
    yearlyPriceBdt: null,
    trialDays: 7,
    $limits: {
      products: null,
      monthlyOrders: null,
      storageMb: null,
      themes: ["nokshi", "bazar", "studio"],
      themeSwitching: "ALLOWED",
      customDomain: true,
      subdomain: true,
      domainWithSubdomain: true,
      staffSeats: 10,
      bulkTools: true,
      automation: true,
      discounts: "ADVANCED",
      reports: "ADVANCED_SCHEDULED",
      apiAccess: "FULL",
      requestsPerMinute: 600,
      support: "PRIORITY_ONBOARDING",
      overageRate: 0,
    },
    $features: {
      publishStore: true,
      discountCampaigns: true,
      scheduledExport: true,
      prioritySupport: true,
      onboardingAssistance: true,
      thirdPartyCouriers: true,
    },
  },
};

/** Canonical feature keys used by `assertFeature()` and the pricing page. */
export const FEATURE_LABELS: Record<string, string> = {
  "store.publish": "Storefront publish",
  "catalog.bulk": "Bulk import / export",
  "discounts.campaigns": "Discount campaigns",
  "reports.csv": "CSV export",
  "reports.advanced": "Advanced reports",
  "reports.scheduled": "Scheduled export",
  "domain.custom": "Custom domain",
  "domain.customWithSubdomain": "Custom domain + subdomain",
  "themes.all": "সব theme",
  "theme.switching": "Theme switching",
  "staff.seats": "Staff seats",
  "courier.thirdParty": "Third-party courier",
  "api.webhooks": "Outbound webhooks",
  "api.scoped": "Scoped API keys",
  "support.priority": "Priority support",
  "support.onboarding": "Onboarding assistance",
  automation: "Automation-ready rules",
};

export function planMatrixFor(code: PlanCode): PlanDefinition {
  return PLAN_DEFINITIONS[code];
}

export function isUnlimited(value: number | null): boolean {
  return value === null;
}

/** Human label for a limit value, used across pricing + billing screens. */
export function formatLimit(value: number | null, unit = ""): string {
  if (value === null) return "Unlimited";
  return unit ? `${value.toLocaleString("en-US")} ${unit}` : value.toLocaleString("en-US");
}

/** Overage rate rendered as a percentage, e.g. 0.025 -> "2.5%". */
export function formatRate(rate: number): string {
  return `${(rate * 100).toFixed(rate * 100 % 1 === 0 ? 0 : 2)}%`;
}
