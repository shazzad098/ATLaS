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
const MAX_SENDS_PER_HOUR = 6;

/** Normalise `01712345678`, `+8801712345678`, `8801712345678` to `+8801712345678`. */
export function normalizePhone(input: string): string {
  const digits = input.replace(/[^\d+]/g, "");
  const bare = digits.replace(/^\+/, "");

  if (/^01[3-9]\d{8}$/.test(bare)) return `+88${bare}`;
  if (/^8801[3-9]\d{8}$/.test(bare)) return `+${bare}`;
  if (/^1[3-9]\d{8}$/.test(bare)) return `+880${bare}`;
  return `+${bare}`;
}

export function isValidBdPhone(input: string): boolean {
  const normalized = normalizePhone(input);
  return /^\+8801[3-9]\d{8}$/.test(normalized);
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
  // A real provider means nothing is ever buffered, so the inbox stays empty.
  if (!sandboxMode.sms) return [];
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
  if (sandboxMode.sms) {
    // No provider configured: the code is logged and mirrored into the demo inbox.
    console.info(`[otp] ${phone} -> ${code} (no SMS provider configured)`);
    recordSandboxSms({ phone, code, purpose, sentAt: new Date(), expiresAt });
    return { via: "log", devCode: code };
  }

  // Real providers plug in here (FR-09: SMS provider-ready interface).
  const response = await fetch("https://api.sms.net.bd/sendsms", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      api_key: env.sms.apiKey,
      sender_id: env.sms.senderId,
      msg: `ATLaS verification code: ${code}. ৫ মিনিটের মধ্যে ব্যবহার করুন।`,
      to: phone,
    }),
  }).catch(() => null);

  if (!response?.ok) {
    console.error("[otp] SMS provider rejected the request", response?.status);
    throw new AppError("INTERNAL", "SMS পাঠানো যায়নি। একটু পরে আবার চেষ্টা করুন।", 502);
  }
  return { via: "sms" };
}

export type VerifyOtpResult = { ok: true } | { ok: false; reason: "EXPIRED" | "MISMATCH" | "LOCKED" };

export async function verifyOtp(
  rawPhone: string,
  code: string,
  options: { purpose?: string } = {},
): Promise<VerifyOtpResult> {
  const phone = normalizePhone(rawPhone);
  const purpose = options.purpose ?? "LOGIN";

  const challenge = await prisma.otpChallenge.findFirst({
    where: { phone, purpose, consumedAt: null },
    orderBy: { createdAt: "desc" },
  });

  if (!challenge) return { ok: false, reason: "EXPIRED" };
  if (challenge.expiresAt.getTime() < Date.now()) {
    await prisma.otpChallenge.update({ where: { id: challenge.id }, data: { consumedAt: new Date() } });
    return { ok: false, reason: "EXPIRED" };
  }
  if (challenge.attempts >= MAX_ATTEMPTS) {
    return { ok: false, reason: "LOCKED" };
  }

  const expected = challenge.codeHash;
  const actual = hashCode(phone, code.trim(), purpose);

  if (!safeEqualHex(expected, actual)) {
    const updated = await prisma.otpChallenge.update({
      where: { id: challenge.id },
      data: { attempts: { increment: 1 } },
    });
    return { ok: false, reason: updated.attempts >= MAX_ATTEMPTS ? "LOCKED" : "MISMATCH" };
  }

  await prisma.otpChallenge.update({
    where: { id: challenge.id },
    data: { consumedAt: new Date() },
  });
  return { ok: true };
}
