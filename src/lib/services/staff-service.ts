import { z } from "zod";
import { prisma } from "@/lib/db";
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from "@/lib/errors";
import {
  PERMISSIONS,
  assertPermission,
  customRoleCode,
  isOwner,
  parsePermissions,
  permissionsAreSubset,
  permissionsForRole,
  type ActorContext,
} from "@/lib/rbac";
import { assertStaffSeatAvailable, requireWritableTenant } from "@/lib/entitlements";
import { normalizePhone } from "@/lib/auth/otp";
import { recordAudit } from "@/lib/audit";
import { randomSuffix } from "@/lib/slug";

/**
 * Staff and roles (FR-02, PRD §4.4).
 *
 * Inviting a teammate creates the user if the phone is new, then a membership
 * bound to one of the tenant's system roles. Seat limits are enforced here, not
 * in the UI.
 */

export const staffInviteSchema = z.object({
  name: z.string().min(2, "নাম লিখুন।").max(120),
  phone: z.string().min(6, "মোবাইল নম্বর দিন।").max(20),
  /** System code (ADMIN/MANAGER/…) or a tenant-defined `CUSTOM_*` code. */
  roleCode: z.string().min(1).max(64).default("STAFF"),
});

export const roleInputSchema = z.object({
  name: z.string().trim().min(2, "রোলের নাম লিখুন।").max(60),
  permissions: z
    .array(z.string())
    .min(1, "অন্তত একটি অনুমতি বেছে নিন।")
    .refine(
      (values) => values.every((value) => (PERMISSIONS as readonly string[]).includes(value)),
      "অজানা অনুমতি পাওয়া গেছে।",
    ),
});

type RoleRow = { code: string; permissionsJson: unknown };

/**
 * A staff manager may only hand out permissions they already hold. Without
 * this an ADMIN could invite a teammate as a billing role (or assign one to
 * themselves) and escalate past their own permission set.
 */
function assertCanGrantRole(actor: ActorContext, role: RoleRow): string[] {
  if (role.code === "OWNER") {
    throw new ValidationError("Owner role শুধু ownership transfer দিয়ে দেওয়া যায়।");
  }
  const permissions = permissionsForRole(role.code, role.permissionsJson);
  if (!permissionsAreSubset(permissions, actor.permissions)) {
    throw new ForbiddenError("নিজের role-এর বাইরের অনুমতি আপনি দিতে বা নিতে পারবেন না।", {
      role: actor.roleCode,
    });
  }
  return permissions;
}

export async function listRoles(tenantId: string) {
  return prisma.role.findMany({
    where: { tenantId },
    select: {
      id: true,
      code: true,
      name: true,
      permissionsJson: true,
      isSystem: true,
      _count: { select: { memberships: true } },
    },
    orderBy: { createdAt: "asc" },
  });
}

export async function listStaff(tenantId: string) {
  return prisma.membership.findMany({
    where: { tenantId },
    include: {
      user: { select: { id: true, name: true, phone: true, email: true, lastLoginAt: true } },
      role: { select: { id: true, code: true, name: true } },
    },
    orderBy: { createdAt: "asc" },
  });
}

export async function inviteStaff(actor: ActorContext, raw: unknown) {
  assertPermission(actor, "staff:write");
  const input = staffInviteSchema.parse(raw);
  const phone = normalizePhone(input.phone);

  const snapshot = await requireWritableTenant(actor.tenantId);
  assertStaffSeatAvailable(snapshot);

  const role = await prisma.role.findFirst({
    where: { tenantId: actor.tenantId, code: input.roleCode },
    select: { id: true, code: true, permissionsJson: true },
  });
  if (!role) throw new NotFoundError("Role");
  assertCanGrantRole(actor, role);

  const user = await prisma.user.upsert({
    where: { phone },
    create: { phone, name: input.name, status: "ACTIVE" },
    update: { name: input.name },
    select: { id: true },
  });

  const existing = await prisma.membership.findUnique({
    where: { tenantId_userId: { tenantId: actor.tenantId, userId: user.id } },
    select: { id: true },
  });
  if (existing) throw new ConflictError("এই নম্বরের সদস্য আগেই টিমে আছেন।");

  const membership = await prisma.membership.create({
    data: {
      tenantId: actor.tenantId,
      userId: user.id,
      roleId: role.id,
      status: "ACTIVE",
      acceptedAt: new Date(),
    },
  });

  await recordAudit({
    action: "staff.invited",
    tenantId: actor.tenantId,
    actorId: actor.userId,
    resourceType: "Membership",
    resourceId: membership.id,
    metadata: { phone, roleCode: input.roleCode },
  });

  return membership;
}

