import { and, desc, eq, inArray, isNull } from "drizzle-orm";
import { db } from "../db";
import { apiKeys, webhookDeliveries, webhookEndpoints, type PlanLimits } from "../../drizzle/schema";
import { fail } from "../lib/core";
import { encryptSecret, randomId, randomToken, sha256 } from "../lib/crypto";
import { assertFeature, getEntitlements } from "./billing";
import { enqueue } from "./jobs";
import { assertPublicUrl, audit, WEBHOOK_EVENTS } from "./ops";
import { requirePerm, requireWrite, type TenantScope } from "./tenancy";

export const API_SCOPES = ["store:read", "catalog:read", "catalog:write", "inventory:read", "inventory:write", "orders:read", "orders:write", "customers:read"] as const;
export type ApiScope = (typeof API_SCOPES)[number];

/** Plan → API scopes (Free: public read-only; Basic: API + webhooks; Standard: full scoped; Pro: full + higher rate limit). */
export function allowedScopes(level: PlanLimits["apiAccess"]): ApiScope[] {
  if (level === "read_public") return ["store:read", "catalog:read"];
  if (level === "api_webhooks") return ["store:read", "catalog:read", "inventory:read", "orders:read", "customers:read"];
  return [...API_SCOPES];
}

export async function listApiKeys(scope: TenantScope) {
  requirePerm(scope, "developers.manage");
  const rows = await db().select().from(apiKeys).where(eq(apiKeys.tenantId, scope.tenantId)).orderBy(desc(apiKeys.id));
  return {
    keys: rows.map(({ keyHash: _h, ...k }) => k),
    allowedScopes: allowedScopes(scope.ent.limits.apiAccess),
    rateLimitPerMin: scope.ent.limits.apiRateLimitPerMin,
    webhooksAllowed: scope.ent.limits.apiAccess !== "read_public",
  };
}

export async function createApiKey(scope: TenantScope, input: { name: string; scopes: ApiScope[] }) {
  requireWrite(scope, "developers.manage");
  const allowed = allowedScopes(scope.ent.limits.apiAccess);
  const bad = input.scopes.filter(s => !allowed.includes(s));
  if (bad.length) fail("FEATURE_NOT_IN_PLAN", `Scopes not available on your plan: ${bad.join(", ")}`, { requiredPlan: "standard" });
  if (!input.scopes.length) fail("VALIDATION", "Select at least one scope");
  const active = await db().select({ id: apiKeys.id }).from(apiKeys).where(and(eq(apiKeys.tenantId, scope.tenantId), isNull(apiKeys.revokedAt)));
  if (active.length >= 10) fail("QUOTA_EXCEEDED", "Up to 10 active API keys");
  const prefix = `atl_${randomId(10)}`;
  const secret = randomToken(24);
  const token = `${prefix}.${secret}`;
  await db().insert(apiKeys).values({ tenantId: scope.tenantId, storeId: scope.storeId, name: input.name.trim(), prefix, keyHash: sha256(token), scopesJson: input.scopes, createdBy: scope.userId });
  await audit({ tenantId: scope.tenantId, actorId: scope.userId, actorType: "merchant", action: "api_key.created", resourceType: "api_key", resourceId: prefix, metadata: { scopes: input.scopes }, impersonationId: scope.impersonationId });
  return { token, prefix };
}

export async function revokeApiKey(scope: TenantScope, id: number) {
  requireWrite(scope, "developers.manage");
  await db().update(apiKeys).set({ revokedAt: new Date() }).where(and(eq(apiKeys.id, id), eq(apiKeys.tenantId, scope.tenantId)));
  await audit({ tenantId: scope.tenantId, actorId: scope.userId, actorType: "merchant", action: "api_key.revoked", resourceType: "api_key", resourceId: id, impersonationId: scope.impersonationId });
}

const lastTouched = new Map<number, number>();
export async function authenticateApiKey(token: string) {
  const prefix = token.split(".")[0];
  if (!prefix?.startsWith("atl_")) return null;
  const [k] = await db().select().from(apiKeys).where(eq(apiKeys.prefix, prefix)).limit(1);
  if (!k || k.revokedAt || k.keyHash !== sha256(token)) return null;
  const ent = await getEntitlements(k.tenantId);
  const allowed = allowedScopes(ent.limits.apiAccess);
  if ((lastTouched.get(k.id) ?? 0) < Date.now() - 60_000) {
    lastTouched.set(k.id, Date.now());
    await db().update(apiKeys).set({ lastUsedAt: new Date() }).where(eq(apiKeys.id, k.id));
  }
  // Downgrades shrink effective scopes immediately without touching the stored key.
  return { key: k, tenantId: k.tenantId, storeId: k.storeId, scopes: new Set(k.scopesJson.filter(s => allowed.includes(s as ApiScope)) as ApiScope[]), ent };
}

