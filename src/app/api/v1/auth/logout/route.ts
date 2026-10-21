import { ok, route } from "@/lib/api";
import { assertCsrf, clearAuthCookies, readSession, revokeSession } from "@/lib/auth/session";

/**
 * Revoke the current session and clear the auth cookies (FR-01). With a bearer
 * token there are no cookies to clear, so the response is still a clean 200.
 */

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export const POST = route(async (request: Request) => {
  assertCsrf(request);

  const session = await readSession();
  if (session?.sessionId) {
    await revokeSession(session.sessionId);
  }
  await clearAuthCookies();

  return ok({ loggedOut: true });
});
