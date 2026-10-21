import bcrypt from "bcryptjs";
import QRCode from "qrcode";
import { and, desc, eq, gt, isNull, or } from "drizzle-orm";
import { db, affected } from "../db";
import { accountDeletionRequests, loginEvents, otpCodes, platformSettings, sessions, users, type User } from "../../drizzle/schema";
import { normalizeBdPhone } from "../../shared/domain";
import { addDays, fail } from "../lib/core";
import {
  decryptSecret,
  encryptSecret,
  generateTotpSecret,
  randomDigits,
  randomId,
  randomToken,
  signJwt,
  tokenHash,
  verifyJwt,
  verifyTotp,
} from "../lib/crypto";
import { consume } from "../lib/rateLimit";
import { audit, sendSms, track } from "./ops";
import { registerJob, every } from "./jobs";

export const COOKIE_AT = "atlas_at";
export const COOKIE_RT = "atlas_rt";
export const COOKIE_DEVICE = "atlas_dev";
export const ACCESS_TTL_SEC = 15 * 60;
export const REFRESH_TTL_DAYS = 30;
const OTP_TTL_MS = 5 * 60 * 1000;
const OTP_MAX_ATTEMPTS = 5;

export type Meta = { ip: string; userAgent: string; deviceId?: string | null };
export type PublicUser = Pick<User, "id" | "name" | "email" | "phone" | "platformRole" | "locale" | "twoFactorEnabled" | "status"> & {
  phoneVerified: boolean;
  hasPassword: boolean;
};
export function toPublicUser(u: User): PublicUser {
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    phone: u.phone,
    platformRole: u.platformRole,
    locale: u.locale,
    twoFactorEnabled: u.twoFactorEnabled,
    status: u.status,
    phoneVerified: !!u.phoneVerifiedAt,
    hasPassword: !!u.passwordHash,
  };
}

/* ───────── small caches to avoid a DB round-trip on every request ───────── */
const sessionCache = new Map<string, { valid: boolean; until: number; tfa: boolean }>();
const userCache = new Map<number, { user: User; until: number }>();
export function invalidateUser(userId: number) {
  userCache.delete(userId);
}
function invalidateSessions() {
  sessionCache.clear();
}
export async function getUserById(id: number): Promise<User | null> {
  const c = userCache.get(id);
  if (c && c.until > Date.now()) return c.user;
  const [u] = await db().select().from(users).where(eq(users.id, id)).limit(1);
  if (u) userCache.set(id, { user: u, until: Date.now() + 30_000 });
  return u ?? null;
}

async function logLogin(e: { userId?: number | null; identifier?: string; method: (typeof loginEvents.$inferInsert)["method"]; success: boolean; reason?: string; meta: Meta; suspicious?: boolean }) {
  await db()
    .insert(loginEvents)
    .values({
      userId: e.userId ?? null,
      identifier: e.identifier?.slice(0, 320) ?? null,
      method: e.method,
      success: e.success,
      reason: e.reason ?? null,
      suspicious: e.suspicious ?? false,
      ip: e.meta.ip,
      userAgent: e.meta.userAgent.slice(0, 500),
    })
    .catch(() => undefined);
}

/* ───────── Sessions with refresh-token rotation ───────── */
export type IssuedSession = { sessionId: string; accessToken: string; refreshToken: string; twoFactorPending: boolean };

export async function createSession(user: User, meta: Meta, opts: { twoFactorPassed?: boolean } = {}): Promise<IssuedSession> {
  const sid = randomId(32);
  const secret = randomToken(32);
  const tfaPassed = opts.twoFactorPassed ?? !user.twoFactorEnabled;
  await db()
    .insert(sessions)
    .values({
      id: sid,
      userId: user.id,
      familyId: sid,
      refreshTokenHash: tokenHash(secret),
      expiresAt: addDays(new Date(), REFRESH_TTL_DAYS),
      twoFactorPassed: tfaPassed,
      ip: meta.ip,
      userAgent: meta.userAgent.slice(0, 500),
    });
  await db().update(users).set({ lastSignedIn: new Date() }).where(eq(users.id, user.id));
  return { sessionId: sid, accessToken: issueAccess(user.id, sid, tfaPassed), refreshToken: `${sid}.${secret}`, twoFactorPending: !tfaPassed };
}

export const issueAccess = (uid: number, sid: string, tfa: boolean) => signJwt({ uid, sid, tfa }, ACCESS_TTL_SEC);

