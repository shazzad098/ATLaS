import { type NextRequest } from "next/server";
import { ok, parsePagination, rateLimitForTenant, route } from "@/lib/api";
import { assertPermission } from "@/lib/rbac";
import { authorizeApiRequest } from "@/lib/tenant";
import { listInvoices } from "@/lib/services/billing-service";

/** Tenant invoices (PRD §11.5). Scoped by the actor's tenant, never a query id. */

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export const GET = route(async (request: NextRequest) => {
  const { actor } = await authorizeApiRequest(request);
  assertPermission(actor, "billing:read");
  await rateLimitForTenant(actor.tenantId, "billing:invoices");

  const { limit } = parsePagination(request.nextUrl.searchParams);
  return ok(await listInvoices(actor.tenantId, Math.min(limit * 2, 100)));
});
