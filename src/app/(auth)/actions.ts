"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { AppError } from "@/lib/errors";
import { rateLimit } from "@/lib/api";
import { checkPasswordStrength, verifyPassword } from "@/lib/auth/password";
import { normalizePhone, requestOtp, verifyOtp } from "@/lib/auth/otp";
import { onboardingPath, resolveLandingPath } from "@/lib/auth/landing";
import {
  clearPendingSignup,
  readPendingSignup,
  savePendingSignup,
} from "@/lib/auth/pending-signup";
import { clearAuthCookies, establishSession, readSession, revokeSession, setAuthCookies } from "@/lib/auth/session";
import {
  findUserByIdentifier,
  provisionAccount,
  resetPassword,
} from "@/lib/services/account-service";
import { recordAudit } from "@/lib/audit";
import type { AuthState } from "@/app/(auth)/state";

/**
 * Authentication server actions (FR-01).
 *
 * Two front doors: phone + password, and phone + OTP (the Bangladesh-first
 * default). Both end in `establishSession`, which writes the auth cookies, so
 * the rest of the app only ever reads the session.
 */

function text(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

async function requestMeta() {
  const headerList = await headers();
  return {
    ip: headerList.get("x-forwarded-for")?.split(",")[0]?.trim() ?? undefined,
    userAgent: headerList.get("user-agent") ?? undefined,
  };
}

/**
 * Shared fixed-window limiter (PostgreSQL backed, so it works across instances).
 * Server actions bypass the `/api/v1` routes, so they must enforce their own
 * budget — otherwise the UI login is an unthrottled password oracle.
 */
async function enforceRateLimit(key: string, perMinute: number): Promise<AuthState | null> {
  try {
    await rateLimit(key, perMinute);
    return null;
  } catch (error) {
    return {
      ok: false,
      message:
        error instanceof AppError
          ? error.message
          : "অনেকবার চেষ্টা হয়েছে। এক মিনিট পর আবার চেষ্টা করুন।",
    };
  }
}

export async function loginAction(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const identifier = text(formData, "identifier").trim();
  const password = text(formData, "password");
  const wantsOtp = text(formData, "mode") === "otp";
  const next = text(formData, "next");

  if (!identifier) return { ok: false, message: "মোবাইল নম্বর বা ইমেইল দিন।" };

  const meta = await requestMeta();
  const ipLimited = await enforceRateLimit(`auth:login:ip:${meta.ip ?? "unknown"}`, 20);
  if (ipLimited) return ipLimited;

  const identifierLimited = await enforceRateLimit(
    `auth:login:id:${identifier.toLowerCase()}`,
    10,
  );
  if (identifierLimited) return identifierLimited;

  if (wantsOtp) {
    try {
      const result = await requestOtp(identifier, { purpose: "LOGIN", ip: meta.ip });
      return {
        ok: true,
        step: "otp",
        identifier: result.phone,
        message: result.devCode
          ? `ডেমো মোডে SMS নেই — আপনার কোড: ${result.devCode}`
          : "OTP পাঠানো হয়েছে।",
        devCode: result.devCode,
      };
    } catch (error) {
      return { ok: false, message: error instanceof AppError ? error.message : "OTP পাঠানো যায়নি।" };
    }
  }

  const user = await prisma.user.findFirst({
    where: {
      deletedAt: null,
      OR: [{ phone: normalizePhone(identifier) }, { email: identifier.toLowerCase() }],
    },
  });

  if (!user || !(await verifyPassword(password, user.passwordHash))) {
    return { ok: false, message: "নম্বর বা পাসওয়ার্ড মিলছে না।" };
  }
  if (user.status !== "ACTIVE") {
    return { ok: false, message: "এই অ্যাকাউন্টটি এখন সক্রিয় নয়। সহায়তা টিমের সাথে যোগাযোগ করুন।" };
  }

  const tokens = await establishSession(user.id, meta);
  await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
  await setAuthCookies(tokens);

  redirect(await resolveLandingPath(user.id, user.isSuperAdmin, next));
}

export async function verifyLoginOtpAction(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const phone = text(formData, "identifier").trim();
  const code = text(formData, "code").trim();
  const next = text(formData, "next");

  if (!code) return { ok: false, step: "otp", identifier: phone, message: "৬ ডিজিটের কোড দিন।" };

  const result = await verifyOtp(phone, code, { purpose: "LOGIN" });
  if (!result.ok) {
    const message =
      result.reason === "EXPIRED"
        ? "কোডটির মেয়াদ শেষ হয়েছে — আবার পাঠান।"
        : result.reason === "LOCKED"
          ? "অনেকবার ভুল হয়েছে। নতুন কোড চেয়ে নিন।"
          : "কোডটি মিলছে না।";
    return { ok: false, step: "otp", identifier: phone, message };
  }

  const user = await prisma.user.findFirst({ where: { phone: normalizePhone(phone), deletedAt: null } });
  if (!user || user.status !== "ACTIVE") {
    return { ok: false, message: "এই নম্বরে কোনো সক্রিয় অ্যাকাউন্ট নেই। আগে সাইনআপ করুন।" };
  }

  const tokens = await establishSession(user.id, await requestMeta());
  await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
  await setAuthCookies(tokens);

  redirect(await resolveLandingPath(user.id, user.isSuperAdmin, next));
}

export async function signupAction(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const intent = text(formData, "intent") || "request";
  const next = text(formData, "next");

  if (intent === "request") {
    const name = text(formData, "name").trim();
    const phone = text(formData, "phone").trim();
    const email = text(formData, "email").trim();
    const password = text(formData, "password");

    if (name.length < 2) return { ok: false, message: "আপনার নাম লিখুন।" };

    const strength = checkPasswordStrength(password);
    if (!strength.ok) return { ok: false, message: strength.problems.join(" ") };
    if (formData.get("acceptTerms") !== "on") {
      return { ok: false, message: "শর্তাবলীতে সম্মতি দিন।" };
    }

    const taken = await prisma.user.findFirst({
      where: { phone: normalizePhone(phone), deletedAt: null },
      select: { id: true },
    });
    if (taken) return { ok: false, message: "এই নম্বরে আগেই অ্যাকাউন্ট আছে — লগইন করুন।" };

    try {
      const result = await requestOtp(phone, { purpose: "SIGNUP", ip: (await requestMeta()).ip });
      // React resets the form after the action returns, so keep the details
      // (including the password) in an encrypted, httpOnly cookie until the
      // OTP has been verified.
      await savePendingSignup({
        name,
        phone: result.phone,
        email: email.toLowerCase(),
        password,
      });
      return {
        ok: true,
        step: "otp",
        phone: result.phone,
        message: result.devCode
          ? `ডেমো মোডে SMS নেই — আপনার কোড: ${result.devCode}`
          : `${result.phone} নম্বরে OTP পাঠানো হয়েছে।`,
        devCode: result.devCode,
      };
    } catch (error) {
      return { ok: false, message: error instanceof AppError ? error.message : "OTP পাঠানো যায়নি।" };
    }
  }

  const pending = await readPendingSignup();
  if (!pending) {
    return {
      ok: false,
      step: "credentials",
      message: "যাচাইয়ের সময় শেষ হয়েছে — ফর্মটি আবার পূরণ করুন।",
    };
  }

  const code = text(formData, "code").trim();
  if (!code) return { ok: false, step: "otp", phone: pending.phone, message: "OTP কোড দিন।" };

  const verified = await verifyOtp(pending.phone, code, { purpose: "SIGNUP" });
  if (!verified.ok) {
    return {
      ok: false,
      step: "otp",
      phone: pending.phone,
      message: "কোডটি মেলেনি বা মেয়াদ শেষ। আবার চেষ্টা করুন।",
    };
  }

  try {
    const account = await provisionAccount({
      phone: pending.phone,
      name: pending.name,
      email: pending.email || null,
      password: pending.password,
    });
    const tokens = await establishSession(account.userId, await requestMeta());
    await setAuthCookies(tokens);
  } catch (error) {
    if (error instanceof AppError) {
      return { ok: false, step: "otp", phone: pending.phone, message: error.message };
    }
    if ((error as { code?: string })?.code === "P2002") {
      return { ok: false, step: "otp", phone: pending.phone, message: "এই তথ্য দিয়ে আগেই অ্যাকাউন্ট আছে।" };
    }
    return { ok: false, step: "otp", phone: pending.phone, message: "অ্যাকাউন্ট তৈরি করা যায়নি। আবার চেষ্টা করুন।" };
  }

  await clearPendingSignup();
  redirect(onboardingPath(next));
}

/**
 * Forgotten password (FR-01, PRD §13).
 *
 * Step 1 sends an OTP to the phone on the account; step 2 consumes it and sets
 * the new password. The phone number is never taken from the second form — it is
 * re-resolved from the identifier the merchant originally typed, so a tampered
 * form cannot reset somebody else's password.
 */
export async function requestPasswordResetAction(
  _prev: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const identifier = text(formData, "identifier").trim();
  if (!identifier) return { ok: false, message: "মোবাইল নম্বর বা ইমেইল দিন।" };

  const user = await findUserByIdentifier(identifier);
  if (!user) {
    // Same wording either way: the form must not reveal which numbers exist.
    return {
      ok: true,
      step: "otp",
      message: "এই তথ্য দিয়ে অ্যাকাউন্ট থাকলে OTP পাঠানো হয়েছে।",
    };
  }

  try {
    const result = await requestOtp(user.phone, {
      purpose: "PASSWORD_RESET",
      ip: (await requestMeta()).ip,
    });
    return {
      ok: true,
      step: "otp",
      message: result.devCode
        ? `ডেমো মোডে SMS নেই — আপনার কোড: ${result.devCode}`
        : `${result.phone} নম্বরে রিসেট কোড পাঠানো হয়েছে।`,
      devCode: result.devCode,
    };
  } catch (error) {
    return { ok: false, step: "otp", message: error instanceof AppError ? error.message : "OTP পাঠানো যায়নি।" };
  }
}

export async function resetPasswordAction(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const identifier = text(formData, "identifier").trim();
  const code = text(formData, "code").trim();
  const password = text(formData, "password");

  const user = await findUserByIdentifier(identifier);
  if (!user) return { ok: false, message: "অনুরোধটি আর বৈধ নয় — আবার শুরু করুন।" };

  const verified = await verifyOtp(user.phone, code, { purpose: "PASSWORD_RESET" });
  if (!verified.ok) {
    return {
      ok: false,
      step: "otp",
      message: verified.reason === "LOCKED" ? "অনেকবার ভুল হয়েছে — নতুন কোড নিন।" : "কোডটি মেলেনি।",
    };
  }

  try {
    await resetPassword(user.id, password);
    await recordAudit({
      action: "auth.password_reset_completed",
      actorId: user.id,
      resourceType: "User",
      resourceId: user.id,
    });
  } catch (error) {
    if (error instanceof AppError) return { ok: false, step: "otp", message: error.message };
    return { ok: false, step: "otp", message: "পাসওয়ার্ড রিসেট করা যায়নি।" };
  }

  redirect("/login?reset=1");
}

export async function logoutAction(): Promise<void> {
  const session = await readSession();
  if (session?.sessionId) await revokeSession(session.sessionId);
  await clearAuthCookies();
  redirect("/login");
}
