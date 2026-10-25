import { createHash, randomBytes } from "node:crypto";

/**
 * Refresh tokens are opaque 256-bit random strings; only their SHA-256 hash is
 * persisted, so a database leak cannot be replayed. The access token is a JWT
 * signed by JwtService (see auth.service.ts).
 */

export function generateRefreshToken(): string {
  return randomBytes(32).toString("base64url");
}

/** Refresh tokens are never stored in plaintext. */
export function hashRefreshToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/** Double-submit CSRF value; readable by JS, paired with the httpOnly refresh cookie. */
export function generateCsrfToken(): string {
  return randomBytes(24).toString("base64url");
}

/**
 * Normalise `01712345678`, `+8801712345678`, `8801712345678` to `+8801712345678`.
 * Must stay byte-for-byte compatible with the Next.js helper so the same phone
 * finds the same user row.
 */
export function normalizePhone(input: string): string {
  const digits = input.replace(/[^\d+]/g, "");
  const bare = digits.replace(/^\+/, "");

  if (/^01[3-9]\d{8}$/.test(bare)) return `+88${bare}`;
  if (/^8801[3-9]\d{8}$/.test(bare)) return `+${bare}`;
  if (/^1[3-9]\d{8}$/.test(bare)) return `+880${bare}`;
  return `+${bare}`;
}
