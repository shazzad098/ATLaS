import { prisma } from "@/lib/db";
import { ConflictError, NotFoundError, ValidationError } from "@/lib/errors";
import { encryptSecret, hashRecoveryCode } from "@/lib/crypto";
import {
  generateRecoveryCodes,
  generateTotpSecret,
  otpauthUri,
  verifyTotp,
} from "@/lib/auth/totp";
import { openTotpSecret } from "@/lib/auth/two-factor";
import { verifyPassword } from "@/lib/auth/password";
import { recordAudit } from "@/lib/audit";

/**
 * TOTP enrollment and recovery-code lifecycle (FR-01).
 *
 * The seed is generated server-side and immediately sealed with `SECRETS_KEY`.
 * Confirmation requires a working code, so a half-finished setup can never lock
 * a merchant out. Recovery codes are returned exactly once.
 */

export const RECOVERY_CODE_COUNT = 10;

export type TwoFactorStatus = {
  enabled: boolean;
  confirmedAt: Date | null;
  recoveryCodesRemaining: number;
  pendingSetup: boolean;
};

export async function getTwoFactorStatus(userId: string): Promise<TwoFactorStatus> {
  const [user, codesRemaining] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: { twoFactorEnabled: true, twoFactorConfirmedAt: true, twoFactorSecret: true },
    }),
    prisma.twoFactorRecoveryCode.count({ where: { userId, usedAt: null } }),
  ]);
  if (!user) throw new NotFoundError("User");
  return {
    enabled: user.twoFactorEnabled,
    confirmedAt: user.twoFactorConfirmedAt,
    recoveryCodesRemaining: codesRemaining,
    pendingSetup: Boolean(user.twoFactorSecret) && !user.twoFactorEnabled,
  };
}

export async function startTwoFactorSetup(userId: string): Promise<{
  secret: string;
  otpauthUri: string;
}> {
  const user = await prisma.user.findUnique({
    where: { id: userId, deletedAt: null },
    select: { id: true, phone: true, email: true, twoFactorEnabled: true },
  });
  if (!user) throw new NotFoundError("User");
  if (user.twoFactorEnabled) throw new ConflictError("2FA ইতিমধ্যে চালু আছে।");

  const secret = generateTotpSecret();
  await prisma.user.update({
    where: { id: userId },
    data: {
      twoFactorSecret: encryptSecret(secret),
      twoFactorEnabled: false,
      twoFactorConfirmedAt: null,
    },
  });

  return {
    secret,
    otpauthUri: otpauthUri({ secret, account: user.email ?? user.phone.replace(/^\+/, "") }),
  };
}

export async function confirmTwoFactorSetup(userId: string, code: string): Promise<string[]> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, twoFactorEnabled: true, twoFactorSecret: true },
  });
  if (!user) throw new NotFoundError("User");
  if (user.twoFactorEnabled) throw new ConflictError("2FA ইতিমধ্যে চালু আছে।");

  const secret = openTotpSecret(user.twoFactorSecret);
  if (!secret) throw new ValidationError("আগে 2FA সেটআপ শুরু করুন।");
  if (!verifyTotp(secret, code)) {
    await recordAudit({
      action: "auth.2fa_setup_failed",
      actorId: userId,
      resourceType: "User",
      resourceId: userId,
    });
    throw new ValidationError("কোডটি মেলেনি। অ্যাপের সময় ঠিক আছে কিনা দেখুন।");
  }

  const codes = generateRecoveryCodes(RECOVERY_CODE_COUNT);
  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: userId },
      data: { twoFactorEnabled: true, twoFactorConfirmedAt: new Date() },
    });
    await tx.twoFactorRecoveryCode.deleteMany({ where: { userId } });
    await tx.twoFactorRecoveryCode.createMany({
      data: codes.map((code) => ({ userId, codeHash: hashRecoveryCode(code) })),
    });
  });

  await recordAudit({
    action: "auth.2fa_enabled",
    actorId: userId,
    resourceType: "User",
    resourceId: userId,
    metadata: { recoveryCodes: codes.length },
  });

  return codes;
}

/**
 * Verify a code for a signed-in user. TOTP first, then a one-time recovery code.
 * The recovery code is consumed atomically, so two parallel requests cannot both
 * succeed with the same code.
 */
export async function verifySecondFactor(userId: string, code: string): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { twoFactorEnabled: true, twoFactorSecret: true },
  });
  if (!user?.twoFactorEnabled) return false;

  const secret = openTotpSecret(user.twoFactorSecret);
  const normalized = code.trim();
  if (secret && verifyTotp(secret, normalized)) return true;
  if (normalized.length < 6) return false;

  const recovery = await prisma.twoFactorRecoveryCode.findFirst({
    where: { userId, codeHash: hashRecoveryCode(normalized), usedAt: null },
    select: { id: true },
  });
  if (!recovery) return false;
  const consumed = await prisma.twoFactorRecoveryCode.updateMany({
    where: { id: recovery.id, usedAt: null },
    data: { usedAt: new Date() },
  });
  return consumed.count === 1;
}

export async function regenerateRecoveryCodes(userId: string, code: string): Promise<string[]> {
  const ok = await verifySecondFactor(userId, code);
  if (!ok) {
    await recordAudit({
      action: "auth.2fa_recovery_failed",
      actorId: userId,
      resourceType: "User",
      resourceId: userId,
    });
    throw new ValidationError("কোডটি মেলেনি।");
  }

  const codes = generateRecoveryCodes(RECOVERY_CODE_COUNT);
  await prisma.$transaction(async (tx) => {
    await tx.twoFactorRecoveryCode.deleteMany({ where: { userId } });
    await tx.twoFactorRecoveryCode.createMany({
      data: codes.map((code) => ({ userId, codeHash: hashRecoveryCode(code) })),
    });
  });

  await recordAudit({
    action: "auth.2fa_recovery_regenerated",
    actorId: userId,
    resourceType: "User",
    resourceId: userId,
  });
  return codes;
}

/**
 * Turning 2FA off is itself a sensitive action: it needs the current password
 * (when one exists) plus a live TOTP or recovery code.
 */
export async function disableTwoFactor(
  userId: string,
  input: { code: string; password?: string },
): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { twoFactorEnabled: true, passwordHash: true },
  });
  if (!user?.twoFactorEnabled) throw new ConflictError("2FA চালু নেই।");

  if (user.passwordHash) {
    const passwordOk = await verifyPassword(input.password ?? "", user.passwordHash);
    if (!passwordOk) throw new ValidationError("পাসওয়ার্ড মেলেনি।");
  }
  const codeOk = await verifySecondFactor(userId, input.code);
  if (!codeOk) throw new ValidationError("2FA কোডটি মেলেনি।");

  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: userId },
      data: { twoFactorEnabled: false, twoFactorSecret: null, twoFactorConfirmedAt: null },
    });
    await tx.twoFactorRecoveryCode.deleteMany({ where: { userId } });
    await tx.twoFactorChallenge.deleteMany({ where: { userId } });
  });

  await recordAudit({
    action: "auth.2fa_disabled",
    actorId: userId,
    resourceType: "User",
    resourceId: userId,
  });
}

/** Super Admin accounts are the highest-value target; surface an explicit nudge. */
export async function twoFactorPolicyWarning(userId: string, isSuperAdmin: boolean) {
  if (!isSuperAdmin) return null;
  const status = await getTwoFactorStatus(userId);
  return status.enabled
    ? null
    : "Super Admin অ্যাকাউন্টে 2FA চালু করা strongly recommended — এখান থেকেই সেটআপ করুন।";
}
