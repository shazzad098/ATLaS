import { ForbiddenException } from "@nestjs/common";

/**
 * Minimal RBAC mirroring the Next.js app's `src/lib/rbac.ts` for the modules
 * that have been migrated to the API. Permissions live on the Role row as
 * `resource:action` strings; system roles below are the seed defaults.
 */

export const CATALOG_READ = "catalog:read";
export const CATALOG_WRITE = "catalog:write";
export const STORE_READ = "store:read";
export const ORDERS_READ = "orders:read";
export const ORDERS_WRITE = "orders:write";

const SYSTEM_ROLE_PERMISSIONS: Record<string, string[]> = {
  OWNER: [STORE_READ, CATALOG_READ, CATALOG_WRITE, ORDERS_READ, ORDERS_WRITE],
  ADMIN: [STORE_READ, CATALOG_READ, CATALOG_WRITE, ORDERS_READ, ORDERS_WRITE],
  MANAGER: [STORE_READ, CATALOG_READ, CATALOG_WRITE, ORDERS_READ, ORDERS_WRITE],
  STAFF: [STORE_READ, CATALOG_READ, CATALOG_WRITE, ORDERS_READ, ORDERS_WRITE],
  SUPPORT: [STORE_READ, CATALOG_READ, ORDERS_READ],
};

/** Custom roles store their permission list directly; system roles use defaults. */
export function permissionsForRole(code: string, permissionsJson: unknown): string[] {
  if (Array.isArray(permissionsJson) && permissionsJson.length > 0) {
    return permissionsJson.filter((permission): permission is string => typeof permission === "string");
  }
  return SYSTEM_ROLE_PERMISSIONS[code] ?? [];
}

export function assertPermission(permissions: readonly string[], permission: string): void {
  if (!permissions.includes(permission)) {
    throw new ForbiddenException(`Your role lacks the "${permission}" permission`);
  }
}