/* ───────── Outbound webhooks ───────── */
export async function listWebhooks(scope: TenantScope) {
  requirePerm(scope, "developers.manage");
  const endpoints = await db().select().from(webhookEndpoints).where(eq(webhookEndpoints.tenantId, scope.tenantId)).orderBy(desc(webhookEndpoints.id));
  const deliveries = await db().select().from(webhookDeliveries).where(eq(webhookDeliveries.tenantId, scope.tenantId)).orderBy(desc(webhookDeliveries.id)).limit(50);
  return { endpoints: endpoints.map(({ secretEnc: _s, ...e }) => e), deliveries, events: [...WEBHOOK_EVENTS] };
}

export async function createWebhook(scope: TenantScope, input: { url: string; events: string[] }) {
  requireWrite(scope, "developers.manage");
  assertFeature(scope.ent.limits.apiAccess !== "read_public", "Webhooks", "basic");
  try {
    await assertPublicUrl(input.url);
  } catch (e) {
    fail("VALIDATION", (e as Error).message);
  }
  if (!input.events.length) fail("VALIDATION", "Select at least one event");
  const existing = await db().select({ id: webhookEndpoints.id }).from(webhookEndpoints).where(eq(webhookEndpoints.tenantId, scope.tenantId));
  if (existing.length >= 5) fail("QUOTA_EXCEEDED", "Up to 5 webhook endpoints");
  const secret = `whsec_${randomToken(24)}`;
  const [row] = await db().insert(webhookEndpoints).values({ tenantId: scope.tenantId, storeId: scope.storeId, url: input.url, eventsJson: input.events, secretEnc: encryptSecret(secret, "webhook") }).$returningId();
  await audit({ tenantId: scope.tenantId, actorId: scope.userId, actorType: "merchant", action: "webhook.created", resourceType: "webhook", resourceId: row.id, metadata: { url: input.url }, impersonationId: scope.impersonationId });
  return { id: row.id, secret };
}

export async function setWebhookStatus(scope: TenantScope, id: number, status: "active" | "disabled") {
  requireWrite(scope, "developers.manage");
  await db().update(webhookEndpoints).set({ status }).where(and(eq(webhookEndpoints.id, id), eq(webhookEndpoints.tenantId, scope.tenantId)));
}
export async function deleteWebhook(scope: TenantScope, id: number) {
  requireWrite(scope, "developers.manage");
  await db().delete(webhookEndpoints).where(and(eq(webhookEndpoints.id, id), eq(webhookEndpoints.tenantId, scope.tenantId)));
}
export async function sendTestWebhook(scope: TenantScope, id: number) {
  requireWrite(scope, "developers.manage");
  const [ep] = await db().select().from(webhookEndpoints).where(and(eq(webhookEndpoints.id, id), eq(webhookEndpoints.tenantId, scope.tenantId))).limit(1);
  if (!ep) fail("NOT_FOUND", "Endpoint not found");
  const payload = { id: `evt_test_${randomId(10)}`, type: "ping", createdAt: new Date().toISOString(), storeId: scope.storeId, data: { message: "Hello from ATLaS" } };
  const [row] = await db()
    .insert(webhookDeliveries)
    .values({ tenantId: scope.tenantId, endpointId: ep.id, eventType: "ping", endpoint: ep.url, payloadHash: sha256(JSON.stringify(payload)), payloadJson: payload, status: "pending" })
    .$returningId();
  await enqueue("webhook.deliver", { deliveryId: row.id }, { tenantId: scope.tenantId, maxAttempts: 1 });
  return { deliveryId: row.id };
}
export async function retryDelivery(scope: TenantScope, deliveryId: number) {
  requireWrite(scope, "developers.manage");
  const [d] = await db().select().from(webhookDeliveries).where(and(eq(webhookDeliveries.id, deliveryId), eq(webhookDeliveries.tenantId, scope.tenantId))).limit(1);
  if (!d || !["failed", "dead"].includes(d.status)) fail("INVALID_STATE", "Only failed deliveries can be retried");
  await db().update(webhookDeliveries).set({ status: "pending" }).where(eq(webhookDeliveries.id, d.id));
  await enqueue("webhook.deliver", { deliveryId: d.id }, { tenantId: scope.tenantId, maxAttempts: 3 });
}
export async function deliveriesByStatus(tenantId: number, statuses: ("pending" | "delivered" | "failed" | "dead")[]) {
  return db().select().from(webhookDeliveries).where(and(eq(webhookDeliveries.tenantId, tenantId), inArray(webhookDeliveries.status, statuses))).limit(100);
}
