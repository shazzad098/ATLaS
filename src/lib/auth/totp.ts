import { createHmac, randomBytes, randomInt, timingSafeEqual } from "node:crypto";

/**
 * RFC 6238 TOTP (FR-01 "Optional 2FA for Super Admin এবং Pro merchant").
 *
 * Implemented in-house with node:crypto: SHA-1, 30-second period, 6 digits —
 * the defaults every authenticator app supports. Secrets are base32 (RFC 4648,
 * no padding) because that is what `otpauth://` URIs carry.
 *
 * The verifier accepts one step of clock drift either side, compares in constant
 * time, and never logs the secret or the submitted code.
 */

export const TOTP_PERIOD_SECONDS = 30;
export const TOTP_DIGITS = 6;
const SECRET_BYTES = 20;
const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

export function base32Encode(buffer: Buffer): string {
  let bits = 0;
  let value = 0;
  let output = "";
  for (const byte of buffer) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      output += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) output += BASE32_ALPHABET[(value << (5 - bits)) & 31];
  return output;
}

export function base32Decode(input: string): Buffer {
  const clean = input.toUpperCase().replace(/[^A-Z2-7]/g, "");
  if (!clean) throw new Error("TOTP secret is empty.");
  let bits = 0;
  let value = 0;
  const bytes: number[] = [];
  for (const char of clean) {
    const index = BASE32_ALPHABET.indexOf(char);
    if (index < 0) continue;
    value = (value << 5) | index;
    bits += 5;
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return Buffer.from(bytes);
}

export function generateTotpSecret(): string {
  return base32Encode(randomBytes(SECRET_BYTES));
}

function counterBuffer(counter: number): Buffer {
  const buffer = Buffer.alloc(8);
  buffer.writeBigUInt64BE(BigInt(counter));
  return buffer;
}

/** RFC 4226 HOTP, the building block for TOTP. */
export function hotp(secret: string, counter: number, digits = TOTP_DIGITS): string {
  const digest = createHmac("sha1", base32Decode(secret)).update(counterBuffer(counter)).digest();
  const offset = digest[digest.length - 1] & 0x0f;
  const binary =
    ((digest[offset] & 0x7f) << 24) |
    ((digest[offset + 1] & 0xff) << 16) |
    ((digest[offset + 2] & 0xff) << 8) |
    (digest[offset + 3] & 0xff);
  return String(binary % 10 ** digits).padStart(digits, "0");
}

export function totp(secret: string, at: Date = new Date(), period = TOTP_PERIOD_SECONDS): string {
  return hotp(secret, Math.floor(at.getTime() / 1000 / period));
}

/**
 * Verify a submitted code with a ±1 step window. Returns the matched counter so
 * callers could persist a replay guard; ATLaS verifies at the session boundary,
 * where a one-time challenge already prevents code reuse within a login.
 */
export function verifyTotp(
  secret: string,
  token: string,
  options: { at?: Date; window?: number } = {},
): boolean {
  const normalized = token.replace(/\s+/g, "");
  if (!/^\d{6}$/.test(normalized)) return false;
  const at = options.at ?? new Date();
  const window = options.window ?? 1;
  const counter = Math.floor(at.getTime() / 1000 / TOTP_PERIOD_SECONDS);
  let matched = false;
  for (let offset = -window; offset <= window; offset += 1) {
    const expected = hotp(secret, counter + offset);
    if (expected.length === normalized.length && timingSafeEqual(Buffer.from(expected), Buffer.from(normalized))) {
      matched = true;
    }
  }
  return matched;
}

/** `otpauth://` URI for authenticator apps (manual entry or QR rendering). */
export function otpauthUri(input: { secret: string; account: string; issuer?: string }): string {
  const issuer = input.issuer ?? "ATLaS";
  const label = `${issuer}:${input.account}`;
  const params = new URLSearchParams({
    secret: input.secret,
    issuer,
    algorithm: "SHA1",
    digits: String(TOTP_DIGITS),
    period: String(TOTP_PERIOD_SECONDS),
  });
  return `otpauth://totp/${encodeURIComponent(label)}?${params.toString()}`;
}

/**
 * Ten human-copyable codes (xxxx-xxxx). The caller hashes them for storage; a
 * plaintext code is only ever returned to the user once.
 */
export function generateRecoveryCodes(count = 10): string[] {
  const alphabet = "abcdefghjkmnpqrstuvwxyz23456789";
  return Array.from({ length: count }, () => {
    const value = Array.from({ length: 8 }, () => alphabet[randomInt(0, alphabet.length)]).join("");
    return `${value.slice(0, 4)}-${value.slice(4)}`;
  });
}

export function normalizeRecoveryCode(code: string): string {
  return code.replace(/[^a-z0-9]/gi, "").toLowerCase();
}
