import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { ForbiddenError, NotFoundError, TenantMismatchError, UnauthenticatedError } from "@/lib/errors";
import { permissionsForRole, type ActorContext, type Permission, type RoleCode } from "@/lib/rbac";
import { readSession, type SessionUser } from "@/lib/auth/session";

/**
 * Tenant context (FR-02).
 *
 * `tenant_id` is always derived server-side from the authenticated membership.
 * A `tenantId` that arrives in a payload is never trusted — it is only ever
 * compared against the membership list. Same for store ownership: every store
 * access goes through `assertStoreAccess()`.
 */

export const STORE_COOKIE = "atlas_store";

export type TenantMembershipSummary = {
  tenantId: string;
  tenantName: string;
  tenantStatus: string;
  roleCode: RoleCode | string;
  roleName: string;
  permissions: string[];
};

export type StoreSummary = {
  id: string;
  name: string;
  slug: string;
  status: string;
  publishedAt: Date | null;
};

export type Workspace = {
  user: SessionUser;
  memberships: TenantMembershipSummary[];
  activeTenant: TenantMembershipSummary;
  stores: StoreSummary[];
  actor: ActorContext;
};

export const getWorkspace = cache(async (): Promise<Workspace | null> => {
  const session = await readSession();
  if (!session) return null;

  const rows = await prisma.membership.findMany({
    where: { userId: session.user.id, status: { in: ["ACTIVE", "INVITED"] } },
    include: { tenant: true, role: true },
    orderBy: { createdAt: "asc" },
  });

  const memberships: TenantMembershipSummary[] = rows.map((row) => ({
    tenantId: row.tenantId,
    tenantName: row.tenant.name,
    tenantStatus: row.tenant.status,
    roleCode: row.role.code,
    roleName: row.role.name,
    permissions: permissionsForRole(row.role.code, row.role.permissionsJson),
  }));

  if (memberships.length === 0) return null;

  const jar = await cookies();
  const requested = jar.get("atlas_tenant")?.value;
  const active = memberships.find((m) => m.tenantId === requested) ?? memberships[0];

  const stores = await prisma.store.findMany({
    where: { tenantId: active.tenantId, deletedAt: null },
    orderBy: { createdAt: "asc" },
    select: { id: true, name: true, slug: true, status: true, publishedAt: true },
  });

  return {
    user: session.user,
    memberships,
    activeTenant: active,
    stores,
    actor: {
      userId: session.user.id,
      tenantId: active.tenantId,
      roleCode: active.roleCode,
      permissions: active.permissions,
    },
  };
});

export async function requireWorkspace(): Promise<Workspace> {
  const workspace = await getWorkspace();
  if (!workspace) throw new UnauthenticatedError();
  return workspace;
}

/** Server-side permission gate. Frontend hiding is never the enforcement point. */
export async function requirePermission(permission: Permission): Promise<Workspace> {
  const workspace = await requireWorkspace();
  if (!workspace.actor.permissions.includes(permission)) {
    throw new ForbiddenError("এই কাজের অনুমতি আপনার role-এ নেই।", {
      requiredPermission: permission,
      role: workspace.actor.roleCode,
    });
  }
  return workspace;
}

/**
 * The active store for the admin UI, falling back to the tenant's first store.
 * Returns null only when the tenant has no store yet (onboarding).
 */
export async function getActiveStore(
  workspace: Workspace,
): Promise<StoreSummary | null> {
  if (workspace.stores.length === 0) return null;
  const jar = await cookies();
  const requested = jar.get(STORE_COOKIE)?.value;
  return workspace.stores.find((store) => store.id === requested) ?? workspace.stores[0];
}

export async function requireActiveStore(): Promise<{ workspace: Workspace; store: StoreSummary }> {
  const workspace = await requireWorkspace();
  const store = await getActiveStore(workspace);
  if (!store) throw new NotFoundError("Store");
  return { workspace, store };
}

/**
 * Page-safe variant: a signed-out visitor is sent to the login screen instead of
 * rendering an error boundary. Server Components render in parallel with their
 * layout, so a page can reach this guard before the layout's redirect runs.
 */
export async function requireActiveStorePage(): Promise<{ workspace: Workspace; store: StoreSummary }> {
  const workspace = await getWorkspace();
  if (!workspace) redirect("/login?next=%2Fadmin");

  const store = await getActiveStore(workspace);
  if (!store) redirect("/onboarding?next=%2Fadmin");

  return { workspace, store };
}

/** Tenant guard: a store id must belong to the actor's tenant. */
export async function assertStoreAccess(actor: ActorContext, storeId: string): Promise<void> {
  const store = await prisma.store.findFirst({
    where: { id: storeId, deletedAt: null },
    select: { tenantId: true },
  });
  if (!store) throw new NotFoundError("Store");
  if (store.tenantId !== actor.tenantId) throw new TenantMismatchError();
}

export async function findStoreBySlug(slug: string) {
  return prisma.store.findFirst({
    where: { slug, deletedAt: null },
    include: { settings: true, tenant: { select: { id: true, status: true } } },
  });
}

// ── API-side authentication ──────────────────────────────────────────────────

export async function authenticateRequest(request: Request): Promise<SessionUser> {
  const authorization = request.headers.get("authorization");
  if (authorization?.startsWith("Bearer ")) {
    const { verifyAccessToken } = await import("@/lib/auth/tokens");
    const claims = await verifyAccessToken(authorization.slice(7).trim());
    if (!claims) throw new UnauthenticatedError("Access token অবৈধ বা মেয়াদোত্তীর্ণ।");
    const user = await prisma.user.findUnique({
      where: { id: claims.sub },
      select: { id: true, phone: true, email: true, name: true, isSuperAdmin: true, status: true },
    });
    if (!user || user.status !== "ACTIVE") throw new UnauthenticatedError();
    return user;
  }

  const session = await readSession();
  if (!session) throw new UnauthenticatedError();
  return session.user;
}

/**
 * Resolve tenant context for an API request: `X-Tenant-Id` header, then the
 * tenant cookie, then the user's first membership.
 */
export async function resolveApiActor(
  request: Request,
  user: SessionUser,
): Promise<ActorContext> {
  const rows = await prisma.membership.findMany({
    where: { userId: user.id, status: "ACTIVE" },
    include: { role: true },
    orderBy: { createdAt: "asc" },
  });
  if (rows.length === 0) {
    throw new ForbiddenError("আপনার কোনো active workspace নেই।");
  }

  const requested =
    request.headers.get("x-tenant-id") ??
    (request.headers.get("cookie") ?? "")
      .split(";")
      .map((p) => p.trim())
      .find((p) => p.startsWith("atlas_tenant="))
      ?.split("=")[1];

  const row = rows.find((r) => r.tenantId === requested) ?? rows[0];
  return {
    userId: user.id,
    tenantId: row.tenantId,
    roleCode: row.role.code,
    permissions: permissionsForRole(row.role.code, row.role.permissionsJson),
  };
}
