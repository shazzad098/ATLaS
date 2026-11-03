import { clientIp, ok, rateLimit, route } from "@/lib/api";
import { applyCourierWebhook } from "@/lib/services/courier-service";

/**
 * Courier callback (FR-07).
 *
 * Like the payment webhook, this endpoint sits outside the cookie/CSRF world:
 * couriers POST directly. Authenticity comes from an HMAC signature header
 * (`x-atlas-signature`, secret = `COURIER_WEBHOOK_SECRET`) or a `?token=` on the
 * callback URL for providers that cannot set custom headers. The raw body is
 * read as text so the signature covers exactly what the courier sent.
 *
 * A well-formed request always returns 200, including rejected signatures and
 * unknown shipments, because the outcome is recorded in the response and a
 * non-2xx would only cause pointless retries.
 */

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type ProviderRouteContext = { params: Promise<{ provider: string }> };

export const POST = route(async (request: Request, context: ProviderRouteContext) => {
  const { provider } = await context.params;
  rateLimit(`courier-webhook:${provider}:${clientIp(request)}`, 600);

  const rawBody = await request.text();
  const outcome = await applyCourierWebhook(provider, request, rawBody);

  return ok(outcome);
});

/** Health probe so courier onboarding teams can verify the endpoint. */
export const GET = route(async (_request: Request, context: ProviderRouteContext) => {
  const { provider } = await context.params;
  return ok({ provider, ready: true });
});
