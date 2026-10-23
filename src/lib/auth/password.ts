import { compare, hash } from "bcryptjs";

/**
 * Password hashing (PRD §13: never plaintext, Argon2id or bcrypt).
 *
 * bcrypt with cost 12 is used because it needs no native build step, which
 * keeps local and container installs identical. `passwordHash` may be null for
 * passwordless (OTP-only) accounts.
 */

const COST = 12;

export async function hashPassword(plain: string): Promise<string> {
  return hash(plain, COST);
}

export async function verifyPassword(plain: string, stored: string | null): Promise<boolean> {
  if (!stored) return false;
  try {
    return await compare(plain, stored);
  } catch {
    return false;
  }
}

export type PasswordStrength = { ok: boolean; problems: string[] };

export function checkPasswordStrength(plain: string): PasswordStrength {
  const problems: string[] = [];
  if (plain.length < 8) problems.push("কমপক্ষে ৮ অক্ষর দিন।");
  if (!/[a-zA-Z]/.test(plain)) problems.push("একটি অক্ষর (a-z) থাকতে হবে।");
  if (!/[0-9]/.test(plain)) problems.push("একটি সংখ্যা থাকতে হবে।");
  return { ok: problems.length === 0, problems };
}
