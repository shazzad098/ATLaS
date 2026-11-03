import { jwtVerify, SignJWT } from "jose";
import { cookies } from "next/headers";
import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { AppError, ForbiddenError, NotFoundError, ValidationError } from "@/lib/errors";
import { recordImpersonation } from "@/lib/audit";

/**
 * Super Admin impersonation (FR-02, PRD §4.5 and §13).
 *
 * Rules enforced here, not in the UI:
 *  - only an active Super Admin can start one;
 *  - a reason and a support ticket/reference are mandatory;
 *  - it expires after 60 minutes and can be stopped early;
 *  - the merchant workspace is read-only while impersonating;
 *  - start and end are written to the audit trail with the reason/reference.
 *
 * The browser holds a signed, httpOnly cookie containing only the session id.
 * The database row remains the source of truth, so deleting or expiring the row
 * revokes access immediately.
 */

export const IMPERSONATION_COOKIE = "atlas_imp";
export const IMPERSONATION_TTL_MINUTES = 60;

function secretKey(): Uint8Array {
  return new TextEncoder().encode(env.authSecret);
}

function cookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: !env.isDev,
    path: "/",
    maxAge: IMPERSONATION_TTL_MINUTES * 60,
  };
}

async function signSessionToken(sessionId: string, superAdminId: string): Promise<string> {
  return new SignJWT({ sid: sessionId })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setSubject(superAdminId)
    .setIssuer("atlas")
    .setAudience("atlas-impersonation")
    .setIssuedAt()
    .setExpirationTime(`${IMPERSONATION_TTL_MINUTES}m`)
    .sign(secretKey());
}

export type ActiveImpersonation = {
  id: string;
  tenantId: string;
  tenantName: string;
  storeId: string | null;
  reason: string;
  reference: string;
  startedAt: Date;
  expiresAt: Date;
};

export async function startImpersonation(input: {
  superAdminId: string;
  tenantId: string;
  storeId?: string | null;
  reason: string;
  reference: string;
}): Promise<{ id: string; expiresAt: Date }> {
  const reason = input.reason.trim();
  const reference = input.reference.trim();
  if (reason.length < 6 || reason.length > 500) {
    throw new ValidationError("কারণ ৬–৫০০ অক্ষরের হতে হবে।");
  }
  if (reference.length < 2 || reference.length > 120) {
    throw new ValidationError("Support ticket / reference বাধ্যতামূলক।");
  }

  const [superAdmin, tenant] = await Promise.all([
    prisma.user.findUnique({
      where: { id: input.superAdminId },
      select: { id: true, isSuperAdmin: true, status: true },
    }),
    prisma.tenant.findUnique({
      where: { id: input.tenantId },
      select: { id: true, name: true },
    }),
  ]);
  if (!superAdmin?.isSuperAdmin || superAdmin.status !== "ACTIVE") {
    throw new ForbiddenError("শুধু সক্রিয় Super Admin impersonate করতে পারেন।");
  }
  if (!tenant) throw new NotFoundError("Tenant");

  if (input.storeId) {
    const store = await prisma.store.findFirst({
      where: { id: input.storeId, tenantId: tenant.id, deletedAt: null },
      select: { id: true },
    });
    if (!store) throw new NotFoundError("Store");
  }

  // One active impersonation per operator: a new one supersedes the old.
  await prisma.impersonationSession.updateMany({
    where: { superAdminId: input.superAdminId, endedAt: null },
    data: { endedAt: new Date() },
  });

  const session = await prisma.impersonationSession.create({
    data: {
      superAdminId: input.superAdminId,
      tenantId: tenant.id,
      storeId: input.storeId ?? null,
      reason,
      reference,
      expiresAt: new Date(Date.now() + IMPERSONATION_TTL_MINUTES * 60_000),
    },
    select: { id: true, expiresAt: true },
  });

  await recordImpersonation({
    superAdminId: input.superAdminId,
    tenantId: tenant.id,
    reason,
    reference,
    phase: "START",
  });

  const jar = await cookies();
  jar.set(
    IMPERSONATION_COOKIE,
    await signSessionToken(session.id, input.superAdminId),
    cookieOptions(),
  );

  return session;
}

/** Resolves the cookie to a still-valid session, or null. Never throws. */
export async function readImpersonation(): Promise<ActiveImpersonation | null> {
  const jar = await cookies();
  const token = jar.get(IMPERSONATION_COOKIE)?.value;
  if (!token) return null;

  let sessionId: string;
  let superAdminId: string;
  try {
    const { payload } = await jwtVerify(token, secretKey(), {
      issuer: "atlas",
      audience: "atlas-impersonation",
    });
    if (typeof payload.sid !== "string" || typeof payload.sub !== "string") return null;
    sessionId = payload.sid;
    superAdminId = payload.sub;
  } catch {
    return null;
  }

  const row = await prisma.impersonationSession.findUnique({
    where: { id: sessionId },
    include: {
      tenant: { select: { id: true, name: true } },
      superAdmin: { select: { id: true, isSuperAdmin: true, status: true } },
    },
  });
  if (!row || row.endedAt || row.expiresAt <= new Date()) return null;
  if (row.superAdminId !== superAdminId) return null;
  if (!row.superAdmin.isSuperAdmin || row.superAdmin.status !== "ACTIVE") return null;

  return {
    id: row.id,
    tenantId: row.tenantId,
    tenantName: row.tenant.name,
    storeId: row.storeId,
    reason: row.reason,
    reference: row.reference,
    startedAt: row.startedAt,
    expiresAt: row.expiresAt,
  };
}

export async function endImpersonation(superAdminId: string): Promise<void> {
  const jar = await cookies();
  const token = jar.get(IMPERSONATION_COOKIE)?.value;
  jar.set(IMPERSONATION_COOKIE, "", { ...cookieOptions(), maxAge: 0 });
  if (!token) return;

  try {
    const { payload } = await jwtVerify(token, secretKey(), {
      issuer: "atlas",
      audience: "atlas-impersonation",
    });
    if (typeof payload.sid !== "string" || typeof payload.sub !== "string") return;
    if (payload.sub !== superAdminId) return;

    const row = await prisma.impersonationSession.findUnique({
      where: { id: payload.sid },
      select: { id: true, tenantId: true, reason: true, reference: true, endedAt: true },
    });
    if (!row || row.endedAt) return;

    await prisma.impersonationSession.update({
      where: { id: row.id },
      data: { endedAt: new Date() },
    });
    await recordImpersonation({
      superAdminId,
      tenantId: row.tenantId,
      reason: row.reason,
      reference: row.reference,
      phase: "END",
    });
  } catch {
    // A malformed or expired token is already inert; clearing the cookie is enough.
  }
}

export async function clearImpersonationCookie(): Promise<void> {
  const jar = await cookies();
  jar.set(IMPERSONATION_COOKIE, "", { ...cookieOptions(), maxAge: 0 });
}

/** Explicit guard for code paths that must never run under impersonation. */
export async function assertNotImpersonating(): Promise<void> {
  const active = await readImpersonation();
  if (active) {
    throw new AppError(
      "FORBIDDEN",
      "Impersonation সেশন read-only। এই কাজটি বন্ধ করে নিজের অ্যাকাউন্ট থেকে করুন।",
      403,
    );
  }
}
