import { createHash, randomBytes } from "node:crypto";
import { prisma } from "@/lib/db";
import { ValidationError, NotFoundError } from "@/lib/errors";
import { assertPermission, PERMISSIONS, type ActorContext } from "@/lib/rbac";
import { assertApiAccess, requireWritableTenant } from "@/lib/entitlements";
import { recordAudit } from "@/lib/audit";

/**
 * Scoped API keys (PRD §11.10).
 *
 * The raw key is shown exactly once. Only its SHA-256 hash is stored, together
 * with a non-secret prefix for the UI. Keys are tenant-scoped and their scopes
 * are permission strings, so a leaked key cannot exceed the permissions the
 * merchant explicitly granted.
 */

export const API_KEY_PREFIX = "atlas_";

export type ApiKeyScope = (typeof PERMISSIONS)[number];

export function hashApiKey(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}

function generateKey(): { raw: string; prefix: string; hash: string } {
  const raw = `${API_KEY_PREFIX}${randomBytes(24).toString("base64url")}`;
  return {
    raw,
    prefix: raw.slice(0, 12),
    hash: hashApiKey(raw),
  };
}

const SCOPES = new Set<string>(PERMISSIONS);

export function parseScopes(input: unknown): string[] {
  if (!Array.isArray(input)) throw new ValidationError("অন্তত একটি scope দিন।");
  const scopes = [...new Set(input.map(String))].filter((scope) => SCOPES.has(scope));
  if (scopes.length === 0) throw new ValidationError("অন্তত একটি বৈধ scope দিন।");
  return scopes;
}

export async function createApiKey(
  actor: ActorContext,
  input: { name: string; scopes: unknown; expiresAt?: Date | null },
): Promise<{ id: string; raw: string; prefix: string; scopes: string[] }> {
  assertPermission(actor, "settings:write");
  const snapshot = await requireWritableTenant(actor.tenantId);
  assertApiAccess(snapshot, "FULL");

  const name = input.name.trim();
  if (name.length < 2 || name.length > 80) {
    throw new ValidationError("Key-এর নাম ২–৮০ অক্ষরের হতে হবে।");
  }
  const scopes = parseScopes(input.scopes);
  const key = generateKey();

  const created = await prisma.apiKey.create({
    data: {
      tenantId: actor.tenantId,
      name,
      prefix: key.prefix,
      hash: key.hash,
      scopesJson: scopes as never,
      createdBy: actor.userId,
      expiresAt: input.expiresAt ?? null,
    },
    select: { id: true, prefix: true, name: true, scopesJson: true },
  });

  await recordAudit({
    action: "api_key.created",
    tenantId: actor.tenantId,
    actorId: actor.userId,
    resourceType: "ApiKey",
    resourceId: created.id,
    metadata: { name, scopes },
  });

  return { id: created.id, raw: key.raw, prefix: created.prefix, scopes };
}

export async function listApiKeys(tenantId: string) {
  const rows = await prisma.apiKey.findMany({
    where: { tenantId },
    orderBy: [{ revokedAt: "asc" }, { createdAt: "desc" }],
    select: {
      id: true,
      name: true,
      prefix: true,
      scopesJson: true,
      lastUsedAt: true,
      expiresAt: true,
      revokedAt: true,
      createdAt: true,
    },
  });
  return rows.map((row) => ({
    ...row,
    scopes: Array.isArray(row.scopesJson) ? (row.scopesJson as string[]) : [],
  }));
}

export async function revokeApiKey(actor: ActorContext, keyId: string): Promise<void> {
  assertPermission(actor, "settings:write");
  await requireWritableTenant(actor.tenantId);

  const row = await prisma.apiKey.findFirst({
    where: { id: keyId, tenantId: actor.tenantId },
    select: { id: true, revokedAt: true, name: true },
  });
  if (!row) throw new NotFoundError("API key");
  if (row.revokedAt) return;

  await prisma.apiKey.update({ where: { id: row.id }, data: { revokedAt: new Date() } });
  await recordAudit({
    action: "api_key.revoked",
    tenantId: actor.tenantId,
    actorId: actor.userId,
    resourceType: "ApiKey",
    resourceId: row.id,
    metadata: { name: row.name },
  });
}

export type AuthenticatedApiKey = {
  tenantId: string;
  keyId: string;
  scopes: string[];
};

/**
 * Looks up a raw key without throwing; API routes call this before session
 * auth and convert a miss into the normal 401 path.
 */
export async function authenticateApiKey(raw: string): Promise<AuthenticatedApiKey | null> {
  if (!raw.startsWith(API_KEY_PREFIX) || raw.length < 20) return null;

  const key = await prisma.apiKey.findUnique({
    where: { hash: hashApiKey(raw) },
    select: {
      id: true,
      tenantId: true,
      scopesJson: true,
      revokedAt: true,
      expiresAt: true,
      tenant: { select: { status: true } },
    },
  });
  if (!key || key.revokedAt) return null;
  if (key.expiresAt && key.expiresAt < new Date()) return null;
  if (key.tenant.status === "SUSPENDED" || key.tenant.status === "CANCELLED") return null;

  await prisma.apiKey
    .update({ where: { id: key.id }, data: { lastUsedAt: new Date() } })
    .catch(() => undefined);

  return {
    tenantId: key.tenantId,
    keyId: key.id,
    scopes: Array.isArray(key.scopesJson) ? (key.scopesJson as string[]) : [],
  };
}
