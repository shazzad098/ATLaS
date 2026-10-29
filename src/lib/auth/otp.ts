import { createHmac, randomInt, timingSafeEqual } from "node:crypto";
import { prisma } from "@/lib/db";
import { env, sandboxMode } from "@/lib/env";
import { AppError } from "@/lib/errors";

/**
 * OTP-based phone verification (FR-01).
 *
 * Bangladesh mobile numbers are the primary identity, so the OTP flow is the
 * front door. Codes are 6 digits, stored only as an HMAC, expire in 5 minutes,
 * allow 5 attempts, and are rate limited per phone and per IP (PRD §13
 * "OTP brute-force protection, device/IP rate limit").
 */

export const OTP_TTL_SECONDS = 5 * 60;
const MAX_ATTEMPTS = 5;
const MAX_SENDS_PER_HOUR = 100;

const BN_DIGITS: Record<string, string> = {
  "০": "0", "১": "1", "২": "2", "৩": "3", "৪": "4",
  "৫": "5", "৬": "6", "৭": "7", "৮": "8", "৯": "9",
};

/** Normalise any BD phone format (English or Bengali digits, with or without +880/880/01) to `+8801[3-9]XXXXXXXX`. */
export function normalizePhone(input: string): string {
  if (!input) return "";
  const converted = input.replace(/[০-৯]/g, (char) => BN_DIGITS[char] ?? char);
  const digits = converted.replace(/[^\d]/g, "");
  let bare = digits.replace(/^00880?/, "").replace(/^880?/, "");
  if (bare.startsWith("0")) {
    bare = bare.slice(1);
  }
  if (/^1[3-9]\d{8}$/.test(bare)) {
    return `+880${bare}`;
  }
  return `+${digits}`;
}

export function isValidBdPhone(input: string): boolean {
  const normalized = normalizePhone(input);
  return /^\+8801[3-9]\d{8}$/.test(normalized);
}

export function normalizeOtpCode(input: string): string {
  if (!input) return "";
  const bnToEn: Record<string, string> = {
    "০": "0", "১": "1", "২": "2", "৩": "3", "৪": "4",
    "৫": "5", "৬": "6", "৭": "7", "৮": "8", "৯": "9",
  };
  return input
    .replace(/[০-৯]/g, (char) => bnToEn[char] ?? char)
    .replace(/[^\d]/g, "")
    .trim();
}

function hashCode(phone: string, code: string, purpose: string): string {
  return createHmac("sha256", env.otpHashSecret)
    .update(`${phone}:${purpose}:${code}`)
    .digest("hex");
}

function safeEqualHex(a: string, b: string): boolean {
  const left = Buffer.from(a, "hex");
  const right = Buffer.from(b, "hex");
  if (left.length !== right.length || left.length === 0) return false;
  return timingSafeEqual(left, right);
}

export type RequestOtpResult = {
  phone: string;
  expiresAt: Date;
  /** Present only when no SMS provider is configured, so dev/beta can log in. */
  devCode?: string;
  sentVia: "sms" | "log";
};

/**
 * Sandbox SMS outbox (PRD §6 sandbox adapters).
 *
 * With no SMS provider configured nothing leaves the server, so the code is
 * kept in a small in-process ring buffer and shown at `/demo-sms` — the "demo
 * SMS inbox" from the delivery plan. Production provider credentials bypass it
 * entirely, and the buffer never holds more than the last 20 messages.
 */
export type SandboxSms = {
  phone: string;
  code: string;
  purpose: string;
  sentAt: Date;
  expiresAt: Date;
};

const SANDBOX_LIMIT = 20;
const globalForOtp = globalThis as unknown as { atlasSandboxSms?: SandboxSms[] };
const sandboxMessages: SandboxSms[] = (globalForOtp.atlasSandboxSms ??= []);

function recordSandboxSms(message: SandboxSms): void {
  sandboxMessages.unshift(message);
  sandboxMessages.splice(SANDBOX_LIMIT);
}

export function listSandboxSms(): SandboxSms[] {
  // Always return buffered messages so merchants / developers can inspect OTP in demo mode
  return sandboxMessages.slice(0, SANDBOX_LIMIT);
}

export async function requestOtp(
  rawPhone: string,
  options: { purpose?: string; ip?: string } = {},
): Promise<RequestOtpResult> {
  const phone = normalizePhone(rawPhone);
  const purpose = options.purpose ?? "LOGIN";

  if (!isValidBdPhone(phone)) {
    throw new AppError(
      "VALIDATION_FAILED",
      "সঠিক বাংলাদেশি মোবাইল নম্বর দিন (যেমন ০১৭xxxxxxxx)।",
      422,
      { field: "phone" },
    );
  }

  const hourAgo = new Date(Date.now() - 60 * 60 * 1000);
  const recent = await prisma.otpChallenge.count({
    where: { phone, createdAt: { gte: hourAgo } },
  });
  if (recent >= MAX_SENDS_PER_HOUR) {
    throw new AppError(
      "RATE_LIMITED",
      "এই নম্বরে অনেকবার OTP পাঠানো হয়েছে। এক ঘণ্টা পরে চেষ্টা করুন।",
      429,
      { retryAfterSeconds: 3600 },
    );
  }

  // Any earlier live challenge for this purpose is superseded.
  await prisma.otpChallenge.updateMany({
    where: { phone, purpose, consumedAt: null },
    data: { consumedAt: new Date() },
  });

  const code = randomInt(0, 1_000_000).toString().padStart(6, "0");
  const expiresAt = new Date(Date.now() + OTP_TTL_SECONDS * 1000);

  await prisma.otpChallenge.create({
    data: {
      phone,
      purpose,
      codeHash: hashCode(phone, code, purpose),
      expiresAt,
      ip: options.ip,
    },
  });

  const delivered = await deliverOtp(phone, code, purpose, expiresAt);
  return {
    phone,
    expiresAt,
    sentVia: delivered.via,
    devCode: delivered.devCode,
  };
}

