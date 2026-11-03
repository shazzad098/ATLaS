import { createCipheriv, createDecipheriv, createHmac, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { env } from "@/lib/env";

/**
 * Application-level secret encryption (PRD §13).
 *
 * Gateway credentials and TOTP seeds must never sit in PostgreSQL as plaintext.
 * Values are sealed with AES-256-GCM under a key derived from `SECRETS_KEY`;
 * the key itself belongs in the deployment secret manager, never in the repo.
 *
 * Format: `v1:<iv base64>:<auth tag base64>:<ciphertext base64>`.
 * The version prefix leaves room for a future key rotation without guessing
 * which rows are old.
 */

const VERSION = "v1";
const KEY_SALT = "atlas-secrets-v1";

let cachedKey: Buffer | null = null;

function encryptionKey(): Buffer {
  if (cachedKey) return cachedKey;
  cachedKey = scryptSync(env.secretsKey, KEY_SALT, 32);
  return cachedKey;
}

export function isEncryptedSecret(value: string | null | undefined): boolean {
  return typeof value === "string" && value.startsWith(`${VERSION}:`) && value.split(":").length === 4;
}

export function encryptSecret(plaintext: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [VERSION, iv.toString("base64"), tag.toString("base64"), ciphertext.toString("base64")].join(":");
}

/** Throws when the value was sealed with a different key or was tampered with. */
export function decryptSecret(payload: string): string {
  if (!isEncryptedSecret(payload)) {
    throw new Error("Unsupported secret format. Re-enter the credential in Admin → পেমেন্ট.");
  }
  const [, ivPart, tagPart, dataPart] = payload.split(":");
  const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), Buffer.from(ivPart, "base64"));
  decipher.setAuthTag(Buffer.from(tagPart, "base64"));
  return Buffer.concat([decipher.update(Buffer.from(dataPart, "base64")), decipher.final()]).toString("utf8");
}

/** Constant-time comparison for hex/base64 secrets (webhook signatures). */
export function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length === 0 || left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

/** HMAC binding for one-time recovery codes, so a DB leak cannot redeem them. */
export function hashRecoveryCode(code: string): string {
  return createHmac("sha256", env.authSecret).update(`recovery:${normalizeRecoveryCode(code)}`).digest("hex");
}

export function normalizeRecoveryCode(code: string): string {
  return code.replace(/[^a-z0-9]/gi, "").toLowerCase();
}
