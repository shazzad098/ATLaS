import { z } from "zod";
import { clientIp, ok, parseBody, rateLimit, route } from "@/lib/api";
import { normalizePhone, requestOtp } from "@/lib/auth/otp";
import { findUserByIdentifier } from "@/lib/services/account-service";
import { ConflictError } from "@/lib/errors";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const requestOtpSchema = z.object({
  phone: z.string().min(8).max(24),
  purpose: z.enum(["LOGIN", "SIGNUP", "PASSWORD_RESET"]).default("LOGIN"),
});

export const POST = route(async (request: Request) => {
  await rateLimit(`auth:otp:ip:${clientIp(request)}`, 20);
  const input = await parseBody(request, requestOtpSchema);
  const phone = normalizePhone(input.phone);
  const existing = await findUserByIdentifier(phone);

  if (input.purpose === "SIGNUP" && existing) {
    throw new ConflictError("এই নম্বরে আগেই অ্যাকাউন্ট আছে — লগইন করুন।");
  }
  if (input.purpose === "PASSWORD_RESET" && !existing) {
    // Do not reveal whether an account exists.
    return ok({ requested: true, message: "এই তথ্য দিয়ে অ্যাকাউন্ট থাকলে OTP পাঠানো হয়েছে।" });
  }

  const result = await requestOtp(phone, {
    purpose: input.purpose,
    ip: clientIp(request),
  });
  return ok({
    requested: true,
    phone: result.phone,
    expiresAt: result.expiresAt,
    sentVia: result.sentVia,
    ...(result.devCode ? { devCode: result.devCode } : {}),
  });
});