export type AccessClaims = { uid: number; sid: string; tfa: boolean };
export async function verifyAccess(token: string): Promise<AccessClaims | null> {
  const claims = verifyJwt<AccessClaims>(token);
  if (!claims) return null;
  const cached = sessionCache.get(claims.sid);
  if (cached && cached.until > Date.now()) return cached.valid ? { ...claims, tfa: claims.tfa && cached.tfa } : null;
  const [s] = await db().select().from(sessions).where(eq(sessions.id, claims.sid)).limit(1);
  const valid = !!s && !s.revokedAt && s.expiresAt > new Date();
  sessionCache.set(claims.sid, { valid, until: Date.now() + 30_000, tfa: !!s?.twoFactorPassed });
  return valid ? { ...claims, tfa: claims.tfa && !!s?.twoFactorPassed } : null;
}

export async function rotateRefresh(refreshToken: string, meta: Meta): Promise<{ accessToken: string; refreshToken?: string; userId: number; sessionId: string } | null> {
  const [sid, secret] = refreshToken.split(".");
  if (!sid || !secret) return null;
  const [s] = await db().select().from(sessions).where(eq(sessions.id, sid)).limit(1);
  if (!s || s.revokedAt || s.expiresAt < new Date()) return null;
  const h = tokenHash(secret);
  if (h === s.refreshTokenHash) {
    const next = randomToken(32);
    const nh = tokenHash(next);
    const ok = affected(
      await db()
        .update(sessions)
        .set({ prevRefreshHash: h, refreshTokenHash: nh, rotatedAt: new Date(), lastUsedAt: new Date(), ip: meta.ip })
        .where(and(eq(sessions.id, sid), eq(sessions.refreshTokenHash, h)))
    );
    if (ok) return { accessToken: issueAccess(s.userId, sid, s.twoFactorPassed), refreshToken: `${sid}.${next}`, userId: s.userId, sessionId: sid };
    return { accessToken: issueAccess(s.userId, sid, s.twoFactorPassed), userId: s.userId, sessionId: sid };
  }
  if (h === s.prevRefreshHash && s.rotatedAt && Date.now() - s.rotatedAt.getTime() < 60_000) {
    // Concurrent request raced the rotation; the browser already holds the new refresh cookie.
    return { accessToken: issueAccess(s.userId, sid, s.twoFactorPassed), userId: s.userId, sessionId: sid };
  }
  // Refresh token reuse → revoke the whole family (stolen token protection).
  await db().update(sessions).set({ revokedAt: new Date(), revokeReason: "refresh_reuse" }).where(eq(sessions.familyId, s.familyId));
  invalidateSessions();
  await logLogin({ userId: s.userId, method: "refresh", success: false, reason: "refresh token reuse detected", meta, suspicious: true });
  return null;
}

export async function revokeSession(sessionId: string, reason = "logout") {
  await db().update(sessions).set({ revokedAt: new Date(), revokeReason: reason }).where(and(eq(sessions.id, sessionId), isNull(sessions.revokedAt)));
  invalidateSessions();
}
export async function revokeAllSessions(userId: number, exceptSessionId?: string, reason = "logout_all") {
  const rows = await db().select({ id: sessions.id }).from(sessions).where(and(eq(sessions.userId, userId), isNull(sessions.revokedAt)));
  for (const r of rows) if (r.id !== exceptSessionId) await db().update(sessions).set({ revokedAt: new Date(), revokeReason: reason }).where(eq(sessions.id, r.id));
  invalidateSessions();
}
export async function listSessions(userId: number) {
  return db()
    .select({ id: sessions.id, ip: sessions.ip, userAgent: sessions.userAgent, createdAt: sessions.createdAt, lastUsedAt: sessions.lastUsedAt, expiresAt: sessions.expiresAt })
    .from(sessions)
    .where(and(eq(sessions.userId, userId), isNull(sessions.revokedAt), gt(sessions.expiresAt, new Date())))
    .orderBy(desc(sessions.lastUsedAt));
}

/* ───────── OTP (Bangladesh mobile) ───────── */
export type OtpPurpose = (typeof otpCodes.$inferInsert)["purpose"];

export async function sandboxOtpLoginAllowed(): Promise<boolean> {
  const [row] = await db().select().from(platformSettings).where(eq(platformSettings.key, "security.allowSandboxOtpLogin")).limit(1);
  return row ? row.valueJson === true : true;
}

