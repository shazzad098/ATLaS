import { prisma } from "@/lib/db";
import { AppError, ConflictError, NotFoundError } from "@/lib/errors";
import { PERMISSIONS, ROLE_CODES, SYSTEM_ROLES, type ActorContext, type RoleCode } from "@/lib/rbac";
import { checkPasswordStrength, hashPassword, verifyPassword } from "@/lib/auth/password";
import { normalizePhone } from "@/lib/auth/otp";
import { recordAudit } from "@/lib/audit";
import { notify, NOTIFICATION_TYPES } from "@/lib/notifications";
import { ensureSubscription } from "@/lib/services/billing-service";
import { invalidateEntitlements } from "@/lib/entitlements";
import { ensureThemeCatalog } from "@/lib/services/theme-service";

/**
 * Account provisioning (FR-01, FR-02).
 *
 * A successful signup creates the user, their tenant, the five system roles, an
 * OWNER membership and a Free subscription — the same shape the seed builds, so
 * a new merchant lands in an identical workspace.
 */

export type ProvisionedAccount = {
  userId: string;
  tenantId: string;
  actor: ActorContext;
};

export async function ensureSystemRoles(tenantId: string): Promise<Map<RoleCode, string>> {
  const map = new Map<RoleCode, string>();
  for (const code of ROLE_CODES) {
    const role = await prisma.role.upsert({
      where: { tenantId_code: { tenantId, code } },
      create: {
        tenantId,
        code,
        name: SYSTEM_ROLES[code].name,
        permissionsJson: SYSTEM_ROLES[code].permissions as never,
        isSystem: true,
      },
      update: {
        name: SYSTEM_ROLES[code].name,
        permissionsJson: SYSTEM_ROLES[code].permissions as never,
      },
    });
    map.set(code, role.id);
  }
  return map;
}

/**
 * Account self-service (FR-01, PRD §13).
 *
 * Profile, password and deletion all operate on the signed-in user only — the
 * caller passes `userId` from the verified session, never from a form field.
 */

export const DELETION_RETENTION_DAYS = 30;

export async function getAccountProfile(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      phone: true,
      email: true,
      name: true,
      status: true,
      isSuperAdmin: true,
      passwordHash: true,
      phoneVerifiedAt: true,
      lastLoginAt: true,
      createdAt: true,
    },
  });
  if (!user) throw new NotFoundError("User");

  const [memberships, sessions, deletionRequest] = await Promise.all([
    prisma.membership.findMany({
      where: { userId, status: { in: ["ACTIVE", "INVITED"] } },
      include: { tenant: { select: { name: true } }, role: { select: { name: true } } },
    }),
    prisma.session.count({ where: { userId, revokedAt: null, expiresAt: { gt: new Date() } } }),
    latestDeletionRequest(userId),
  ]);

  return { user, memberships, sessionCount: sessions, deletionRequest };
}

export async function updateAccountProfile(
  userId: string,
  input: { name: string; email?: string | null },
): Promise<void> {
  const name = input.name.trim();
  if (name.length < 2) {
    throw new AppError("VALIDATION_FAILED", "আপনার নাম অন্তত ২ অক্ষরের হতে হবে।", 422, { field: "name" });
  }

  const email = input.email?.trim().toLowerCase() || null;
  if (email) {
    const taken = await prisma.user.findFirst({
      where: { email, deletedAt: null, id: { not: userId } },
      select: { id: true },
    });
    if (taken) throw new ConflictError("এই ইমেইল আগেই ব্যবহার হয়েছে।");
  }

  await prisma.user.update({ where: { id: userId }, data: { name, email } });
  await prisma.tenant.updateMany({ where: { ownerUserId: userId }, data: { name } });
  await recordAudit({ action: "account.profile_updated", actorId: userId, resourceType: "User", resourceId: userId });
}

export async function changePassword(
  userId: string,
  input: { currentPassword: string; newPassword: string },
): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, passwordHash: true },
  });
  if (!user) throw new NotFoundError("User");

  if (user.passwordHash && !(await verifyPassword(input.currentPassword, user.passwordHash))) {
    throw new AppError("VALIDATION_FAILED", "বর্তমান পাসওয়ার্ড মিলছে না।", 422, { field: "currentPassword" });
  }

  const strength = checkPasswordStrength(input.newPassword);
  if (!strength.ok) {
    throw new AppError("VALIDATION_FAILED", strength.problems.join(" "), 422, { field: "newPassword" });
  }

  await prisma.user.update({
    where: { id: userId },
    data: { passwordHash: await hashPassword(input.newPassword) },
  });
  await recordAudit({ action: "account.password_changed", actorId: userId, resourceType: "User", resourceId: userId });
}

/** OTP-verified reset for a forgotten password; the code is checked by the caller. */
export async function resetPassword(userId: string, newPassword: string): Promise<void> {
  const strength = checkPasswordStrength(newPassword);
  if (!strength.ok) {
    throw new AppError("VALIDATION_FAILED", strength.problems.join(" "), 422, { field: "password" });
  }
  await prisma.user.update({
    where: { id: userId },
    data: { passwordHash: await hashPassword(newPassword) },
  });
  await recordAudit({ action: "account.password_reset", actorId: userId, resourceType: "User", resourceId: userId });
}

