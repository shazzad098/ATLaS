/**
 * Auth constants.
 *
 * These intentionally mirror `src/lib/auth/tokens.ts` in the Next.js app so a
 * session created by either surface is accepted by the other: same cookie names,
 * same HS256 algorithm, same issuer/audience, same refresh-token format.
 */

export const ACCESS_TTL_SECONDS = 60 * 60; // 1 hour
export const REFRESH_TTL_SECONDS = 60 * 60 * 24 * 30; // 30 days

export const ACCESS_COOKIE = "atlas_at";
export const REFRESH_COOKIE = "atlas_rt";
export const CSRF_COOKIE = "atlas_csrf";

export const JWT_ISSUER = "atlas";
export const JWT_AUDIENCE = "atlas-app";
export const JWT_ALGORITHM = "HS256";