export async function requestOtp(input: { phone: string; purpose: OtpPurpose }, meta: Meta) {
  const phone = normalizeBdPhone(input.phone);
  if (!phone) fail("VALIDATION", "Enter a valid Bangladesh mobile number (e.g. 01712345678)");
  if (!consume("otp_phone", `${phone}:${input.purpose}`, 3, 10 * 60_000, meta.ip).allowed) fail("RATE_LIMITED", "Too many codes requested for this number. Try again in 10 minutes.");
  if (!consume("otp_ip", meta.ip, 12, 10 * 60_000, meta.ip).allowed) fail("RATE_LIMITED", "Too many OTP requests from this device. Try again later.");
  if (input.purpose === "login" || input.purpose === "password_reset") {
    const [u] = await db().select().from(users).where(eq(users.phone, phone)).limit(1);
    if (!u || u.status === "deleted") fail("NOT_FOUND", "No ATLaS account uses this mobile number");
    if (u.platformRole !== "none") fail("FORBIDDEN", "Platform staff accounts must sign in with password (and 2FA).");
    if (!(await sandboxOtpLoginAllowed())) fail("FORBIDDEN", "OTP sign-in is disabled until a production SMS provider is configured.");
  }
  const code = randomDigits(6);
  await db()
    .insert(otpCodes)
    .values({ phone, purpose: input.purpose, codeHash: tokenHash(`${phone}:${input.purpose}:${code}`), expiresAt: new Date(Date.now() + OTP_TTL_MS), ip: meta.ip, deviceId: meta.deviceId ?? null });
  await sendSms({
    to: phone,
    body: `ATLaS: ${code} is your verification code. It expires in 5 minutes. Never share it with anyone.`,
    template: `otp_${input.purpose}`,
    deviceId: meta.deviceId ?? null,
  });
  await logLogin({ identifier: phone, method: "otp_request", success: true, reason: input.purpose, meta });
  return { phone, expiresInSec: OTP_TTL_MS / 1000, channel: "sandbox-sms" as const };
}

export async function consumeOtp(input: { phone: string; purpose: OtpPurpose; code: string }, meta: Meta): Promise<string> {
  const phone = normalizeBdPhone(input.phone);
  if (!phone) fail("VALIDATION", "Invalid mobile number");
  const [otp] = await db()
    .select()
    .from(otpCodes)
    .where(and(eq(otpCodes.phone, phone), eq(otpCodes.purpose, input.purpose), isNull(otpCodes.consumedAt), gt(otpCodes.expiresAt, new Date())))
    .orderBy(desc(otpCodes.id))
    .limit(1);
  if (!otp) fail("VALIDATION", "Code expired or not found. Request a new code.");
  if (otp.attempts >= OTP_MAX_ATTEMPTS) fail("RATE_LIMITED", "Too many incorrect attempts. Request a new code.");
  if (otp.codeHash !== tokenHash(`${phone}:${input.purpose}:${input.code.trim()}`)) {
    await db().update(otpCodes).set({ attempts: otp.attempts + 1 }).where(eq(otpCodes.id, otp.id));
    await logLogin({ identifier: phone, method: "otp", success: false, reason: "incorrect code", meta, suspicious: otp.attempts + 1 >= 3 });
    fail("VALIDATION", `Incorrect code. ${OTP_MAX_ATTEMPTS - otp.attempts - 1} attempts left.`);
  }
  const ok = affected(await db().update(otpCodes).set({ consumedAt: new Date() }).where(and(eq(otpCodes.id, otp.id), isNull(otpCodes.consumedAt))));
  if (!ok) fail("VALIDATION", "Code already used");
  return phone;
}

/* ───────── Signup / login ───────── */
export async function signup(input: { name: string; email?: string; phone: string; password: string; locale?: string }, meta: Meta) {
  if (!consume("signup_ip", meta.ip, 10, 60 * 60_000, meta.ip).allowed) fail("RATE_LIMITED", "Too many signups from this network. Try again later.");
  const phone = normalizeBdPhone(input.phone);
  if (!phone) fail("VALIDATION", "Enter a valid Bangladesh mobile number (e.g. 01712345678)");
  const email = input.email?.trim().toLowerCase() || null;
  const existing = await db()
    .select({ id: users.id, phone: users.phone, email: users.email })
    .from(users)
    .where(email ? or(eq(users.phone, phone), eq(users.email, email)) : eq(users.phone, phone))
    .limit(1);
  if (existing.length) fail("CONFLICT", existing[0].phone === phone ? "This mobile number is already registered. Sign in instead." : "This email is already registered.");
  if (input.password.length < 8) fail("VALIDATION", "Password must be at least 8 characters");
  const [row] = await db()
    .insert(users)
    .values({ name: input.name.trim(), email, phone, passwordHash: await bcrypt.hash(input.password, 10), loginMethod: "password", locale: input.locale === "bn" ? "bn" : "en" })
    .$returningId();
  const user = (await getUserById(row.id))!;
  await requestOtp({ phone, purpose: "verify_phone" }, meta);
  const session = await createSession(user, meta, { twoFactorPassed: true });
  await audit({ actorId: user.id, actorType: "merchant", action: "user.signup", resourceType: "user", resourceId: user.id, ip: meta.ip });
  return { user, session };
}

