import { z } from "zod";
import { assertCsrf } from "@/lib/auth/session";
import { getPaymentAdapter } from "@/lib/payments";
import { clientIp, ok, parseBody, rateLimit, route } from "@/lib/api";
import { assertPermission } from "@/lib/rbac";
import { assertStoreAccess, authenticateRequest, resolveApiActor } from "@/lib/tenant";
import { getStorePaymentCredentials as loadCredentials } from "@/lib/services/store-service";
import { togglePaymentMethod } from "@/lib/services/store-service";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type ProviderRouteContext = { params: Promise<{ storeId: string; provider: string }> };
const providerSchema = z.enum(["COD", "BKASH", "NAGAD", "SSLCOMMERZ"]);
const configSchema = z.object({
  isEnabled: z.boolean(),
  credentials: z.record(z.string(), z.string()).optional(),
});
const testSchema = z.object({ credentials: z.record(z.string(), z.string()).optional() });

async function context(request: Request, params: Promise<{ storeId: string; provider: string }>) {
  const { storeId, provider: rawProvider } = await params;
  const provider = providerSchema.parse(rawProvider.toUpperCase());
  const user = await authenticateRequest(request);
  const actor = await resolveApiActor(request, user);
  await assertStoreAccess(actor, storeId);
  return { actor, storeId, provider };
}

export const PUT = route(async (request: Request, routeContext: ProviderRouteContext) => {
  assertCsrf(request);
  const { actor, storeId, provider } = await context(request, routeContext.params);
  await rateLimit(`payments:configure:${actor.tenantId}`, 60);
  const input = await parseBody(request, configSchema);
  const method = await togglePaymentMethod(actor, storeId, provider, input);
  return ok({
    id: method.id,
    provider: method.provider,
    isEnabled: method.isEnabled,
    credentialsConfigured: Boolean(method.encryptedSecretRef),
  });
});

export const POST = route(async (request: Request, routeContext: ProviderRouteContext) => {
  assertCsrf(request);
  const { actor, storeId, provider } = await context(request, routeContext.params);
  assertPermission(actor, "payments:read");
  await rateLimit(`payments:test:${actor.tenantId}`, 30);
  const input = await parseBody(request, testSchema);
  const credentials = input.credentials ?? await loadCredentials(storeId, provider);
  const configured = getPaymentAdapter(provider).isConfigured(credentials);
  return ok({ provider, configured, sandbox: !configured, testedAt: new Date().toISOString(), ip: clientIp(request) });
});
