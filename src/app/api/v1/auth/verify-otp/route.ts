import { z } from "zod";
import { clientIp, ok, parseBody, rateLimit, route } from "@/lib/api";
import { normalizePhone, verifyOtp } from "@/lib/auth/otp";
import { establishSession, setAuthCookies } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { AppError, ForbiddenError, NotFoundError } from "@/lib/errors";
import { recordAudit } from "@/lib/audit";

/**
 * Passwordless login — step 2 (FR-01).
 *
 * Verifies the code, then issues the same session pair the cookie login does.
 * Tokens are returned in the body for mobile/API clients *and* written as
 * cookies so a browser calling this endpoint lands signed in. Every failed
 * attempt is counted by `verifyOtp` (5 attempts, then the challenge locks).
 */

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const bodySchema = z.object({
  phone: z.string().trim().min(4).max(24),
  code: z.string().trim().regex(/^\d{6}$/, "৬ ডিজিটের কোড দিন।"),
});

const REASONS = {
  EXPIRED: "কোডটির মেয়াদ শেষ হয়েছে — আবার পাঠান।",
  MISMATCH: "কোডটি মিলছে না।",
  LOCKED: "অনেকবার ভুল হয়েছে — নতুন কোড চেয়ে নিন।",
} as const;

export const POST = route(async (request: Request) => {
  const ip = clientIp(request);
  rateLimit(`auth:otp:verify:${ip}`, 30);

  const { phone: rawPhone, code } = await parseBody(request, bodySchema);
  const result = await verifyOtp(rawPhone, code, { purpose: "LOGIN" });

  if (!result.ok) {
    throw new AppError("UNAUTHENTICATED", REASONS[result.reason], 401, {
      reason: result.reason,
    });
  }

  const phone = normalizePhone(rawPhone);
  const user = await prisma.user.findFirst({
    where: { phone, deletedAt: null },
    select: {
      id: true,
      name: true,
      phone: true,
      email: true,
      isSuperAdmin: true,
      status: true,
    },
  });

  if (!user) {
    throw new NotFoundError("এই নম্বরে কোনো account");
  }
  if (user.status !== "ACTIVE") {
    throw new ForbiddenError("এই accountটি এখন সক্রিয় নয়। সহায়তা টিমের সাথে যোগাযোগ করুন।");
  }

  const tokens = await establishSession(user.id, {
    ip,
    userAgent: request.headers.get("user-agent") ?? undefined,
  });
  await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
  await setAuthCookies(tokens);

  await recordAudit({
    action: "auth.login_otp",
    actorId: user.id,
    resourceType: "User",
    resourceId: user.id,
    metadata: { via: "api" },
    ip,
  });

  return ok({
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken,
    tokenType: "Bearer",
    expiresIn: 3600,
    user: {
      id: user.id,
      name: user.name,
      phone: user.phone,
      email: user.email,
      isSuperAdmin: user.isSuperAdmin,
    },
  });
});
