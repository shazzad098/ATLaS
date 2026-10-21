import { type NextRequest } from "next/server";
import { z } from "zod";
import { assertCsrf } from "@/lib/auth/session";
import { ok, parseBody, rateLimit, route } from "@/lib/api";
import { assertPermission } from "@/lib/rbac";
import { assertStoreAccess, authenticateRequest, resolveApiActor } from "@/lib/tenant";
import { getStoreThemeState, listThemeOptions, selectTheme } from "@/lib/services/theme-service";

/**
 * Store themes (FR-06, PRD §11.2 "stores & themes").
 *
 * `GET` returns the catalog annotated with plan access and the current
 * selection; `POST` changes the selected theme. Both rules that matter —
 * per-plan allow-list and the Basic/Free switching lock — are enforced inside
 * `theme-service`, so a client cannot bypass them by calling the API directly.
 */

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type StoreRouteContext = { params: Promise<{ storeId: string }> };

const selectSchema = z.object({
  themeCode: z.string().trim().min(2).max(40),
});

export const GET = route(async (request: NextRequest, context: StoreRouteContext) => {
  const { storeId } = await context.params;

  const user = await authenticateRequest(request);
  const actor = await resolveApiActor(request, user);
  assertPermission(actor, "design:read");
  await assertStoreAccess(actor, storeId);
  rateLimit(`themes:read:${actor.tenantId}`, 120);

  const [options, state] = await Promise.all([
    listThemeOptions(storeId, actor.tenantId),
    getStoreThemeState(storeId, actor.tenantId),
  ]);

  return ok({
    selected: state.themeCode,
    canSwitch: state.canSwitch,
    switchBlockedReason: state.switchBlockedReason,
    isPublished: state.isPublished,
    themes: options,
  });
});

export const POST = route(async (request: NextRequest, context: StoreRouteContext) => {
  const { storeId } = await context.params;

  assertCsrf(request);
  const user = await authenticateRequest(request);
  const actor = await resolveApiActor(request, user);
  rateLimit(`themes:select:${actor.tenantId}`, 30);

  const { themeCode } = await parseBody(request, selectSchema);
  const result = await selectTheme(actor, storeId, themeCode);

  return ok(result);
});