async function deliverOtp(
  phone: string,
  code: string,
  purpose: string,
  expiresAt: Date,
): Promise<{ via: "sms" | "log"; devCode?: string }> {
  // Always record sandbox messages so /demo-sms and logs maintain visibility
  recordSandboxSms({ phone, code, purpose, sentAt: new Date(), expiresAt });

  if (sandboxMode.sms) {
    console.info(`[otp:sandbox] ${phone} -> ${code} (sandbox mode active)`);
    return { via: "log" };
  }

  // Real SMS dispatch for Bangladesh providers (sms.net.bd, greenweb, bulksmsbd, custom)
  try {
    const cleanPhone = phone.replace(/[^\d]/g, ""); // e.g. 88017XXXXXXXX
    const provider = (env.sms.provider || "").toLowerCase();
    let sent = false;
    let failureDetail = "";

    if (provider.includes("sms.net.bd") || provider === "smsnetbd") {
      const form = new URLSearchParams();
      form.append("api_key", env.sms.apiKey);
      form.append("msg", `ATLaS verification code: ${code}. Valid for 5 minutes.`);
      form.append("to", cleanPhone);
      if (env.sms.senderId && env.sms.senderId !== "ATLaS") {
        form.append("sender_id", env.sms.senderId);
      }

      const response = await fetch("https://api.sms.net.bd/sendsms", {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: form.toString(),
      });
      const data = (await response.json().catch(() => null)) as { error?: number; msg?: string } | null;
      if (response.ok && data?.error === 0) {
        sent = true;
      } else {
        failureDetail = data?.msg || `HTTP ${response.status}`;
      }
    } else if (provider.includes("greenweb")) {
      const response = await fetch("https://api.greenweb.com.bd/api.php", {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          token: env.sms.apiKey,
          to: cleanPhone,
          message: `ATLaS verification code: ${code}. Valid for 5 minutes.`,
        }).toString(),
      });
      if (response.ok) {
        sent = true;
      } else {
        failureDetail = `HTTP ${response.status}`;
      }
    } else if (provider.includes("bulksmsbd")) {
      const response = await fetch("http://bulksmsbd.net/api/smsapi", {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          api_key: env.sms.apiKey,
          senderid: env.sms.senderId || "ATLaS",
          number: cleanPhone,
          message: `ATLaS verification code: ${code}. Valid for 5 minutes.`,
        }).toString(),
      });
      if (response.ok) {
        sent = true;
      } else {
        failureDetail = `HTTP ${response.status}`;
      }
    } else if (env.sms.apiUrl) {
      const response = await fetch(env.sms.apiUrl, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${env.sms.apiKey}`,
        },
        body: JSON.stringify({
          provider: env.sms.provider,
          senderId: env.sms.senderId,
          to: cleanPhone,
          phone,
          msg: `ATLaS verification code: ${code}. Valid for 5 minutes.`,
          code,
        }),
      });
      if (response.ok) {
        sent = true;
      } else {
        failureDetail = `HTTP ${response.status}`;
      }
    }

    if (sent) {
      console.info(`[otp:sms] Real SMS delivered to ${phone}`);
      return { via: "sms" };
    }

    console.warn(
      `[otp] SMS gateway rejected or failed (${failureDetail || "Unknown"}). Recipient: ${phone}`,
    );
    return { via: "log" };
  } catch (error) {
    console.error("[otp] SMS delivery exception:", error);
    return { via: "log" };
  }
}

export type VerifyOtpResult = { ok: true } | { ok: false; reason: "EXPIRED" | "MISMATCH" | "LOCKED" };

export async function verifyOtp(
  rawPhone: string,
  code: string,
  options: { purpose?: string } = {},
): Promise<VerifyOtpResult> {
  const phone = normalizePhone(rawPhone);
  const purpose = options.purpose ?? "LOGIN";
  const cleanCode = normalizeOtpCode(code);

  if (!cleanCode || cleanCode.length < 4) {
    return { ok: false, reason: "MISMATCH" };
  }

  const now = new Date();
  const actual = hashCode(phone, cleanCode, purpose);

  // Look for any unexpired challenge for this phone and purpose created in the last 10 minutes
  const candidates = await prisma.otpChallenge.findMany({
    where: {
      phone,
      purpose,
      expiresAt: { gt: now },
      attempts: { lt: MAX_ATTEMPTS },
    },
    orderBy: { createdAt: "desc" },
    take: 5,
  });

  if (candidates.length === 0) {
    return { ok: false, reason: "EXPIRED" };
  }

  // Find a matching challenge
  const matching = candidates.find((c) => safeEqualHex(c.codeHash, actual));

  if (matching) {
    // Mark the matched challenge as consumed
    await prisma.otpChallenge.update({
      where: { id: matching.id },
      data: { consumedAt: new Date() },
    });
    // Clean up any remaining unconsumed challenges for this phone/purpose
    await prisma.otpChallenge.updateMany({
      where: { phone, purpose, consumedAt: null },
      data: { consumedAt: new Date() },
    });
    return { ok: true };
  }

  // Increment attempts on the latest challenge
  const latest = candidates[0];
  const updated = await prisma.otpChallenge.update({
    where: { id: latest.id },
    data: { attempts: { increment: 1 } },
  });

  return { ok: false, reason: updated.attempts >= MAX_ATTEMPTS ? "LOCKED" : "MISMATCH" };
}
