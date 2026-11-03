import { ForbiddenError } from "./errors.ts";
import { slugify } from "./slug.ts";

/**
 * Role-based access control (PRD §4.4 "Staff & Roles", FR-02).
 *
 * Permissions are `resource:action` strings stored on the Role row, so a tenant
 * can define its own roles later without a deploy. System roles below are the
 * seed defaults, and they are not editable.
 */

export const PERMISSIONS = [
  "store:read",
  "store:write",
  "store:publish",
  "catalog:read",
  "catalog:write",
  "orders:read",
  "orders:write",
  "orders:refund",
  "customers:read",
  "customers:write",
  "discounts:read",
  "discounts:write",
  "design:read",
  "design:write",
  "payments:read",
  "payments:write",
  "delivery:read",
  "delivery:write",
  "reports:read",
  "reports:export",
  "staff:read",
  "staff:write",
  "billing:read",
  "billing:write",
  "settings:read",
  "settings:write",
] as const;

export type Permission = (typeof PERMISSIONS)[number];

/**
 * Human labels for the role editor. Kept next to the permission list so adding
 * a permission without a label is a type error rather than a blank checkbox.
 */
export const PERMISSION_LABELS: Record<Permission, string> = {
  "store:read": "দোকান দেখা",
  "store:write": "দোকান তথ্য সম্পাদনা",
  "store:publish": "দোকান publish/unpublish",
  "catalog:read": "পণ্য ও ক্যাটাগরি দেখা",
  "catalog:write": "পণ্য ও ক্যাটাগরি সম্পাদনা",
  "orders:read": "অর্ডার দেখা",
  "orders:write": "অর্ডার প্রসেস করা",
  "orders:refund": "রিফান্ড অনুমোদন",
  "customers:read": "কাস্টমার দেখা",
  "customers:write": "কাস্টমার তথ্য সম্পাদনা",
  "discounts:read": "ডিসকাউন্ট দেখা",
  "discounts:write": "ডিসকাউন্ট তৈরি/সম্পাদনা",
  "design:read": "থিম ও পেজ দেখা",
  "design:write": "থিম ও পেজ সম্পাদনা",
  "payments:read": "পেমেন্ট সেটিংস দেখা",
  "payments:write": "পেমেন্ট সেটিংস সম্পাদনা",
  "delivery:read": "ডেলিভারি দেখা",
  "delivery:write": "ডেলিভারি সেটিংস সম্পাদনা",
  "reports:read": "রিপোর্ট দেখা",
  "reports:export": "রিপোর্ট এক্সপোর্ট",
  "staff:read": "টিম ও রোল দেখা",
  "staff:write": "টিম সদস্য ও রোল পরিচালনা",
  "billing:read": "বিলিং ও ইনভয়েস দেখা",
  "billing:write": "বিলিং ও প্ল্যান পরিবর্তন",
  "settings:read": "সেটিংস ও ইন্টিগ্রেশন দেখা",
  "settings:write": "সেটিংস ও ইন্টিগ্রেশন সম্পাদনা",
};

export type PermissionGroup = {
  key: string;
  label: string;
  description: string;
  permissions: Permission[];
};

/** Grouping used by the merchant role editor (matrix order). */
export const PERMISSION_GROUPS: PermissionGroup[] = [
  {
    key: "store",
    label: "দোকান",
    description: "দোকানের মৌলিক তথ্য ও প্রকাশ",
    permissions: ["store:read", "store:write", "store:publish"],
  },
  {
    key: "catalog",
    label: "ক্যাটালগ",
    description: "পণ্য, ভ্যারিয়েন্ট, ক্যাটাগরি ও স্টক",
    permissions: ["catalog:read", "catalog:write"],
  },
  {
    key: "orders",
    label: "অর্ডার",
    description: "অর্ডার প্রসেস, স্ট্যাটাস ও রিফান্ড",
    permissions: ["orders:read", "orders:write", "orders:refund"],
  },
  {
    key: "customers",
    label: "কাস্টমার",
    description: "কাস্টমার প্রোফাইল ও নোট",
    permissions: ["customers:read", "customers:write"],
  },
  {
    key: "discounts",
    label: "ডিসকাউন্ট",
    description: "কুপন ও প্রোমোশন",
    permissions: ["discounts:read", "discounts:write"],
  },
  {
    key: "design",
    label: "ডিজাইন",
    description: "থিম, স্টোরফ্রন্ট কনটেন্ট ও পেজ",
    permissions: ["design:read", "design:write"],
  },
  {
    key: "payments",
    label: "পেমেন্ট",
    description: "পেমেন্ট গেটওয়ে সেটিংস",
    permissions: ["payments:read", "payments:write"],
  },
  {
    key: "delivery",
    label: "ডেলিভারি",
    description: "ডেলিভারি জোন ও কুরিয়ার",
    permissions: ["delivery:read", "delivery:write"],
  },
  {
    key: "reports",
    label: "রিপোর্ট",
    description: "বিক্রয় রিপোর্ট ও এক্সপোর্ট",
    permissions: ["reports:read", "reports:export"],
  },
  {
    key: "staff",
    label: "টিম",
    description: "স্টাফ সদস্য ও রোল",
    permissions: ["staff:read", "staff:write"],
  },
  {
    key: "billing",
    label: "বিলিং",
    description: "সাবস্ক্রিপশন, প্ল্যান ও ইনভয়েস",
    permissions: ["billing:read", "billing:write"],
  },
  {
    key: "settings",
    label: "সেটিংস",
    description: "স্টোর সেটিংস, API key ও ইন্টিগ্রেশন",
    permissions: ["settings:read", "settings:write"],
  },
];

