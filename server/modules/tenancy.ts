import { and, desc, eq, gt, inArray, isNull, sql } from "drizzle-orm";
import { db } from "../db";
import { impersonationSessions, memberships, roles, stores, tenants, users, type User } from "../../drizzle/schema";
import { PERMISSIONS, SYSTEM_ROLES, type Permission, type SystemRoleCode } from "../../shared/permissions";
import { fail } from "../lib/core";
import { randomToken, tokenHash } from "../lib/crypto";
import { assertStaffSeat, assertWritable, getEntitlements, planRank, type Entitlements } from "./billing";
import { audit, sendEmail } from "./ops";

export type Store = typeof stores.$inferSelect;
export type TenantScope = {
  tenantId: number;
  storeId: number;
  store: Store;
  roleCode: string;
  roleName: string;
  permissions: Set<Permission>;
  ent: Entitlements;
  isOwner: boolean;
  impersonationId: number | null;
  userId: number;
};

/* ───────── System roles ───────── */
let roleCache: Map<string, typeof roles.$inferSelect> | null = null;
export async function systemRoles() {
  if (roleCache) return roleCache;
  const rows = await db().select().from(roles).where(isNull(roles.tenantId));
  const map = new Map(rows.map(r => [r.code, r]));
  for (const r of SYSTEM_ROLES) {
    const existing = map.get(r.code);
    if (!existing) {
      const [row] = await db().insert(roles).values({ tenantId: null, code: r.code, name: r.name, permissionsJson: r.permissions, isSystem: true }).$returningId();
      map.set(r.code, { id: row.id, tenantId: null, code: r.code, name: r.name, permissionsJson: r.permissions, isSystem: true });
    } else if (JSON.stringify(existing.permissionsJson) !== JSON.stringify(r.permissions)) {
      await db().update(roles).set({ permissionsJson: r.permissions, name: r.name }).where(eq(roles.id, existing.id));
      existing.permissionsJson = r.permissions;
    }
  }
  roleCache = map;
  return map;
}
export async function roleId(code: SystemRoleCode) {
  const r = (await systemRoles()).get(code);
  if (!r) fail("INTERNAL", `Role ${code} missing`);
  return r.id;
}

/* ───────── Workspaces ───────── */
export async function listWorkspaces(userId: number) {
  const rows = await db()
    .select({
      tenantId: tenants.id,
      tenantName: tenants.name,
      tenantStatus: tenants.status,
      storeId: stores.id,
      storeName: stores.name,
      slug: stores.slug,
      logoUrl: stores.logoUrl,
      storeStatus: stores.status,
      roleCode: roles.code,
      roleName: roles.name,
    })
    .from(memberships)
    .innerJoin(tenants, eq(tenants.id, memberships.tenantId))
    .innerJoin(stores, eq(stores.tenantId, tenants.id))
    .innerJoin(roles, eq(roles.id, memberships.roleId))
    .where(and(eq(memberships.userId, userId), eq(memberships.status, "active")))
    .orderBy(desc(tenants.id));
  return rows;
}

export async function activeImpersonation(adminUserId: number, tenantId: number) {
  const [row] = await db()
    .select()
    .from(impersonationSessions)
    .where(
      and(
        eq(impersonationSessions.adminUserId, adminUserId),
        eq(impersonationSessions.tenantId, tenantId),
        isNull(impersonationSessions.endedAt),
        gt(impersonationSessions.expiresAt, new Date())
      )
    )
    .orderBy(desc(impersonationSessions.id))
    .limit(1);
  return row ?? null;
}

