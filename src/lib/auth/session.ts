import { cache } from "react";
import { cookies } from "next/headers";
import { prisma } from "@/lib/db";
import { UnauthenticatedError, ForbiddenError } from "@/lib/errors";
import {
  ACCESS_COOKIE,
  CSRF_COOKIE,
  REFRESH_COOKIE,
  REFRESH_TTL_SECONDS,
  accessCookieOptions,
  csrfCookieOptions,
  generateCsrfToken,
  generateRefreshToken,
  hashRefreshToken,
  refreshCookieOptions,
  signAccessToken,
  verifyAccessToken,
} from "@/lib/auth/tokens";

/**
 * Session lifecycle (FR-01): create, read, rotate, revoke.
 *
 * Access tokens are verified statelessly. Refresh tokens live in the Session
 * table, so "logout all sessions" and single-session revocation both work.
 */

export type SessionUser = {
  id: string;
  phone: string;
  email: string | null;
  name: string | null;
  isSuperAdmin: boolean;
  status: string;
};

export type ActiveSession = {
  user: SessionUser;
  sessionId: string | null;
  /** True when the access token was gone and the refresh token was used. */
  viaRefresh: boolean;
};

const USER_SELECT = {
  id: true,
  phone: true,
  email: true,
  name: true,
  isSuperAdmin: true,
  status: true,
} as const;

export async function establishSession(
  userId: string,
  meta: { ip?: string; userAgent?: string } = {},
): Promise<{ accessToken: string; refreshToken: string; csrfToken: string; sessionId: string }> {
  const refreshToken = generateRefreshToken();
  const session = await prisma.session.create({
    data: {
      userId,
      refreshTokenHash: hashRefreshToken(refreshToken),
      expiresAt: new Date(Date.now() + REFRESH_TTL_SECONDS * 1000),
      ip: meta.ip,
      userAgent: meta.userAgent?.slice(0, 500),
    },
  });

  const accessToken = await signAccessToken({ sub: userId, sid: session.id });
  return { accessToken, refreshToken, csrfToken: generateCsrfToken(), sessionId: session.id };
}

/** Only callable from a Server Action or Route Handler. */
export async function setAuthCookies(tokens: {
  accessToken: string;
  refreshToken: string;
  csrfToken: string;
}): Promise<void> {
  const jar = await cookies();
  jar.set(ACCESS_COOKIE, tokens.accessToken, accessCookieOptions());
  jar.set(REFRESH_COOKIE, tokens.refreshToken, refreshCookieOptions());
  jar.set(CSRF_COOKIE, tokens.csrfToken, csrfCookieOptions());
}

export async function clearAuthCookies(): Promise<void> {
  const jar = await cookies();
  for (const name of [ACCESS_COOKIE, REFRESH_COOKIE, CSRF_COOKIE]) {
    jar.set(name, "", { path: "/", maxAge: 0 });
  }
}

/**
 * Resolve the caller. Access cookie first; if it is missing or expired the
 * refresh token is checked against the database. Deduped per request with
 * React `cache` so layout + page do not double-query.
 */
export const readSession = cache(async (): Promise<ActiveSession | null> => {
  const jar = await cookies();

  const accessToken = jar.get(ACCESS_COOKIE)?.value;
  if (accessToken) {
    const claims = await verifyAccessToken(accessToken);
    if (claims) {
      const session = await prisma.session.findUnique({
        where: { id: claims.sid },
        select: { id: true, revokedAt: true, expiresAt: true },
      });
      if (session && !session.revokedAt && session.expiresAt > new Date()) {
        const user = await prisma.user.findUnique({ where: { id: claims.sub }, select: USER_SELECT });
        if (user && user.status === "ACTIVE") {
          return { user, sessionId: session.id, viaRefresh: false };
        }
      }
    }
  }

  const refreshToken = jar.get(REFRESH_COOKIE)?.value;
  if (!refreshToken) return null;

  const session = await prisma.session.findUnique({
    where: { refreshTokenHash: hashRefreshToken(refreshToken) },
    select: { id: true, userId: true, revokedAt: true, expiresAt: true },
  });
  if (!session || session.revokedAt || session.expiresAt <= new Date()) return null;

  const user = await prisma.user.findUnique({ where: { id: session.userId }, select: USER_SELECT });
  if (!user || user.status !== "ACTIVE") return null;

  return { user, sessionId: session.id, viaRefresh: true };
});

export async function getCurrentUser(): Promise<SessionUser | null> {
  return (await readSession())?.user ?? null;
}

export async function requireUser(): Promise<SessionUser> {
  const session = await readSession();
  if (!session) throw new UnauthenticatedError();
  return session.user;
}

export async function requireSuperAdmin(): Promise<SessionUser> {
  const user = await requireUser();
  if (!user.isSuperAdmin) {
    throw new ForbiddenError("Super Admin access প্রয়োজন।");
  }
  return user;
}

/**
 * Rotate the refresh token and issue a new access token. Called from the
 * `/api/v1/auth/refresh` route handler, the only place allowed to write cookies.
 */
export async function rotateSession(): Promise<boolean> {
  const jar = await cookies();
  const refreshToken = jar.get(REFRESH_COOKIE)?.value;
  if (!refreshToken) return false;

  const session = await prisma.session.findUnique({
    where: { refreshTokenHash: hashRefreshToken(refreshToken) },
  });
  if (!session || session.revokedAt || session.expiresAt <= new Date()) return false;

  const nextRefresh = generateRefreshToken();
  await prisma.session.update({
    where: { id: session.id },
    data: {
      refreshTokenHash: hashRefreshToken(nextRefresh),
      expiresAt: new Date(Date.now() + REFRESH_TTL_SECONDS * 1000),
    },
  });

  const accessToken = await signAccessToken({ sub: session.userId, sid: session.id });
  const csrfToken = jar.get(CSRF_COOKIE)?.value ?? generateCsrfToken();
  await setAuthCookies({ accessToken, refreshToken: nextRefresh, csrfToken });
  return true;
}

export async function revokeSession(sessionId: string): Promise<void> {
  await prisma.session.updateMany({
    where: { id: sessionId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

export async function revokeAllSessions(userId: string, exceptSessionId?: string): Promise<number> {
  const result = await prisma.session.updateMany({
    where: {
      userId,
      revokedAt: null,
      ...(exceptSessionId ? { id: { not: exceptSessionId } } : {}),
    },
    data: { revokedAt: new Date() },
  });
  return result.count;
}

export async function listSessions(userId: string) {
  return prisma.session.findMany({
    where: { userId, revokedAt: null, expiresAt: { gt: new Date() } },
    orderBy: { createdAt: "desc" },
    select: { id: true, ip: true, userAgent: true, createdAt: true, expiresAt: true },
  });
}

/**
 * Double-submit CSRF check for cookie-authenticated mutations (PRD §13).
 * Bearer-token requests are exempt: they are not sent automatically by browsers.
 */
export function assertCsrf(request: Request): void {
  const authorization = request.headers.get("authorization");
  if (authorization?.startsWith("Bearer ")) return;

  const cookieHeader = request.headers.get("cookie") ?? "";
  const cookieValue = cookieHeader
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${CSRF_COOKIE}=`))
    ?.split("=")[1];

  const headerValue = request.headers.get("x-atlas-csrf");

  if (!cookieValue || !headerValue || cookieValue !== headerValue) {
    throw new ForbiddenError("CSRF যাচাই ব্যর্থ হয়েছে। পেজ reload করে আবার চেষ্টা করুন।");
  }
}
