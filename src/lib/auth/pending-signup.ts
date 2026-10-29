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
const TTL_SECONDS = 15 * 60;

export type PendingSignup = {
  name: string;
  phone: string;
  email: string;
  password: string;
};

// Memory store fallback for iframe environments where third-party cookies are blocked
type PendingEntry = {
  data: PendingSignup;
  expiresAt: number;
};
const globalStore = globalThis as unknown as { atlasPendingSignups?: Map<string, PendingEntry> };
const memoryStore = (globalStore.atlasPendingSignups ??= new Map<string, PendingEntry>());

function cleanExpiredEntries(): void {
  const now = Date.now();
  for (const [key, entry] of memoryStore.entries()) {
    if (entry.expiresAt < now) {
      memoryStore.delete(key);
    }
  }
}

function encryptionKey(): Buffer {
  const secret = process.env.AUTH_SECRET || "atlas-super-secret-auth-key-32-chars-long!!";
  return createHash("sha256").update(`signup:${secret}`).digest();
}

export function encryptPendingSignup(input: PendingSignup): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const payload = Buffer.concat([cipher.update(JSON.stringify(input), "utf8"), cipher.final()]);

  return [iv, cipher.getAuthTag(), payload]
    .map((part) => part.toString("base64url"))
    .join(".");
}

export function decryptPendingSignup(token: string): PendingSignup | null {
  if (!token || typeof token !== "string") return null;
  const [ivPart, tagPart, payloadPart] = token.split(".");
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

export async function savePendingSignup(input: PendingSignup): Promise<string> {
  const token = encryptPendingSignup(input);

  // Store in memory cache by normalized phone
  cleanExpiredEntries();
  const cleanPhone = input.phone.replace(/[^\d+]/g, "");
  memoryStore.set(cleanPhone, {
    data: input,
    expiresAt: Date.now() + TTL_SECONDS * 1000,
  });

  // Also try to set cookie (with SameSite=None and Secure=true for iframes)
  try {
    const jar = await cookies();
    jar.set(COOKIE, token, {
      httpOnly: true,
      sameSite: "none",
      secure: true,
      path: "/",
      maxAge: TTL_SECONDS,
    });
  } catch {
    // Cookie failure in non-standard context is non-fatal since token/memory exists
  }

  return token;
}

export async function readPendingSignup(
  tokenOrSource?: string | FormData | null,
  phoneHint?: string,
): Promise<PendingSignup | null> {
  cleanExpiredEntries();

  // 1. Check direct encrypted token
  if (typeof tokenOrSource === "string" && tokenOrSource.trim().length > 0) {
    const decrypted = decryptPendingSignup(tokenOrSource.trim());
    if (decrypted) return decrypted;
  }

  // 2. Check FormData
  if (tokenOrSource && typeof tokenOrSource === "object" && "get" in tokenOrSource) {
    const fromForm = tokenOrSource.get("signupToken");
    if (typeof fromForm === "string" && fromForm.trim().length > 0) {
      const decrypted = decryptPendingSignup(fromForm.trim());
      if (decrypted) return decrypted;
    }
    const phoneFromForm = tokenOrSource.get("phone");
    if (typeof phoneFromForm === "string" && phoneFromForm.trim().length > 0) {
      phoneHint = phoneHint || phoneFromForm.trim();
    }
  }

  // 3. Check memory store by phone hint
  if (phoneHint) {
    const cleanPhone = phoneHint.replace(/[^\d+]/g, "");
    const cached = memoryStore.get(cleanPhone);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.data;
    }
  }

  // 4. Check cookie
  try {
    const jar = await cookies();
    const raw = jar.get(COOKIE)?.value;
    if (raw) {
      const decrypted = decryptPendingSignup(raw);
      if (decrypted) return decrypted;
    }
  } catch {
    // ignore cookie read error
  }

  // 5. If only one recent entry in memory store, return it
  if (memoryStore.size === 1) {
    const entry = memoryStore.values().next().value;
    if (entry && entry.expiresAt > Date.now()) {
      return entry.data;
    }
  }

  return null;
}

export async function clearPendingSignup(phoneHint?: string): Promise<void> {
  if (phoneHint) {
    const cleanPhone = phoneHint.replace(/[^\d+]/g, "");
    memoryStore.delete(cleanPhone);
  }
  try {
    const jar = await cookies();
    jar.delete(COOKIE);
  } catch {}
}
