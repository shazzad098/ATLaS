import { z } from "zod";
import { clientIp, ok, parseBody, rateLimit, route } from "@/lib/api";
import { requestOtp, OTP_TTL_SECONDS } from "@/lib/auth/otp";

/**
 * Passwordless login — step 1 (FR-01, PRD §11.1 "auth").
 *
 * Mobile clients cannot rely on the browser cookie flow, so the REST surface
 * exposes the same OTP pair the web login form uses. The code is stored only as
 * an HMAC (see `lib/auth/otp.ts`); when no SMS provider is configured the
 * sandbox returns it as `devCode` so the demo environment stays usable.
 */

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const bodySchema = z.object({
  phone: z.string().trim().min(4).max(24),
  /** LOGIN is the only REST-supported purpose; SIGNUP goes through the web form. */
  purpose: z.literal("LOGIN").default("LOGIN"),
});

export const POST = route(async (request: Request) => {
  const ip = clientIp(request);
  rateLimit(`auth:otp:${ip}`, 20);

  const { phone } = await parseBody(request, bodySchema);
  const result = await requestOtp(phone, { purpose: "LOGIN", ip });

  return ok(
    {
      phone: result.phone,
      expiresAt: result.expiresAt,
      expiresInSeconds: OTP_TTL_SECONDS,
      sentVia: result.sentVia,
      ...(result.devCode ? { devCode: result.devCode } : {}),
    },
    { status: 202 },
  );
});