export async function updateStaffRole(
  actor: ActorContext,
  membershipId: string,
  roleCode: string,
) {
  assertPermission(actor, "staff:write");
  await requireWritableTenant(actor.tenantId);

  const membership = await prisma.membership.findFirst({
    where: { id: membershipId, tenantId: actor.tenantId },
    select: {
      id: true,
      userId: true,
      roleId: true,
      role: { select: { code: true } },
    },
  });
  if (!membership) throw new NotFoundError("Membership");
  if (membership.userId === actor.userId) {
    throw new ConflictError("নিজের role নিজে বদলাতে পারবেন না। Owner-কে অনুরোধ করুন।");
  }
  if (membership.role.code === "OWNER") {
    throw new ConflictError("Owner-এর role বদলানো যায় না।");
  }

  const role = await prisma.role.findFirst({
    where: { tenantId: actor.tenantId, code: roleCode },
    select: { id: true, code: true, permissionsJson: true },
  });
  if (!role) throw new NotFoundError("Role");
  assertCanGrantRole(actor, role);
  if (role.id === membership.roleId) return membership;

  const updated = await prisma.membership.update({
    where: { id: membershipId },
    data: { roleId: role.id },
  });

  await recordAudit({
    action: "staff.role_changed",
    tenantId: actor.tenantId,
    actorId: actor.userId,
    resourceType: "Membership",
    resourceId: membershipId,
    metadata: { from: membership.role.code, to: role.code },
  });
  return updated;
}

/**
 * The only path that may assign the OWNER role. It is deliberately not exposed
 * through the generic invite/update endpoints: the current owner must initiate
 * it, and the previous owner is demoted to ADMIN in the same transaction.
 */
export async function transferOwnership(actor: ActorContext, membershipId: string) {
  if (!isOwner(actor)) {
    throw new ForbiddenError("শুধু বর্তমান Owner ownership transfer করতে পারেন।");
  }
  await requireWritableTenant(actor.tenantId);

  const tenant = await prisma.tenant.findUnique({
    where: { id: actor.tenantId },
    select: { ownerUserId: true },
  });
  if (!tenant) throw new NotFoundError("Tenant");
  if (tenant.ownerUserId !== actor.userId) {
    throw new ForbiddenError("Tenant owner record আপনার সঙ্গে মেলেনি।");
  }

  const target = await prisma.membership.findFirst({
    where: { id: membershipId, tenantId: actor.tenantId },
    select: { id: true, userId: true, role: { select: { code: true } } },
  });
  if (!target) throw new NotFoundError("Membership");
  if (target.role.code === "OWNER" || target.userId === actor.userId) {
    throw new ConflictError("এই সদস্য ইতিমধ্যে Owner।");
  }

  const [ownerRole, adminRole] = await Promise.all([
    prisma.role.findFirst({
      where: { tenantId: actor.tenantId, code: "OWNER" },
      select: { id: true },
    }),
    prisma.role.findFirst({
      where: { tenantId: actor.tenantId, code: "ADMIN" },
      select: { id: true },
    }),
  ]);
  if (!ownerRole || !adminRole) throw new NotFoundError("Role");

  const previousOwnerMembership = await prisma.membership.findUnique({
    where: { tenantId_userId: { tenantId: actor.tenantId, userId: actor.userId } },
    select: { id: true },
  });
  if (!previousOwnerMembership) throw new NotFoundError("Membership");

  await prisma.$transaction(async (tx) => {
    await tx.tenant.update({
      where: { id: actor.tenantId },
      data: { ownerUserId: target.userId },
    });
    await tx.membership.update({
      where: { id: target.id },
      data: { roleId: ownerRole.id },
    });
    await tx.membership.update({
      where: { id: previousOwnerMembership.id },
      data: { roleId: adminRole.id },
    });
    await tx.auditLog.create({
      data: {
        tenantId: actor.tenantId,
        actorId: actor.userId,
        action: "staff.ownership_transferred",
        resourceType: "Membership",
        resourceId: target.id,
        metadataJson: { fromUserId: actor.userId, toUserId: target.userId },
      },
    });
  });

  return { ok: true, ownerUserId: target.userId };
}

