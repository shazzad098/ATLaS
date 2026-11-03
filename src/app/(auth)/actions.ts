"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { AppError } from "@/lib/errors";
import { checkPasswordStrength, verifyPassword } from "@/lib/auth/password";
import { normalizePhone, requestOtp, verifyOtp } from "@/lib/auth/otp";
import { clearAuthCookies, establishSession, readSession, revokeSession, setAuthCookies } from "@/lib/auth/session";
import {
  beginTwoFactorChallenge,
  clearTwoFactorChallenge,
  completeTwoFactorChallenge,
  readChallengeToken,
} from "@/lib/auth/two-factor";
import { rateLimit } from "@/lib/api";
import { endImpersonation } from "@/lib/auth/impersonation";
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

export async function loginAction(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const identifier = text(formData, "identifier").trim();
  const password = text(formData, "password");
  const wantsOtp = text(formData, "mode") === "otp";

  if (!identifier) return { ok: false, message: "মোবাইল নম্বর বা ইমেইল দিন।" };

  // Throttle password guessing per IP and per identifier. The OTP flow has its
  // own per-phone limit inside `requestOtp`; this covers the credential path.
  const meta = await requestMeta();
  try {
    rateLimit(`login:ip:${meta.ip ?? "unknown"}`, 20);
    rateLimit(`login:id:${identifier.toLowerCase().slice(0, 80)}`, 10);
  } catch {
    return { ok: false, message: "খুব বেশি চেষ্টা হয়েছে। এক মিনিট পরে আবার চেষ্টা করুন।" };
  }

  if (wantsOtp) {
    try {
      const result = await requestOtp(identifier, { purpose: "LOGIN", ip: (await requestMeta()).ip });
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
    await recordAudit({ action: "auth.login_failed", metadata: { method: "password" }, ip: meta.ip });
    return { ok: false, message: "নম্বর বা পাসওয়ার্ড মিলছে না।" };
  }
  if (user.status !== "ACTIVE") {
    return { ok: false, message: "এই অ্যাকাউন্টটি এখন সক্রিয় নয়। সহায়তা টিমের সাথে যোগাযোগ করুন।" };
  }

  // Second factor: no session is issued until the TOTP/recovery code passes.
  if (user.twoFactorEnabled) {
    await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
    await beginTwoFactorChallenge(user.id, { ip: meta.ip });
    redirect("/login/2fa");
  }

  const tokens = await establishSession(user.id, meta);
  await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
  await setAuthCookies(tokens);
  await recordAudit({
    action: "auth.login_succeeded",
    actorId: user.id,
    resourceType: "User",
    resourceId: user.id,
    metadata: { method: "password", twoFactor: false },
    ip: meta.ip,
  });

  redirect(await landingPathFor(user.id, user.isSuperAdmin));
}

export async function verifyLoginOtpAction(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const phone = text(formData, "identifier").trim();
  const code = text(formData, "code").trim();

  if (!phone) {
    return { ok: false, step: "credentials", message: "মোবাইল নম্বর দিন — আবার OTP পাঠান।" };
  }
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
    return { ok: false, identifier: phone, message: "এই নম্বরে কোনো সক্রিয় অ্যাকাউন্ট নেই। আগে সাইনআপ করুন।" };
  }

  const meta = await requestMeta();
  if (user.twoFactorEnabled) {
    await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
    await beginTwoFactorChallenge(user.id, { ip: meta.ip });
    redirect("/login/2fa");
  }

  const tokens = await establishSession(user.id, meta);
  await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
  await setAuthCookies(tokens);
  await recordAudit({
    action: "auth.login_succeeded",
    actorId: user.id,
    resourceType: "User",
    resourceId: user.id,
    metadata: { method: "otp", twoFactor: false },
    ip: meta.ip,
  });

  redirect(await landingPathFor(user.id, user.isSuperAdmin));
}

/**
 * Second-factor step. The pending user id comes from the hashed challenge row,
 * never from the form, so this cannot be pointed at another account.
 */
