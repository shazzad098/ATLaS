import { type NextRequest } from "next/server";
import { z } from "zod";
import { ValidationError } from "@/lib/errors";
import { assertCsrf } from "@/lib/auth/session";
import { ok, parseBody, rateLimitForTenant, route } from "@/lib/api";
import { assertApiAccess, loadEntitlementSnapshot } from "@/lib/entitlements";
import { assertPermission } from "@/lib/rbac";
import { assertStoreAccess, authorizeApiRequest } from "@/lib/tenant";
import {
  createApiKey,
  listApiKeys,
  revokeApiKey,
} from "@/lib/services/api-key-service";

/**
 * PRD §11.10 `GET/POST /stores/{storeId}/api-keys`.
 *
 * Keys are tenant-scoped, but the store id is still checked so an API caller
 * cannot mint credentials through a store it cannot see. The raw secret is
 * returned once and never stored.
 */

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type StoreRouteContext = { params: Promise<{ storeId: string }> };

const createSchema = z.object({
  name: z.string().trim().min(2).max(80),
  scopes: z.array(z.string()).min(1).max(30),
  expiresAt: z.coerce.date().nullable().optional(),
});

export const GET = route(async (request: NextRequest, context: StoreRouteContext) => {
  const { storeId } = await context.params;
  const { actor } = await authorizeApiRequest(request);
  assertPermission(actor, "settings:read");
  await assertStoreAccess(actor, storeId);
  const snapshot = await loadEntitlementSnapshot(actor.tenantId);
  assertApiAccess(snapshot, "FULL");
  await rateLimitForTenant(actor.tenantId, "api_keys:list");

  return ok(await listApiKeys(actor.tenantId));
});

export const POST = route(async (request: NextRequest, context: StoreRouteContext) => {
  const { storeId } = await context.params;
  assertCsrf(request);
  const { actor } = await authorizeApiRequest(request);
  await assertStoreAccess(actor, storeId);
  const snapshot = await loadEntitlementSnapshot(actor.tenantId);
  assertApiAccess(snapshot, "FULL");
  await rateLimitForTenant(actor.tenantId, "api_keys:create");

  const input = await parseBody(request, createSchema);
  const key = await createApiKey(actor, input);
  return ok(key, { status: 201 });
});

export const DELETE = route(async (request: NextRequest, context: StoreRouteContext) => {
  const { storeId } = await context.params;
  assertCsrf(request);
  const { actor } = await authorizeApiRequest(request);
  await assertStoreAccess(actor, storeId);
  const snapshot = await loadEntitlementSnapshot(actor.tenantId);
  assertApiAccess(snapshot, "FULL");
  await rateLimitForTenant(actor.tenantId, "api_keys:revoke");

  const keyId = request.nextUrl.searchParams.get("keyId");
  if (!keyId) throw new ValidationError("keyId query parameter প্রয়োজন।");
  await revokeApiKey(actor, keyId);
  return ok({ revoked: keyId });
});