export async function removeStaff(actor: ActorContext, membershipId: string) {
  assertPermission(actor, "staff:write");
  await requireWritableTenant(actor.tenantId);

  const membership = await prisma.membership.findFirst({
    where: { id: membershipId, tenantId: actor.tenantId },
    include: { role: { select: { code: true } } },
  });
  if (!membership) throw new NotFoundError("Membership");
  if (membership.userId === actor.userId) {
    throw new ConflictError("নিজেকে টিম থেকে সরানো যায় না।");
  }
  if (membership.role.code === "OWNER") {
    throw new ConflictError("Owner-কে টিম থেকে সরানো যায় না।");
  }

  await prisma.membership.delete({ where: { id: membershipId } });
  await recordAudit({
    action: "staff.removed",
    tenantId: actor.tenantId,
    actorId: actor.userId,
    resourceType: "Membership",
    resourceId: membershipId,
    metadata: { userId: membership.userId, roleCode: membership.role.code },
  });
  return { removed: true };
}

// ── Tenant-defined roles ─────────────────────────────────────────────────────

export async function createRole(actor: ActorContext, raw: unknown) {
  assertPermission(actor, "staff:write");
  if (!isOwner(actor)) {
    throw new ForbiddenError("কাস্টম রোল শুধু Owner তৈরি করতে পারেন।");
  }
  await requireWritableTenant(actor.tenantId);

  const input = roleInputSchema.parse(raw);
  const permissions = parsePermissions(input.permissions);
  if (permissions.length === 0) throw new ValidationError("অন্তত একটি বৈধ অনুমতি বেছে নিন।");

  const existing = await prisma.role.findMany({
    where: { tenantId: actor.tenantId },
    select: { code: true },
  });
  const used = new Set(existing.map((role) => role.code));
  let code = customRoleCode(input.name);
  if (used.has(code)) code = customRoleCode(input.name, randomSuffix(4));
  while (used.has(code)) code = customRoleCode(input.name, randomSuffix(5));

  const role = await prisma.role.create({
    data: {
      tenantId: actor.tenantId,
      code,
      name: input.name,
      permissionsJson: permissions as never,
      isSystem: false,
    },
  });

  await recordAudit({
    action: "staff.role_created",
    tenantId: actor.tenantId,
    actorId: actor.userId,
    resourceType: "Role",
    resourceId: role.id,
    metadata: { code, name: input.name, permissions },
  });
  return role;
}

export async function updateRole(actor: ActorContext, roleId: string, raw: unknown) {
  assertPermission(actor, "staff:write");
  if (!isOwner(actor)) {
    throw new ForbiddenError("রোল সম্পাদনা শুধু Owner করতে পারেন।");
  }
  await requireWritableTenant(actor.tenantId);

  const input = roleInputSchema.parse(raw);
  const permissions = parsePermissions(input.permissions);
  if (permissions.length === 0) throw new ValidationError("অন্তত একটি বৈধ অনুমতি বেছে নিন।");

  const role = await prisma.role.findFirst({
    where: { id: roleId, tenantId: actor.tenantId },
    select: { id: true, code: true, name: true, isSystem: true },
  });
  if (!role) throw new NotFoundError("Role");
  if (role.isSystem) {
    throw new ConflictError("সিস্টেম রোল সম্পাদনাযোগ্য নয় — কাস্টম রোল তৈরি করুন।");
  }

  const updated = await prisma.role.update({
    where: { id: role.id },
    data: { name: input.name, permissionsJson: permissions as never },
  });

  await recordAudit({
    action: "staff.role_updated",
    tenantId: actor.tenantId,
    actorId: actor.userId,
    resourceType: "Role",
    resourceId: role.id,
    metadata: { code: role.code, name: input.name, permissions },
  });
  return updated;
}

export async function deleteRole(actor: ActorContext, roleId: string) {
  assertPermission(actor, "staff:write");
  if (!isOwner(actor)) {
    throw new ForbiddenError("রোল মুছে ফেলা শুধু Owner করতে পারেন।");
  }
  await requireWritableTenant(actor.tenantId);

  const role = await prisma.role.findFirst({
    where: { id: roleId, tenantId: actor.tenantId },
    select: {
      id: true,
      code: true,
      name: true,
      isSystem: true,
      _count: { select: { memberships: true } },
    },
  });
  if (!role) throw new NotFoundError("Role");
  if (role.isSystem) throw new ConflictError("সিস্টেম রোল মুছে ফেলা যায় না।");
  if (role._count.memberships > 0) {
    throw new ConflictError("এই রোলে সদস্য আছে — আগে তাদের অন্য role দিন।");
  }

  await prisma.role.delete({ where: { id: role.id } });
  await recordAudit({
    action: "staff.role_deleted",
    tenantId: actor.tenantId,
    actorId: actor.userId,
    resourceType: "Role",
    resourceId: role.id,
    metadata: { code: role.code, name: role.name },
  });
  return { deleted: true };
}
