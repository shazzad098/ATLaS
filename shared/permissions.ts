export const PERMISSIONS = [
  "overview.view",
  "catalog.read",
  "catalog.write",
  "inventory.adjust",
  "orders.read",
  "orders.write",
  "orders.refund",
  "customers.read",
  "customers.write",
  "customers.export_pii",
  "discounts.manage",
  "design.manage",
  "payments.manage",
  "delivery.manage",
  "reports.view",
  "reports.export",
  "staff.manage",
  "billing.manage",
  "settings.manage",
  "developers.manage",
  "support.use",
] as const;
export type Permission = (typeof PERMISSIONS)[number];

export type SystemRoleCode = "owner" | "manager" | "catalog_manager" | "order_manager" | "support_agent" | "viewer";

export const SYSTEM_ROLES: { code: SystemRoleCode; name: string; description: string; permissions: Permission[]; minPlan: "free" | "basic" | "standard" }[] = [
  { code: "owner", name: "Owner", description: "Full access including billing and staff.", permissions: [...PERMISSIONS], minPlan: "free" },
  {
    code: "manager",
    name: "Store manager",
    description: "Runs the store day to day; no billing or staff management.",
    permissions: PERMISSIONS.filter(p => !["billing.manage", "staff.manage", "developers.manage"].includes(p)),
    minPlan: "basic",
  },
  {
    code: "catalog_manager",
    name: "Catalog manager",
    description: "Products, categories and inventory.",
    permissions: ["overview.view", "catalog.read", "catalog.write", "inventory.adjust", "reports.view", "support.use"],
    minPlan: "standard",
  },
  {
    code: "order_manager",
    name: "Order manager",
    description: "Orders, fulfilment, delivery and customers.",
    permissions: ["overview.view", "catalog.read", "orders.read", "orders.write", "customers.read", "customers.write", "delivery.manage", "support.use"],
    minPlan: "standard",
  },
  {
    code: "support_agent",
    name: "Support agent",
    description: "Read orders and customers, answer support.",
    permissions: ["overview.view", "orders.read", "customers.read", "support.use"],
    minPlan: "standard",
  },
  {
    code: "viewer",
    name: "Viewer",
    description: "Read-only access to catalog, orders and reports.",
    permissions: ["overview.view", "catalog.read", "orders.read", "reports.view"],
    minPlan: "basic",
  },
];

export const PLATFORM_ROLES = ["super_admin", "support", "finance", "template_manager"] as const;
export type PlatformRole = (typeof PLATFORM_ROLES)[number];

/** Which Super Admin areas each platform role can access. */
export const PLATFORM_ACCESS: Record<PlatformRole, string[]> = {
  super_admin: ["*"],
  support: ["metrics", "merchants", "support", "announcements", "security"],
  finance: ["metrics", "merchants", "billing", "payments", "plans"],
  template_manager: ["metrics", "themes"],
};
