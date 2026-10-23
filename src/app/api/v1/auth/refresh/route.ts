import { clientIp, ok, rateLimit, route } from "@/lib/api";
import { assertCsrf, rotateSession } from "@/lib/auth/session";
import { UnauthenticatedError } from "@/lib/errors";

/**
 * Access-token refresh (FR-01). This is the only route allowed to rotate the
 * refresh cookie, which is why it lives in a Route Handler rather than a Server
 * Action. Rotation is single-use: the old refresh token stops working.
 */

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export const POST = route(async (request: Request) => {
  assertCsrf(request);
  rateLimit(`auth:refresh:${clientIp(request)}`, 60);

  const rotated = await rotateSession();
  if (!rotated) {
    throw new UnauthenticatedError("Refresh token অবৈধ বা মেয়াদোত্তীর্ণ। আবার login করুন।");
  }

  return ok({ refreshed: true, expiresIn: 3600 });
});
