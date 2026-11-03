import { ok, rateLimitForTenant, route } from "@/lib/api";
import { ForbiddenError } from "@/lib/errors";
import { authenticateRequest, resolveApiActor } from "@/lib/tenant";
import { loadEntitlementSnapshot } from "@/lib/entitlements";
import { listStores } from "@/lib/services/store-service";
import { env } from "@/lib/env";
import { storePath } from "@/lib/storefront";

/**
 * Current identity + workspace (PRD §11 "Protected endpoint + tenant context").
 *
 * The caller may be authenticated with either the session cookie or a bearer
 * access token. Tenant context comes from `X-Tenant-Id`, then the tenant cookie,
 * then the user's first active membership — never from the payload.
 */

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export const GET = route(async (request: Request) => {
  const user = await authenticateRequest(request);

  let actor;
  try {
    actor = await resolveApiActor(request, user);
  } catch (error) {
    // A platform super admin has no merchant membership. The API still returns
    // a useful identity payload; tenant-scoped endpoints remain forbidden.
    if (user.isSuperAdmin && error instanceof ForbiddenError) {
      return ok({
        user: {
          id: user.id,
          phone: user.phone,
          email: user.email,
          name: user.name,
          isSuperAdmin: true,
        },
        superAdmin: true,
        tenant: null,
        plan: null,
        stores: [],
      });
    }
    throw error;
  }

  await rateLimitForTenant(actor.tenantId, "me:read");

  const [stores, entitlements] = await Promise.all([
    listStores(actor.tenantId),
    loadEntitlementSnapshot(actor.tenantId),
  ]);

  return ok({
    user: {
      id: user.id,
      phone: user.phone,
      email: user.email,
      name: user.name,
      isSuperAdmin: user.isSuperAdmin,
    },
    superAdmin: false,
    tenant: {
      id: actor.tenantId,
      role: actor.roleCode,
      permissions: actor.permissions,
    },
    plan: {
      code: entitlements.planCode,
      name: entitlements.planName,
      subscriptionStatus: entitlements.subscriptionStatus,
      currentPeriodStart: entitlements.currentPeriodStart,
      currentPeriodEnd: entitlements.currentPeriodEnd,
      readOnly: entitlements.readOnly,
      suspended: entitlements.suspended,
    },
    stores: stores.map((store) => ({
      id: store.id,
      name: store.name,
      slug: store.slug,
      status: store.status,
      publishedAt: store.publishedAt,
      host: store.domains[0]?.host ?? null,
      url: `${env.appUrl}${storePath(store.slug)}`,
      counts: store._count,
    })),
  });
});
