import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { env } from "@/lib/env";

/**
 * Pending merchant signup data is kept in an authenticated, encrypted token.
 * The token is passed in a hidden form field, so signup does not depend on
 * process-local memory or third-party cookies in serverless deployments.
 */
const COOKIE = "atlas_signup_pending";
const TTL_SECONDS = 15 * 60;

type PendingSignup = {
  name: string;
  phone: string;
  email: string;
  password: string;
};

type PendingSignupPayload = PendingSignup & { expiresAt: number };

function encryptionKey(): Buffer {
  return createHash("sha256").update(`signup:${env.authSecret}`).digest();
}

function cleanPhone(value: string): string {
  return value.replace(/[^\d+]/g, "");
}

export function encryptPendingSignup(input: PendingSignup): string {
  const payload: PendingSignupPayload = {
    ...input,
    expiresAt: Date.now() + TTL_SECONDS * 1000,
  };
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const encrypted = Buffer.concat([
    cipher.update(JSON.stringify(payload), "utf8"),
    cipher.final(),
  ]);

  return [iv, cipher.getAuthTag(), encrypted]
    .map((part) => part.toString("base64url"))
    .join(".");
}

export function decryptPendingSignup(token: string): PendingSignup | null {
  if (!token || typeof token !== "string") return null;
  const parts = token.split(".");
  if (parts.length !== 3 || parts.some((part) => !part)) return null;

  try {
    const [ivPart, tagPart, encryptedPart] = parts;
    const iv = Buffer.from(ivPart, "base64url");
    const tag = Buffer.from(tagPart, "base64url");
    const encrypted = Buffer.from(encryptedPart, "base64url");

    if (iv.length !== 12 || tag.length !== 16 || encrypted.length === 0) return null;

    const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), iv);
    decipher.setAuthTag(tag);
    const plaintext = Buffer.concat([
      decipher.update(encrypted),
      decipher.final(),
    ]).toString("utf8");

    const parsed = JSON.parse(plaintext) as Partial<PendingSignupPayload>;
    if (
      typeof parsed.name !== "string" || parsed.name.length < 2 ||
      typeof parsed.phone !== "string" || !parsed.phone ||
      typeof parsed.password !== "string" || !parsed.password ||
      typeof parsed.email !== "string" ||
      typeof parsed.expiresAt !== "number" || parsed.expiresAt <= Date.now()
    ) {
      return null;
    }

    return {
      name: parsed.name,
      phone: parsed.phone,
      email: parsed.email,
      password: parsed.password,
    };
  } catch {
    return null;
  }
}

export async function savePendingSignup(input: PendingSignup): Promise<string> {
  const token = encryptPendingSignup(input);

  // The hidden signupToken is the primary transport. The cookie is only a
  // fallback for browser flows where a form field is unavailable.
  try {
    const jar = await cookies();
    jar.set(COOKIE, token, {
      httpOnly: true,
      sameSite: "lax",
      secure: env.isProduction,
      path: "/",
      maxAge: TTL_SECONDS,
    });
  } catch {
    // The encrypted hidden form token remains sufficient.
  }

  return token;
}

export async function readPendingSignup(
  tokenOrSource?: string | FormData | null,
  phoneHint?: string,
): Promise<PendingSignup | null> {
  let submittedToken: string | null = null;
  let submittedPhone = phoneHint ?? "";

  if (typeof tokenOrSource === "string" && tokenOrSource.trim()) {
    submittedToken = tokenOrSource.trim();
  } else if (tokenOrSource && typeof tokenOrSource === "object" && "get" in tokenOrSource) {
    const token = tokenOrSource.get("signupToken");
    const phone = tokenOrSource.get("phone");
    if (typeof token === "string" && token.trim()) submittedToken = token.trim();
    if (typeof phone === "string" && phone.trim()) submittedPhone = phone.trim();
  }

  if (submittedToken) {
    const pending = decryptPendingSignup(submittedToken);
    if (pending && (!submittedPhone || cleanPhone(pending.phone) === cleanPhone(submittedPhone))) {
      return pending;
    }
  }

  try {
    const jar = await cookies();
    const cookieToken = jar.get(COOKIE)?.value;
    if (cookieToken) {
      const pending = decryptPendingSignup(cookieToken);
      if (pending && (!submittedPhone || cleanPhone(pending.phone) === cleanPhone(submittedPhone))) {
        return pending;
      }
    }
  } catch {
    // No cookie access: the hidden form token is the intended primary path.
  }

  return null;
}

export async function clearPendingSignup(_phoneHint?: string): Promise<void> {
  try {
    const jar = await cookies();
    jar.delete(COOKIE);
  } catch {
    // Nothing else needs clearing; no process-local signup cache is used.
  }
}
