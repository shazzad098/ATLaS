import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";

/**
 * Pending merchant signup.
 *
 * The signup form is two steps (details → OTP), and React 19 resets uncontrolled
 * fields after a Server Action returns. The details therefore cannot live in the
 * form between steps, and the password must never be echoed back in the page
 * payload. This module keeps them in a short-lived, encrypted, httpOnly cookie
 * that only the server can read.
 */

const COOKIE = "atlas_signup_pending";
const TTL_SECONDS = 10 * 60;

export type PendingSignup = {
  name: string;
  phone: string;
  email: string;
  password: string;
};

function encryptionKey(): Buffer {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error("AUTH_SECRET is required for signup verification");
  return createHash("sha256").update(`signup:${secret}`).digest();
}

export async function savePendingSignup(input: PendingSignup): Promise<void> {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const payload = Buffer.concat([cipher.update(JSON.stringify(input), "utf8"), cipher.final()]);

  const value = [iv, cipher.getAuthTag(), payload]
    .map((part) => part.toString("base64url"))
    .join(".");

  const jar = await cookies();
  jar.set(COOKIE, value, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: TTL_SECONDS,
  });
}

export async function readPendingSignup(): Promise<PendingSignup | null> {
  const jar = await cookies();
  const raw = jar.get(COOKIE)?.value;
  if (!raw) return null;

  const [ivPart, tagPart, payloadPart] = raw.split(".");
  if (!ivPart || !tagPart || !payloadPart) return null;

  try {
    const decipher = createDecipheriv(
      "aes-256-gcm",
      encryptionKey(),
      Buffer.from(ivPart, "base64url"),
    );
    decipher.setAuthTag(Buffer.from(tagPart, "base64url"));
    const json = Buffer.concat([
      decipher.update(Buffer.from(payloadPart, "base64url")),
      decipher.final(),
    ]).toString("utf8");

    const parsed = JSON.parse(json) as Partial<PendingSignup>;
    if (!parsed.name || !parsed.phone || !parsed.password) return null;
    return {
      name: parsed.name,
      phone: parsed.phone,
      email: parsed.email ?? "",
      password: parsed.password,
    };
  } catch {
    return null;
  }
}

export async function clearPendingSignup(): Promise<void> {
  const jar = await cookies();
  jar.delete(COOKIE);
}
