import { z } from "zod";
import { clientIp, ok, parseBody, rateLimit, route } from "@/lib/api";
import { normalizePhone, verifyOtp } from "@/lib/auth/otp";
import { establishSession, setAuthCookies } from "@/lib/auth/session";
import { AppError, UnauthenticatedError, ValidationError } from "@/lib/errors";
import { findUserByIdentifier, provisionAccount, resetPassword } from "@/lib/services/account-service";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const verifyOtpSchema = z.object({
  phone: z.string().min(8).max(24),
  code: z.string().regex(/^\d{6}$/, "OTP অবশ্যই ৬ সংখ্যার হতে হবে।"),
  purpose: z.enum(["LOGIN", "SIGNUP", "PASSWORD_RESET"]).default("LOGIN"),
  name: z.string().min(2).max(120).optional(),
  email: z.string().email().max(255).optional().or(z.literal("")),
  password: z.string().min(8).max(128).optional(),
  newPassword: z.string().min(8).max(128).optional(),
});

function publicUser(user: { id: string; phone: string; email: string | null; name: string | null; isSuperAdmin: boolean }) {
  return { id: user.id, phone: user.phone, email: user.email, name: user.name, isSuperAdmin: user.isSuperAdmin };
}

export const POST = route(async (request: Request) => {
  await rateLimit(`auth:otp:verify:${clientIp(request)}`, 30);
  const input = await parseBody(request, verifyOtpSchema);
  const phone = normalizePhone(input.phone);
  const verified = await verifyOtp(phone, input.code, { purpose: input.purpose });
  if (!verified.ok) {
    throw new AppError(
      verified.reason === "LOCKED" ? "RATE_LIMITED" : "VALIDATION_FAILED",
      verified.reason === "EXPIRED" ? "OTP-এর মেয়াদ শেষ হয়েছে।" : verified.reason === "LOCKED" ? "অনেকবার ভুল হয়েছে। নতুন OTP নিন।" : "OTP সঠিক নয়।",
      verified.reason === "LOCKED" ? 429 : 422,
      { reason: verified.reason },
    );
  }

  if (input.purpose === "SIGNUP") {
    if (!input.name || !input.password) {
      throw new ValidationError("Signup-এর জন্য name এবং password প্রয়োজন।", { fields: ["name", "password"] });
    }
    const account = await provisionAccount({ phone, name: input.name, email: input.email || null, password: input.password });
    const tokens = await establishSession(account.userId, {
      ip: clientIp(request),
      userAgent: request.headers.get("user-agent") ?? undefined,
    });
    await setAuthCookies(tokens);
    return ok({ verified: true, purpose: input.purpose, session: true, userId: account.userId, tenantId: account.tenantId });
  }

  const user = await findUserByIdentifier(phone);
  if (!user || user.status !== "ACTIVE") {
    throw new UnauthenticatedError("এই নম্বরে কোনো সক্রিয় অ্যাকাউন্ট নেই।");
  }

  if (input.purpose === "PASSWORD_RESET") {
    if (!input.newPassword) throw new ValidationError("Password reset-এর জন্য newPassword প্রয়োজন।", { field: "newPassword" });
    await resetPassword(user.id, input.newPassword);
    await prisma.session.updateMany({ where: { userId: user.id, revokedAt: null }, data: { revokedAt: new Date() } });
    return ok({ verified: true, purpose: input.purpose, session: false, user: publicUser(user) });
  }

  const tokens = await establishSession(user.id, {
    ip: clientIp(request),
    userAgent: request.headers.get("user-agent") ?? undefined,
  });
  await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
  await setAuthCookies(tokens);
  return ok({ verified: true, purpose: input.purpose, session: true, user: publicUser(user) });
});