export async function verifyPhone(user: User, code: string, meta: Meta) {
  if (!user.phone) fail("VALIDATION", "No phone number on this account");
  await consumeOtp({ phone: user.phone, purpose: "verify_phone", code }, meta);
  await db().update(users).set({ phoneVerifiedAt: new Date() }).where(eq(users.id, user.id));
  invalidateUser(user.id);
  if (!user.phoneVerifiedAt) await track("signup_completed", { userId: user.id });
  return true;
}

export async function loginWithPassword(input: { identifier: string; password: string }, meta: Meta) {
  const ident = input.identifier.trim().toLowerCase();
  if (!consume("login_ident", ident, 6, 15 * 60_000, meta.ip).allowed || !consume("login_ip", meta.ip, 30, 15 * 60_000, meta.ip).allowed) {
    await logLogin({ identifier: ident, method: "password", success: false, reason: "rate limited", meta, suspicious: true });
    fail("RATE_LIMITED", "Too many sign-in attempts. Please wait 15 minutes.");
  }
  const phone = normalizeBdPhone(ident);
  const [u] = await db()
    .select()
    .from(users)
    .where(phone ? eq(users.phone, phone) : eq(users.email, ident))
    .limit(1);
  if (!u || !u.passwordHash || !(await bcrypt.compare(input.password, u.passwordHash))) {
    await logLogin({ userId: u?.id, identifier: ident, method: "password", success: false, reason: "invalid credentials", meta });
    fail("UNAUTHENTICATED", "Incorrect mobile/email or password");
  }
  if (u.status === "suspended" || u.status === "deleted") fail("FORBIDDEN", "This account is not active. Contact support.");
  const session = await createSession(u, meta);
  await logLogin({ userId: u.id, identifier: ident, method: "password", success: true, meta });
  return { user: u, session };
}

export async function loginWithOtp(input: { phone: string; code: string }, meta: Meta) {
  const phone = await consumeOtp({ phone: input.phone, purpose: "login", code: input.code }, meta);
  const [u] = await db().select().from(users).where(eq(users.phone, phone)).limit(1);
  if (!u || u.status === "deleted" || u.status === "suspended") fail("FORBIDDEN", "This account is not active");
  if (u.platformRole !== "none") fail("FORBIDDEN", "Platform staff must sign in with password");
  if (!u.phoneVerifiedAt) await db().update(users).set({ phoneVerifiedAt: new Date() }).where(eq(users.id, u.id));
  const session = await createSession(u, meta);
  await logLogin({ userId: u.id, identifier: phone, method: "otp", success: true, meta });
  return { user: u, session };
}

export async function resetPassword(input: { phone: string; code: string; newPassword: string }, meta: Meta) {
  if (input.newPassword.length < 8) fail("VALIDATION", "Password must be at least 8 characters");
  const phone = await consumeOtp({ phone: input.phone, purpose: "password_reset", code: input.code }, meta);
  const [u] = await db().select().from(users).where(eq(users.phone, phone)).limit(1);
  if (!u) fail("NOT_FOUND", "Account not found");
  await db().update(users).set({ passwordHash: await bcrypt.hash(input.newPassword, 10) }).where(eq(users.id, u.id));
  await revokeAllSessions(u.id, undefined, "password_reset");
  invalidateUser(u.id);
  await audit({ actorId: u.id, actorType: "merchant", action: "user.password_reset", resourceType: "user", resourceId: u.id, ip: meta.ip });
  return true;
}

export async function changePassword(user: User, current: string, next: string, keepSession: string) {
  if (user.passwordHash && !(await bcrypt.compare(current, user.passwordHash))) fail("VALIDATION", "Current password is incorrect");
  if (next.length < 8) fail("VALIDATION", "Password must be at least 8 characters");
  await db().update(users).set({ passwordHash: await bcrypt.hash(next, 10) }).where(eq(users.id, user.id));
  await revokeAllSessions(user.id, keepSession, "password_changed");
  invalidateUser(user.id);
}

