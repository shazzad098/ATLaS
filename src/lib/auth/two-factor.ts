import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { prisma } from "@/lib/db";
import { AppError, UnauthenticatedError, ValidationError } from "@/lib/errors";
import { decryptSecret, hashRecoveryCode, isEncryptedSecret } from "@/lib/crypto";
import { verifyTotp } from "@/lib/auth/totp";
import { env } from "@/lib/env";

/**
 * Second-factor login challenge (FR-01).
 *
 * After the password/OTP step succeeds, a 2FA-enabled account gets nothing but a
 * random challenge token in an httpOnly cookie. The token is stored as a hash,
 * lives five minutes, is single-use and allows five wrong codes. Only then is a
 * real session issued, so neither the password nor an XSS-readable token can
 * bypass the second factor.
 */

export const TWO_FACTOR_COOKIE = "atlas_2fa";
export const CHALLENGE_TTL_SECONDS = 5 * 60;
export const MAX_CHALLENGE_ATTEMPTS = 5;

function hashToken(token: string): string {
  return createHash("sha256").update(`2fa:${token}`).digest("hex");
}

function cookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: !env.isDev,
    path: "/",
    maxAge: CHALLENGE_TTL_SECONDS,
  };
}

export async function beginTwoFactorChallenge(
  userId: string,
  meta: { ip?: string } = {},
): Promise<void> {
  const token = randomBytes(32).toString("base64url");

  await prisma.twoFactorChallenge.deleteMany({
    where: { userId, OR: [{ expiresAt: { lt: new Date() } }, { consumedAt: { not: null } }] },
  });
  await prisma.twoFactorChallenge.create({
    data: {
      userId,
      tokenHash: hashToken(token),
      expiresAt: new Date(Date.now() + CHALLENGE_TTL_SECONDS * 1000),
      ip: meta.ip,
    },
  });

  const jar = await cookies();
  jar.set(TWO_FACTOR_COOKIE, token, cookieOptions());
}

export async function clearTwoFactorChallenge(): Promise<void> {
  const jar = await cookies();
  jar.set(TWO_FACTOR_COOKIE, "", { ...cookieOptions(), maxAge: 0 });
}

export async function readChallengeToken(): Promise<string | null> {
  const jar = await cookies();
  return jar.get(TWO_FACTOR_COOKIE)?.value ?? null;
}

/** Opens the TOTP seed, tolerating rows written before encryption shipped. */
export function openTotpSecret(stored: string | null): string | null {
  if (!stored) return null;
  return isEncryptedSecret(stored) ? decryptSecret(stored) : stored;
}

export type ChallengeResult = { userId: string; via: "totp" | "recovery" };

/**
 * Verify the submitted code against the pending challenge and consume it.
 * Throws an AppError with a user-safe Bangla message on any failure.
 */
export async function completeTwoFactorChallenge(
  token: string | null,
  code: string,
): Promise<ChallengeResult> {
  if (!token) throw new UnauthenticatedError("2FA সেশন পাওয়া যায়নি — আবার লগইন করুন।");

  const challenge = await prisma.twoFactorChallenge.findUnique({
    where: { tokenHash: hashToken(token) },
    include: {
      user: {
        select: { id: true, status: true, twoFactorEnabled: true, twoFactorSecret: true },
      },
    },
  });

  if (!challenge || challenge.consumedAt || challenge.expiresAt < new Date()) {
    throw new UnauthenticatedError("2FA কোডের মেয়াদ শেষ হয়েছে — আবার লগইন করুন।");
  }
  if (challenge.user.status !== "ACTIVE" || !challenge.user.twoFactorEnabled) {
    throw new UnauthenticatedError("এই অ্যাকাউন্টে 2FA এখন সক্রিয় নেই — আবার লগইন করুন।");
  }
  if (challenge.attempts >= MAX_CHALLENGE_ATTEMPTS) {
    throw new AppError("RATE_LIMITED", "অনেকবার ভুল কোড দেওয়া হয়েছে। আবার লগইন করুন।", 429);
  }

  const secret = openTotpSecret(challenge.user.twoFactorSecret);
  const normalized = code.trim();
  let via: ChallengeResult["via"] | null = null;

  if (secret && verifyTotp(secret, normalized)) {
    via = "totp";
  } else if (normalized.length >= 6) {
    const recovery = await prisma.twoFactorRecoveryCode.findFirst({
      where: {
        userId: challenge.userId,
        codeHash: hashRecoveryCode(normalized),
        usedAt: null,
      },
      select: { id: true },
    });
    if (recovery) {
      const consumed = await prisma.twoFactorRecoveryCode.updateMany({
        where: { id: recovery.id, usedAt: null },
        data: { usedAt: new Date() },
      });
      if (consumed.count === 1) via = "recovery";
    }
  }

  if (!via) {
    const attempts = challenge.attempts + 1;
    await prisma.twoFactorChallenge.update({
      where: { id: challenge.id },
      data: { attempts },
    });
    const remaining = Math.max(0, MAX_CHALLENGE_ATTEMPTS - attempts);
    throw new ValidationError(
      remaining === 0
        ? "অনেকবার ভুল হয়েছে — আবার লগইন করুন।"
        : `কোডটি মেলেনি। আরও ${remaining} বার চেষ্টা করা যাবে।`,
    );
  }

  await prisma.twoFactorChallenge.update({
    where: { id: challenge.id },
    data: { consumedAt: new Date() },
  });

  return { userId: challenge.userId, via };
}
