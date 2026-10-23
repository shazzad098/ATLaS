import { z } from "zod";
import { prisma } from "@/lib/db";
import { ConflictError, NotFoundError } from "@/lib/errors";
import { ROLE_CODES, assertPermission, type ActorContext, type RoleCode } from "@/lib/rbac";
import { assertStaffSeatAvailable, loadEntitlementSnapshot } from "@/lib/entitlements";
import { normalizePhone } from "@/lib/auth/otp";
import { recordAudit } from "@/lib/audit";

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
  roleCode: z.enum(ROLE_CODES as unknown as [RoleCode, ...RoleCode[]]).default("STAFF"),
});

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

  const snapshot = await loadEntitlementSnapshot(actor.tenantId);
  assertStaffSeatAvailable(snapshot);

  const role = await prisma.role.findFirst({
    where: { tenantId: actor.tenantId, code: input.roleCode },
    select: { id: true },
  });
  if (!role) throw new NotFoundError("Role");

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
  roleCode: RoleCode,
) {
  assertPermission(actor, "staff:write");

  const membership = await prisma.membership.findFirst({
    where: { id: membershipId, tenantId: actor.tenantId },
    include: { role: { select: { code: true } } },
  });
  if (!membership) throw new NotFoundError("Membership");
  if (membership.role.code === "OWNER") {
    throw new ConflictError("Owner-এর role বদলানো যায় না।");
  }

  const role = await prisma.role.findFirst({
    where: { tenantId: actor.tenantId, code: roleCode },
    select: { id: true },
  });
  if (!role) throw new NotFoundError("Role");

  return prisma.membership.update({ where: { id: membershipId }, data: { roleId: role.id } });
}

export async function removeStaff(actor: ActorContext, membershipId: string) {
  assertPermission(actor, "staff:write");

  const membership = await prisma.membership.findFirst({
    where: { id: membershipId, tenantId: actor.tenantId },
    include: { role: { select: { code: true } } },
  });
  if (!membership) throw new NotFoundError("Membership");
  if (membership.role.code === "OWNER") {
    throw new ConflictError("Owner-কে টিম থেকে সরানো যায় না।");
  }

  await prisma.membership.delete({ where: { id: membershipId } });
  return { removed: true };
}