/** Derives the tenant scope server-side. The client only names a workspace; membership is always verified. */
export async function resolveScope(user: User, tenantId: number): Promise<TenantScope> {
  const [store] = await db().select().from(stores).where(eq(stores.tenantId, tenantId)).limit(1);
  if (!store) fail("NOT_FOUND", "Store not found");
  const ent = await getEntitlements(tenantId);
  if (user.platformRole === "super_admin" || user.platformRole === "support") {
    const imp = await activeImpersonation(user.id, tenantId);
    if (imp) {
      return {
        tenantId,
        storeId: store.id,
        store,
        roleCode: "owner",
        roleName: "Impersonating (owner)",
        permissions: new Set(PERMISSIONS.filter(p => p !== "billing.manage")),
        ent,
        isOwner: false,
        impersonationId: imp.id,
        userId: user.id,
      };
    }
  }
  const [m] = await db()
    .select({ roleCode: roles.code, roleName: roles.name, perms: roles.permissionsJson })
    .from(memberships)
    .innerJoin(roles, eq(roles.id, memberships.roleId))
    .where(and(eq(memberships.tenantId, tenantId), eq(memberships.userId, user.id), eq(memberships.status, "active")))
    .limit(1);
  if (!m) fail("FORBIDDEN", "You don't have access to this store");
  return {
    tenantId,
    storeId: store.id,
    store,
    roleCode: m.roleCode,
    roleName: m.roleName,
    permissions: new Set(m.perms as Permission[]),
    ent,
    isOwner: m.roleCode === "owner",
    impersonationId: null,
    userId: user.id,
  };
}

export function requirePerm(scope: TenantScope, perm: Permission) {
  if (!scope.permissions.has(perm)) fail("FORBIDDEN", `Your role (${scope.roleName}) can't perform this action (${perm}).`);
}
export function requireWrite(scope: TenantScope, perm: Permission) {
  requirePerm(scope, perm);
  if (perm !== "billing.manage") assertWritable(scope.ent);
}

/* ───────── Staff & roles ───────── */
export async function listStaff(tenantId: number) {
  const rows = await db()
    .select({
      id: memberships.id,
      userId: memberships.userId,
      status: memberships.status,
      inviteEmail: memberships.inviteEmail,
      invitedAt: memberships.invitedAt,
      acceptedAt: memberships.acceptedAt,
      roleCode: roles.code,
      roleName: roles.name,
      name: users.name,
      email: users.email,
      phone: users.phone,
    })
    .from(memberships)
    .innerJoin(roles, eq(roles.id, memberships.roleId))
    .leftJoin(users, eq(users.id, memberships.userId))
    .where(and(eq(memberships.tenantId, tenantId), inArray(memberships.status, ["active", "invited"])));
  return rows;
}

export function rolesForPlan(planCode: string) {
  return SYSTEM_ROLES.filter(r => r.code !== "owner").map(r => ({ ...r, available: planRank(planCode) >= planRank(r.minPlan) }));
}

export async function inviteStaff(scope: TenantScope, input: { email: string; roleCode: SystemRoleCode }, origin: string) {
  requireWrite(scope, "staff.manage");
  if (input.roleCode === "owner") fail("VALIDATION", "There can only be one owner");
  const role = SYSTEM_ROLES.find(r => r.code === input.roleCode);
  if (!role) fail("VALIDATION", "Unknown role");
  if (planRank(scope.ent.effectivePlanCode) < planRank(role.minPlan)) fail("FEATURE_NOT_IN_PLAN", `The ${role.name} role requires the ${role.minPlan} plan or above.`, { requiredPlan: role.minPlan });
  await assertStaffSeat(scope.ent);
  const email = input.email.trim().toLowerCase();
  const dup = await db()
    .select({ id: memberships.id })
    .from(memberships)
    .leftJoin(users, eq(users.id, memberships.userId))
    .where(and(eq(memberships.tenantId, scope.tenantId), inArray(memberships.status, ["active", "invited"]), sql`(${memberships.inviteEmail} = ${email} OR ${users.email} = ${email})`))
    .limit(1);
  if (dup.length) fail("CONFLICT", "This person is already a member or invited");
  const token = randomToken(24);
  await db()
    .insert(memberships)
    .values({ tenantId: scope.tenantId, userId: null, roleId: await roleId(input.roleCode), status: "invited", inviteEmail: email, inviteTokenHash: tokenHash(token), invitedBy: scope.userId, invitedAt: new Date() });
  const link = `${origin}/invite/${token}`;
  await sendEmail({ to: email, subject: `You're invited to manage ${scope.store.name} on ATLaS`, body: `Join ${scope.store.name} as ${role.name}: ${link}`, template: "staff_invite", tenantId: scope.tenantId });
  await audit({ tenantId: scope.tenantId, actorId: scope.userId, actorType: "merchant", action: "staff.invited", metadata: { email, role: input.roleCode }, impersonationId: scope.impersonationId });
  return { inviteLink: link };
}

