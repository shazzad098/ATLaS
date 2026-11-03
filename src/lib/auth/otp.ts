import { createHmac, randomInt, timingSafeEqual } from "node:crypto";
import { prisma } from "@/lib/db";
import { env, sandboxMode } from "@/lib/env";
import { AppError } from "@/lib/errors";
import { isValidBdPhone, normalizeOtpCode, normalizePhone } from "@/lib/auth/phone";

export { isValidBdPhone, normalizeOtpCode, normalizePhone } from "@/lib/auth/phone";

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
/** One source may not fan out OTPs across many phone numbers (SMS bombing). */
const MAX_SENDS_PER_IP_PER_HOUR = 20;

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

/** Inbox rows carry their expiry so the page never reads the clock during render. */
export type SandboxSmsView = SandboxSms & { expired: boolean };

export function listSandboxSms(): SandboxSmsView[] {
  // A real provider means nothing is ever buffered, so the inbox stays empty.
  if (!sandboxMode.sms) return [];
  const now = Date.now();
  return sandboxMessages
    .slice(0, SANDBOX_LIMIT)
    .map((message) => ({ ...message, expired: message.expiresAt.getTime() < now }));
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
      "সঠিক বাংলাদেশি মোবাইল নম্বর দিন (যেমন 01712345678 বা ০১৭১২৩৪৫৬৭৮)।",
      422,
      { field: "phone" },
    );
  }

  const hourAgo = new Date(Date.now() - 60 * 60 * 1000);
  const [recent, recentFromIp] = await Promise.all([
    prisma.otpChallenge.count({
      where: { phone, createdAt: { gte: hourAgo } },
    }),
    options.ip
      ? prisma.otpChallenge.count({
          where: { ip: options.ip, createdAt: { gte: hourAgo } },
        })
      : Promise.resolve(0),
  ]);
  if (recent >= MAX_SENDS_PER_HOUR) {
    throw new AppError(
      "RATE_LIMITED",
      "এই নম্বরে অনেকবার OTP পাঠানো হয়েছে। এক ঘণ্টা পরে চেষ্টা করুন।",
      429,
      { retryAfterSeconds: 3600 },
    );
  }
  if (recentFromIp >= MAX_SENDS_PER_IP_PER_HOUR) {
    throw new AppError(
      "RATE_LIMITED",
      "এই নেটওয়ার্ক থেকে অনেকবার OTP চাওয়া হয়েছে। এক ঘণ্টা পরে চেষ্টা করুন।",
      429,
      { retryAfterSeconds: 3600, scope: "ip" },
    );
  }

  // Older codes stay usable until their own expiry: merchants regularly tap
  // "resend" and then type the code from the first SMS. `verifyOtp` accepts any
  // live challenge for this phone+purpose, so a resend must not invalidate the
  // code already in the user's hand.
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
    // Never fall back to logging a live OTP in production: that would let
    // anyone with log access take over any phone number. Fail closed instead.
    if (env.isProduction) {
      console.error("[otp] SMS provider is not configured; refusing to issue an OTP");
      throw new AppError(
        "INTERNAL",
        "SMS সেবা কনফিগার করা নেই। অনুগ্রহ করে support-এ যোগাযোগ করুন।",
        503,
      );
    }
    // Development only: log the code and mirror it into the demo inbox.
    console.info(`[otp] ${phone} -> ${code} (no SMS provider configured)`);
    recordSandboxSms({ phone, code, purpose, sentAt: new Date(), expiresAt });
    return { via: "log", devCode: code };
  }

  const message = `ATLaS verification code: ${code}. ৫ মিনিটের মধ্যে ব্যবহার করুন।`;
  const provider = env.sms.provider;

  // Twilio speaks form-encoded Basic auth; keep it separate so its credentials
  // are not sent to an unrelated gateway.
  if (provider === "twilio") {
    const sid = env.sms.accountSid;
    const token = env.sms.authToken;
    const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
      method: "POST",
      headers: {
        authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString("base64")}`,
        "content-type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({ To: phone, From: env.sms.senderId, Body: message }).toString(),
    }).catch(() => null);

    if (!response?.ok) {
      const detail = await response?.text().catch(() => "");
      console.error("[otp] Twilio rejected the request", response?.status, detail?.slice(0, 200));
      throw new AppError("INTERNAL", "SMS পাঠানো যায়নি। একটু পরে আবার চেষ্টা করুন।", 502);
    }
    if (env.isDev) console.info(`[otp] ${phone} -> ${code} (${purpose}) sent via twilio`);
    return { via: "sms" };
  }

  // sms.net.bd compatible gateways expect form fields (not JSON), and they
  // answer HTTP 200 for application errors, so the body must be inspected.
  const endpoint = env.sms.baseUrl || "https://api.sms.net.bd/sendsms";
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      api_key: env.sms.apiKey,
      sender_id: env.sms.senderId,
      msg: message,
      to: phone,
    }).toString(),
  }).catch(() => null);

  if (!response?.ok) {
    console.error("[otp] SMS provider unreachable", response?.status);
    throw new AppError("INTERNAL", "SMS পাঠানো যায়নি। একটু পরে আবার চেষ্টা করুন।", 502);
  }

  const payload = (await response.json().catch(() => null)) as { error?: unknown; msg?: unknown } | null;
  if (payload?.error !== undefined && payload.error !== null && Number(payload.error) !== 0) {
    console.error("[otp] SMS provider rejected the request", payload);
    throw new AppError("INTERNAL", "SMS পাঠানো যায়নি — SMS গেটওয়ে কনফিগারেশন দেখুন।", 502);
  }

  if (env.isDev) {
    console.info(`[otp] ${phone} -> ${code} (${purpose}) sent via ${provider || "sms.net.bd"}`);
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
  const normalized = normalizeOtpCode(code);

  // Any live code for this phone+purpose can be redeemed. Resending an OTP
  // keeps the previous one valid for its TTL, so a merchant who types the code
  // from the first SMS is not told the code is wrong.
  const challenges = await prisma.otpChallenge.findMany({
    where: { phone, purpose, consumedAt: null },
    orderBy: { createdAt: "desc" },
    take: 5,
  });

  if (challenges.length === 0) return { ok: false, reason: "EXPIRED" };

  const now = Date.now();
  const live = challenges.filter((item) => {
    const expiresAt = new Date(item.expiresAt).getTime();
    return Number.isFinite(expiresAt) && expiresAt >= now;
  });

  if (live.length === 0) {
    await prisma.otpChallenge.updateMany({
      where: { id: { in: challenges.map((item) => item.id) } },
      data: { consumedAt: new Date() },
    });
    return { ok: false, reason: "EXPIRED" };
  }

  const newest = live[0];
  if (newest.attempts >= MAX_ATTEMPTS) {
    return { ok: false, reason: "LOCKED" };
  }

  const actual = hashCode(phone, normalized, purpose);
  const matched = live.find((item) => safeEqualHex(item.codeHash, actual));

  if (!matched) {
    const updated = await prisma.otpChallenge.update({
      where: { id: newest.id },
      data: { attempts: { increment: 1 } },
    });
    return { ok: false, reason: updated.attempts >= MAX_ATTEMPTS ? "LOCKED" : "MISMATCH" };
  }

  // A successful code spends every other live code for the same purpose: the
  // account is verified, so earlier SMS codes must not be reusable.
  await prisma.otpChallenge.updateMany({
    where: { phone, purpose, consumedAt: null, id: { not: matched.id } },
    data: { consumedAt: new Date() },
  });
  await prisma.otpChallenge.update({
    where: { id: matched.id },
    data: { consumedAt: new Date() },
  });
  return { ok: true };
}
