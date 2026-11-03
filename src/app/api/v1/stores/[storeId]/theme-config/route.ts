import { type NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { assertCsrf } from "@/lib/auth/session";
import { ok, parseBody, rateLimitForTenant, route } from "@/lib/api";
import { assertApiAccess, loadEntitlementSnapshot } from "@/lib/entitlements";
import { assertPermission } from "@/lib/rbac";
import { assertStoreAccess, authorizeApiRequest } from "@/lib/tenant";
import { NotFoundError } from "@/lib/errors";
import { saveThemeDraft } from "@/lib/services/theme-service";

/**
 * PRD §11.2 `PATCH /stores/{storeId}/theme-config`.
 *
 * Writes the draft only, so a theme edit never changes the live storefront until
 * the merchant publishes it. The config JSON is validated against the selected
 * theme's section contract inside `saveThemeDraft`.
 */

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type StoreRouteContext = { params: Promise<{ storeId: string }> };

const patchSchema = z.object({
  themeVersionId: z.string().optional(),
  config: z.record(z.string(), z.unknown()),
});

export const PATCH = route(async (request: NextRequest, context: StoreRouteContext) => {
  const { storeId } = await context.params;
  assertCsrf(request);
  const { actor } = await authorizeApiRequest(request);
  assertPermission(actor, "design:write");
  await assertStoreAccess(actor, storeId);
  const snapshot = await loadEntitlementSnapshot(actor.tenantId);
  assertApiAccess(snapshot);
  await rateLimitForTenant(actor.tenantId, "themes:config");

  const body = await parseBody(request, patchSchema);
  let themeVersionId = body.themeVersionId;
  if (!themeVersionId) {
    const selected = await prisma.storeTheme.findFirst({
      where: { storeId, isSelected: true },
      select: { themeVersionId: true },
    });
    if (!selected) throw new NotFoundError("Selected theme");
    themeVersionId = selected.themeVersionId;
  }

  const updated = await saveThemeDraft(actor, storeId, themeVersionId, body.config);
  return ok({ themeVersionId: updated.themeVersionId, draftConfig: updated.draftConfigJson });
});