export async function inviteInfo(token: string) {
  const [m] = await db()
    .select({ id: memberships.id, tenantId: memberships.tenantId, email: memberships.inviteEmail, roleName: roles.name, storeName: stores.name })
    .from(memberships)
    .innerJoin(roles, eq(roles.id, memberships.roleId))
    .innerJoin(stores, eq(stores.tenantId, memberships.tenantId))
    .where(and(eq(memberships.inviteTokenHash, tokenHash(token)), eq(memberships.status, "invited")))
    .limit(1);
  return m ?? null;
}

export async function acceptInvite(user: User, token: string) {
  const info = await inviteInfo(token);
  if (!info) fail("NOT_FOUND", "Invitation is invalid or already used");
  const existing = await db()
    .select({ id: memberships.id })
    .from(memberships)
    .where(and(eq(memberships.tenantId, info.tenantId), eq(memberships.userId, user.id)))
    .limit(1);
  if (existing.length) fail("CONFLICT", "You're already a member of this store");
  await db().update(memberships).set({ userId: user.id, status: "active", acceptedAt: new Date(), inviteTokenHash: null }).where(eq(memberships.id, info.id));
  await audit({ tenantId: info.tenantId, actorId: user.id, actorType: "merchant", action: "staff.joined" });
  return { tenantId: info.tenantId };
}

export async function updateStaffRole(scope: TenantScope, membershipId: number, roleCode: SystemRoleCode) {
  requireWrite(scope, "staff.manage");
  const role = SYSTEM_ROLES.find(r => r.code === roleCode);
  if (!role || roleCode === "owner") fail("VALIDATION", "Invalid role");
  if (planRank(scope.ent.effectivePlanCode) < planRank(role.minPlan)) fail("FEATURE_NOT_IN_PLAN", `${role.name} requires the ${role.minPlan} plan`, { requiredPlan: role.minPlan });
  const [m] = await db().select().from(memberships).where(and(eq(memberships.id, membershipId), eq(memberships.tenantId, scope.tenantId))).limit(1);
  if (!m) fail("NOT_FOUND", "Member not found");
  if (m.roleId === (await roleId("owner"))) fail("FORBIDDEN", "The owner's role can't be changed");
  await db().update(memberships).set({ roleId: await roleId(roleCode) }).where(eq(memberships.id, m.id));
  await audit({ tenantId: scope.tenantId, actorId: scope.userId, actorType: "merchant", action: "staff.role_changed", resourceId: m.id, metadata: { roleCode }, impersonationId: scope.impersonationId });
}

export async function removeStaff(scope: TenantScope, membershipId: number) {
  requireWrite(scope, "staff.manage");
  const [m] = await db().select().from(memberships).where(and(eq(memberships.id, membershipId), eq(memberships.tenantId, scope.tenantId))).limit(1);
  if (!m) fail("NOT_FOUND", "Member not found");
  if (m.roleId === (await roleId("owner"))) fail("FORBIDDEN", "The owner can't be removed");
  await db().update(memberships).set({ status: "revoked", inviteTokenHash: null }).where(eq(memberships.id, m.id));
  await audit({ tenantId: scope.tenantId, actorId: scope.userId, actorType: "merchant", action: "staff.removed", resourceId: m.id, impersonationId: scope.impersonationId });
}