/* ───────── TOTP 2FA (Super Admin and Pro merchants) ───────── */
export async function begin2fa(user: User) {
  const secret = generateTotpSecret();
  await db().update(users).set({ twoFactorSecretEnc: encryptSecret(secret, "totp"), twoFactorEnabled: false }).where(eq(users.id, user.id));
  invalidateUser(user.id);
  const label = encodeURIComponent(`ATLaS:${user.email ?? user.phone ?? user.id}`);
  const uri = `otpauth://totp/${label}?secret=${secret}&issuer=ATLaS&digits=6&period=30`;
  return { secret, uri, qrDataUrl: await QRCode.toDataURL(uri, { margin: 1, width: 220 }) };
}
export async function confirm2fa(user: User, code: string, sessionId: string) {
  if (!user.twoFactorSecretEnc) fail("INVALID_STATE", "Start 2FA setup first");
  if (!verifyTotp(decryptSecret(user.twoFactorSecretEnc, "totp"), code)) fail("VALIDATION", "Invalid authenticator code");
  await db().update(users).set({ twoFactorEnabled: true }).where(eq(users.id, user.id));
  await db().update(sessions).set({ twoFactorPassed: true }).where(eq(sessions.id, sessionId));
  invalidateUser(user.id);
  invalidateSessions();
}
export async function disable2fa(user: User, code: string) {
  if (!user.twoFactorEnabled || !user.twoFactorSecretEnc) return;
  if (!verifyTotp(decryptSecret(user.twoFactorSecretEnc, "totp"), code)) fail("VALIDATION", "Invalid authenticator code");
  await db().update(users).set({ twoFactorEnabled: false, twoFactorSecretEnc: null }).where(eq(users.id, user.id));
  invalidateUser(user.id);
}
export async function pass2fa(user: User, sessionId: string, code: string, meta: Meta) {
  if (!consume("tfa", String(user.id), 6, 10 * 60_000, meta.ip).allowed) fail("RATE_LIMITED", "Too many attempts");
  if (!user.twoFactorSecretEnc || !verifyTotp(decryptSecret(user.twoFactorSecretEnc, "totp"), code)) {
    await logLogin({ userId: user.id, method: "two_factor", success: false, reason: "invalid code", meta });
    fail("VALIDATION", "Invalid authenticator code");
  }
  await db().update(sessions).set({ twoFactorPassed: true }).where(eq(sessions.id, sessionId));
  invalidateSessions();
  await logLogin({ userId: user.id, method: "two_factor", success: true, meta });
  return issueAccess(user.id, sessionId, true);
}

/* ───────── Account deletion with retention ───────── */
export const DELETION_GRACE_DAYS = 30;
export async function requestDeletion(user: User, reason: string | undefined) {
  await db().insert(accountDeletionRequests).values({ userId: user.id, reason: reason ?? null, scheduledFor: addDays(new Date(), DELETION_GRACE_DAYS) });
  await db().update(users).set({ status: "pending_deletion" }).where(eq(users.id, user.id));
  invalidateUser(user.id);
  await audit({ actorId: user.id, actorType: "merchant", action: "user.deletion_requested", resourceType: "user", resourceId: user.id });
}
export async function cancelDeletion(user: User) {
  await db().update(accountDeletionRequests).set({ status: "cancelled" }).where(and(eq(accountDeletionRequests.userId, user.id), eq(accountDeletionRequests.status, "requested")));
  await db().update(users).set({ status: "active" }).where(eq(users.id, user.id));
  invalidateUser(user.id);
}
export async function deletionStatus(userId: number) {
  const [r] = await db()
    .select()
    .from(accountDeletionRequests)
    .where(and(eq(accountDeletionRequests.userId, userId), eq(accountDeletionRequests.status, "requested")))
    .limit(1);
  return r ?? null;
}

registerJob("account.delete", async payload => {
  const id = Number(payload.requestId);
  const [r] = await db().select().from(accountDeletionRequests).where(eq(accountDeletionRequests.id, id)).limit(1);
  if (!r || r.status !== "requested") return { skipped: true };
  // Personal data is anonymised; financial records (orders, invoices, fee ledger) are retained per policy.
  await db()
    .update(users)
    .set({ status: "deleted", name: "Deleted user", email: null, phone: null, passwordHash: null, twoFactorSecretEnc: null, twoFactorEnabled: false })
    .where(eq(users.id, r.userId));
  await db().update(accountDeletionRequests).set({ status: "completed" }).where(eq(accountDeletionRequests.id, id));
  await revokeAllSessions(r.userId, undefined, "account_deleted");
  invalidateUser(r.userId);
  return { completed: true };
});

every("account-deletions", 60 * 60_000, async () => {
  const due = await db()
    .select()
    .from(accountDeletionRequests)
    .where(and(eq(accountDeletionRequests.status, "requested")));
  const { enqueue } = await import("./jobs");
  for (const r of due) if (r.scheduledFor <= new Date()) await enqueue("account.delete", { requestId: r.id }, { dedupeKey: `account.delete:${r.id}` });
});