export const ROLE_CODES = ["OWNER", "ADMIN", "MANAGER", "STAFF", "SUPPORT"] as const;
export type RoleCode = (typeof ROLE_CODES)[number];

const READ_ONLY: Permission[] = PERMISSIONS.filter((p) => p.endsWith(":read"));

export const SYSTEM_ROLES: Record<
  RoleCode,
  { name: string; description: string; permissions: Permission[] }
> = {
  OWNER: {
    name: "Owner",
    description: "সব কিছু — billing, staff আর domain সহ।",
    permissions: [...PERMISSIONS],
  },
  ADMIN: {
    name: "Admin",
    description: "দৈনন্দিন পরিচালনার সব কাজ, billing ছাড়া।",
    permissions: PERMISSIONS.filter((p) => !p.startsWith("billing:")),
  },
  MANAGER: {
    name: "Manager",
    description: "Catalog, order, discount আর report।",
    permissions: [
      "store:read",
      "catalog:read",
      "catalog:write",
      "orders:read",
      "orders:write",
      "customers:read",
      "customers:write",
      "discounts:read",
      "discounts:write",
      "design:read",
      "delivery:read",
      "delivery:write",
      "reports:read",
      "reports:export",
      "settings:read",
    ],
  },
  STAFF: {
    name: "Staff",
    description: "Order প্রসেস আর catalog দেখা।",
    permissions: [
      "store:read",
      "catalog:read",
      "catalog:write",
      "orders:read",
      "orders:write",
      "customers:read",
      "reports:read",
    ],
  },
  SUPPORT: {
    name: "Support",
    description: "Customer দেখাশোনা আর order status, read-only view সহ।",
    permissions: [...READ_ONLY, "customers:write", "orders:write"],
  },
};

export type ActorContext = {
  userId: string;
  tenantId: string;
  roleCode: RoleCode | string;
  permissions: string[];
  /** Present when the request was authenticated with a scoped API key. */
  apiKeyId?: string;
};

export function isSystemRoleCode(code: string): code is RoleCode {
  return (ROLE_CODES as readonly string[]).includes(code);
}

/** Keep only known `resource:action` strings, preserving catalogue order. */
export function parsePermissions(value: unknown): Permission[] {
  if (!Array.isArray(value)) return [];
  const allowed = new Set<string>(PERMISSIONS);
  const seen = new Set<string>();
  const result: Permission[] = [];
  for (const entry of value) {
    if (typeof entry !== "string" || !allowed.has(entry) || seen.has(entry)) continue;
    seen.add(entry);
    result.push(entry as Permission);
  }
  return result;
}

/** True when every requested permission is already granted to the actor. */
export function permissionsAreSubset(requested: string[], granted: string[]): boolean {
  return requested.every((permission) => granted.includes(permission));
}

/**
 * Build a stable role code from a merchant-supplied name. The `CUSTOM_` prefix
 * keeps tenant-defined roles visually distinct from the five system roles and
 * makes it impossible to collide with `OWNER`/`ADMIN`/… accidentally.
 */
export function customRoleCode(name: string, suffix = ""): string {
  const slug = slugify(name, { maxLength: 32 }).replace(/-/g, "_").toUpperCase();
  const base = slug ? `CUSTOM_${slug}` : "CUSTOM_ROLE";
  return suffix ? `${base}_${suffix.toUpperCase()}`.slice(0, 48) : base.slice(0, 48);
}

export function permissionsForRole(roleCode: string, permissionsJson?: unknown): string[] {
  if (Array.isArray(permissionsJson) && permissionsJson.length > 0) {
    return permissionsJson.filter((p): p is string => typeof p === "string");
  }
  const system = SYSTEM_ROLES[roleCode as RoleCode];
  return system ? [...system.permissions] : [];
}

export function hasPermission(actor: ActorContext, permission: Permission): boolean {
  return actor.permissions.includes(permission);
}

export function assertPermission(actor: ActorContext, permission: Permission): void {
  if (hasPermission(actor, permission)) return;
  throw new ForbiddenError("এই কাজের অনুমতি আপনার role-এ নেই।", {
    requiredPermission: permission,
    role: actor.roleCode,
  });
}

export function assertAnyPermission(actor: ActorContext, permissions: Permission[]): void {
  if (permissions.some((p) => hasPermission(actor, p))) return;
  throw new ForbiddenError("এই কাজের অনুমতি আপনার role-এ নেই।", {
    requiredAny: permissions,
    role: actor.roleCode,
  });
}

export function isOwner(actor: ActorContext): boolean {
  return actor.roleCode === "OWNER";
}
