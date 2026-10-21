import { ForbiddenError } from "@/lib/errors";

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
};

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