export async function verifyTwoFactorLoginAction(
  _prev: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const code = text(formData, "code").trim();
  if (!code) return { ok: false, step: "credentials", message: "৬ ডিজিটের কোড বা recovery code দিন।" };

  let destination: string | null = null;
  try {
    const token = await readChallengeToken();
    const result = await completeTwoFactorChallenge(token, code);
    await clearTwoFactorChallenge();

    const user = await prisma.user.findUnique({
      where: { id: result.userId },
      select: { id: true, isSuperAdmin: true, status: true },
    });
    if (!user || user.status !== "ACTIVE") {
      return { ok: false, message: "এই অ্যাকাউন্টটি এখন সক্রিয় নয়।" };
    }

    const tokens = await establishSession(user.id, await requestMeta());
    await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
    await setAuthCookies(tokens);
    await recordAudit({
      action: "auth.login_succeeded",
      actorId: user.id,
      resourceType: "User",
      resourceId: user.id,
      metadata: { method: "2fa", via: result.via },
    });

    destination = await landingPathFor(user.id, user.isSuperAdmin);
  } catch (error) {
    if (error instanceof AppError) return { ok: false, message: error.message };
    return { ok: false, message: "যাচাই করা যায়নি — আবার লগইন করুন।" };
  }

  redirect(destination ?? "/admin");
}

export async function signupAction(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const intent = text(formData, "intent") || "request";
  const name = text(formData, "name").trim();
  const phone = text(formData, "phone").trim() || text(formData, "identifier").trim();
  const email = text(formData, "email").trim();
  const password = text(formData, "password");

  if (intent === "request") {
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
      return {
        ok: true,
        step: "otp",
        identifier: result.phone,
        name,
        email: email || undefined,
        message: result.devCode
          ? `ডেমো মোডে SMS নেই — আপনার কোড: ${result.devCode}`
          : `${result.phone} নম্বরে OTP পাঠানো হয়েছে। ৫ মিনিটের মধ্যে দিন।`,
        devCode: result.devCode,
      };
    } catch (error) {
      return { ok: false, message: error instanceof AppError ? error.message : "OTP পাঠানো যায়নি।" };
    }
  }

  const code = text(formData, "code").trim();
  const signupFields = { step: "otp" as const, identifier: phone || undefined, name, email: email || undefined };

  if (!phone) {
    return { ok: false, message: "মোবাইল নম্বর পাওয়া যায়নি — আবার OTP পাঠান।" };
  }
  if (!code) return { ok: false, ...signupFields, message: "OTP কোড দিন।" };

  const verified = await verifyOtp(phone, code, { purpose: "SIGNUP" });
  if (!verified.ok) {
    const message =
      verified.reason === "EXPIRED"
        ? "কোডটির মেয়াদ শেষ হয়েছে — আবার পাঠান।"
        : verified.reason === "LOCKED"
          ? "অনেকবার ভুল হয়েছে। নতুন কোড চেয়ে নিন।"
          : "কোডটি মিলছে না।";
    return { ok: false, ...signupFields, message };
  }

  try {
    const account = await provisionAccount({ phone, name, email: email || null, password });
    const tokens = await establishSession(account.userId, await requestMeta());
    await setAuthCookies(tokens);
  } catch (error) {
    if (error instanceof AppError) return { ok: false, ...signupFields, message: error.message };
    if ((error as { code?: string })?.code === "P2002") {
      return { ok: false, ...signupFields, message: "এই তথ্য দিয়ে আগেই অ্যাকাউন্ট আছে।" };
    }
    return { ok: false, ...signupFields, message: "অ্যাকাউন্ট তৈরি করা যায়নি। আবার চেষ্টা করুন।" };
  }

  redirect("/onboarding");
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
      identifier,
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
      identifier,
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
      identifier,
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
    if (error instanceof AppError) return { ok: false, step: "otp", identifier, message: error.message };
    return { ok: false, step: "otp", identifier, message: "পাসওয়ার্ড রিসেট করা যায়নি।" };
  }

  redirect("/login?reset=1");
}

export async function logoutAction(): Promise<void> {
  const session = await readSession();
  if (session) {
    // Close any live impersonation first, so the audit trail has an end event.
    if (session.user.isSuperAdmin) await endImpersonation(session.user.id);
    if (session.sessionId) await revokeSession(session.user.id, session.sessionId);
  }
  await clearAuthCookies();
  redirect("/login");
}

/** After login: super admins go to the platform console, merchants to their admin. */
async function landingPathFor(userId: string, isSuperAdmin: boolean): Promise<string> {
  if (isSuperAdmin) return "/super-admin";
  const store = await prisma.store.findFirst({
    where: { tenant: { memberships: { some: { userId, status: "ACTIVE" } } }, deletedAt: null },
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });
  return store ? "/admin" : "/onboarding";
}
