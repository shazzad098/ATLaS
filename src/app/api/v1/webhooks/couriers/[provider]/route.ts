import { clientIp, ok, rateLimit, route } from "@/lib/api";
import { handleCourierWebhook } from "@/lib/services/courier-service";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type ProviderRouteContext = { params: Promise<{ provider: string }> };

export const POST = route(async (request: Request, context: ProviderRouteContext) => {
  const { provider } = await context.params;
  await rateLimit(`webhook:courier:${provider}:${clientIp(request)}`, 600);
  const rawBody = await request.text();
  const outcome = await handleCourierWebhook(provider, request, rawBody);
  return ok(outcome, { status: outcome.status === "REJECTED_SIGNATURE" ? 401 : 200 });
});

export const GET = route(async (request: Request, context: ProviderRouteContext) => {
  const { provider } = await context.params;
  const url = new URL(request.url);
  const storeId = url.searchParams.get("storeId") || url.searchParams.get("store");
  let ready = Boolean(process.env.COURIER_WEBHOOK_SECRET);
  if (!ready && storeId) {
    const { getStoreCourierSecrets } = await import("@/lib/services/courier-service");
    const secrets = await getStoreCourierSecrets(storeId);
    ready = Boolean(secrets.webhookSecret || secrets.isEnabled);
  }
  return ok({ provider, ready: ready || provider === "sandbox" });
});
