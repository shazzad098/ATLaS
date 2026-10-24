import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { env } from "@/lib/env";

const VERSION = "v1";
const ALGORITHM = "aes-256-gcm";

function key(): Buffer {
  return createHash("sha256").update(env.secretsKey).digest();
}

export function encryptSecretJson(value: Record<string, string>): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGORITHM, key(), iv);
  const ciphertext = Buffer.concat([cipher.update(JSON.stringify(value), "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [VERSION, iv.toString("base64url"), tag.toString("base64url"), ciphertext.toString("base64url")].join(".");
}

export function decryptSecretJson(value: string | null | undefined): Record<string, string> {
  if (!value) return {};
  const [version, ivEncoded, tagEncoded, ciphertextEncoded] = value.split(".");
  if (version !== VERSION || !ivEncoded || !tagEncoded || !ciphertextEncoded) return {};
  try {
    const decipher = createDecipheriv(ALGORITHM, key(), Buffer.from(ivEncoded, "base64url"));
    decipher.setAuthTag(Buffer.from(tagEncoded, "base64url"));
    const plaintext = Buffer.concat([decipher.update(Buffer.from(ciphertextEncoded, "base64url")), decipher.final()]).toString("utf8");
    const parsed = JSON.parse(plaintext);
    return parsed && typeof parsed === "object" ? (parsed as Record<string, string>) : {};
  } catch {
    return {};
  }
}
