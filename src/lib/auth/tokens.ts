import { createHash, randomBytes } from "node:crypto";
import { SignJWT, jwtVerify } from "jose";
import { env } from "@/lib/env";

/**
 * Session tokens (FR-01).
 *
 * - Access token: short-lived JWT (HS256), stateless, sent on every request.
 * - Refresh token: 32 random bytes, stored only as a SHA-256 hash, rotated on
 *   every use so a stolen token is single-use (refresh token rotation).
 */

export const ACCESS_TTL_SECONDS = 60 * 60; // 1 hour
export const REFRESH_TTL_SECONDS = 60 * 60 * 24 * 30; // 30 days

export const ACCESS_COOKIE = "atlas_at";
export const REFRESH_COOKIE = "atlas_rt";
export const CSRF_COOKIE = "atlas_csrf";
export const TENANT_COOKIE = "atlas_tenant";

export type AccessClaims = {
  /** user id */
  sub: string;
  /** session id, so a session can be revoked mid-lifetime */
  sid: string;
};

function secretKey(): Uint8Array {
  return new TextEncoder().encode(env.authSecret);
}

export async function signAccessToken(claims: AccessClaims): Promise<string> {
  return new SignJWT({ sid: claims.sid })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setSubject(claims.sub)
    .setIssuedAt()
    .setIssuer("atlas")
    .setAudience("atlas-app")
    .setExpirationTime(`${ACCESS_TTL_SECONDS}s`)
    .sign(secretKey());
}

export async function verifyAccessToken(token: string): Promise<AccessClaims | null> {
  try {
    const { payload } = await jwtVerify(token, secretKey(), {
      issuer: "atlas",
      audience: "atlas-app",
    });
    if (typeof payload.sub !== "string" || typeof payload.sid !== "string") return null;
    return { sub: payload.sub, sid: payload.sid };
  } catch {
    return null;
  }
}

export function generateRefreshToken(): string {
  return randomBytes(32).toString("base64url");
}

/** Refresh tokens are never stored in plaintext. */
export function hashRefreshToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function generateCsrfToken(): string {
  return randomBytes(24).toString("base64url");
}

export function accessCookieOptions() {
  const isHttps = process.env.NEXT_PUBLIC_APP_URL?.startsWith("https") ?? false;
  return {
    httpOnly: true,
    sameSite: (isHttps ? "none" : "lax") as "none" | "lax",
    secure: isHttps || !env.isDev,
    path: "/",
    maxAge: ACCESS_TTL_SECONDS,
  };
}

export function refreshCookieOptions() {
  const isHttps = process.env.NEXT_PUBLIC_APP_URL?.startsWith("https") ?? false;
  return {
    httpOnly: true,
    sameSite: (isHttps ? "none" : "lax") as "none" | "lax",
    secure: isHttps || !env.isDev,
    path: "/",
    maxAge: REFRESH_TTL_SECONDS,
  };
}

/** Readable by JS so the double-submit CSRF pattern works (PRD §13). */
export function csrfCookieOptions() {
  const isHttps = process.env.NEXT_PUBLIC_APP_URL?.startsWith("https") ?? false;
  return {
    httpOnly: false,
    sameSite: (isHttps ? "none" : "lax") as "none" | "lax",
    secure: isHttps || !env.isDev,
    path: "/",
    maxAge: REFRESH_TTL_SECONDS,
  };
}