/** Resolve the account behind whatever identifier the merchant typed at login. */
export async function findUserByIdentifier(identifier: string) {
  const trimmed = identifier.trim();
  if (!trimmed) return null;
  const phone = normalizePhone(trimmed);
  return prisma.user.findFirst({
    where: {
      deletedAt: null,
      OR: [{ phone }, { email: trimmed.toLowerCase() }],
    },
    select: { id: true, phone: true, email: true, name: true, status: true },
  });
}

/**
 * Deletion request (PRD §13).
 *
 * Nothing is erased immediately: the request is recorded in the audit trail and
 * a 30-day retention window starts, which is also what the UI reports. Data is
 * only purged by the platform operator, so a mistaken request is recoverable.
 */
export async function requestAccountDeletion(
  userId: string,
  input: { reason?: string } = {},
): Promise<{ effectiveAt: Date }> {
  const effectiveAt = new Date(Date.now() + DELETION_RETENTION_DAYS * 24 * 60 * 60 * 1000);

  await recordAudit({
    action: "account.deletion_requested",
    actorId: userId,
    resourceType: "User",
    resourceId: userId,
    metadata: { reason: input.reason ?? null, effectiveAt: effectiveAt.toISOString() },
  });

  await notify({
    userId,
    type: "account.deletion_requested",
    title: "অ্যাকাউন্ট মুছে ফেলার অনুরোধ গৃহীত",
    body: `${DELETION_RETENTION_DAYS} দিনের মধ্যে বাতিল করতে পারবেন। এরপর ডেটা স্থায়ীভাবে মুছে যাবে।`,
    payload: { effectiveAt: effectiveAt.toISOString() },
  });

  return { effectiveAt };
}

export async function cancelAccountDeletion(userId: string): Promise<void> {
  await recordAudit({
    action: "account.deletion_cancelled",
    actorId: userId,
    resourceType: "User",
    resourceId: userId,
  });
}

/** Latest request wins, so a cancel simply supersedes the earlier request. */
async function latestDeletionRequest(userId: string) {
  const rows = await prisma.auditLog.findMany({
    where: {
      actorId: userId,
      action: { in: ["account.deletion_requested", "account.deletion_cancelled"] },
    },
    orderBy: { createdAt: "desc" },
    take: 1,
    select: { action: true, createdAt: true, metadataJson: true },
  });

  const row = rows[0];
  if (!row || row.action !== "account.deletion_requested") return null;

  const metadata = (row.metadataJson ?? {}) as { effectiveAt?: string; reason?: string };
  return {
    requestedAt: row.createdAt,
    effectiveAt: metadata.effectiveAt ? new Date(metadata.effectiveAt) : null,
    reason: metadata.reason ?? null,
  };
}

export async function accountDeletionStatus(userId: string) {
  return latestDeletionRequest(userId);
}

export async function provisionAccount(input: {
  phone: string;
  name: string;
  email?: string | null;
  password: string;
}): Promise<ProvisionedAccount> {
  const phone = normalizePhone(input.phone);

  const existing = await prisma.user.findFirst({
    where: { phone, deletedAt: null },
    select: { id: true },
  });
  if (existing) {
    throw new ConflictError("এই মোবাইল নম্বর দিয়ে আগেই অ্যাকাউন্ট আছে।");
  }

  await ensureThemeCatalog();

  const passwordHash = await hashPassword(input.password);

  return prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        phone,
        name: input.name,
        email: input.email || null,
        passwordHash,
        status: "ACTIVE",
        phoneVerifiedAt: new Date(),
        lastLoginAt: new Date(),
      },
    });

    const tenant = await tx.tenant.create({
      data: {
        name: input.name,
        ownerUserId: user.id,
        status: "ACTIVE",
        timezone: "Asia/Dhaka",
        currency: "BDT",
      },
    });

    const roles = new Map<RoleCode, string>();
    for (const code of ROLE_CODES) {
      const role = await tx.role.create({
        data: {
          tenantId: tenant.id,
          code,
          name: SYSTEM_ROLES[code].name,
          permissionsJson: SYSTEM_ROLES[code].permissions as never,
          isSystem: true,
        },
      });
      roles.set(code, role.id);
    }

    await tx.membership.create({
      data: {
        tenantId: tenant.id,
        userId: user.id,
        roleId: roles.get("OWNER")!,
        status: "ACTIVE",
        acceptedAt: new Date(),
      },
    });

    return { user, tenant };
  }).then(async ({ user, tenant }) => {
    await ensureSubscription(tenant.id);
    invalidateEntitlements(tenant.id);

    return {
      userId: user.id,
      tenantId: tenant.id,
      actor: {
        userId: user.id,
        tenantId: tenant.id,
        roleCode: "OWNER" as const,
        permissions: [...PERMISSIONS],
      },
    };
  });
}
