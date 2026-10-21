import { clientIp, ok, rateLimit, route } from "@/lib/api";
import { handlePaymentWebhook } from "@/lib/services/payment-service";

/**
 * Payment gateway callback (PRD §11.12, FR-05).
 *
 * Deliberately outside the cookie/CSRF world: gateways POST here directly, so
 * authenticity comes from the adapter's signature check and the idempotency
 * unique index on `(provider, eventKey)`. The raw body is read as text *before*
 * parsing so the signature is computed over exactly what the gateway sent.
 *
 * The response is always 200 for a well-formed request — including rejected
 * signatures and unknown orders — because that outcome is already recorded in
 * `payment_webhook_events` for the Super Admin health console, and a non-2xx
 * would only make the gateway retry a payload we have already stored.
 */

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type ProviderRouteContext = { params: Promise<{ provider: string }> };

export const POST = route(async (request: Request, context: ProviderRouteContext) => {
  const { provider } = await context.params;
  rateLimit(`webhook:${provider}:${clientIp(request)}`, 600);

  const rawBody = await request.text();
  const outcome = await handlePaymentWebhook(provider, request, rawBody);

  return ok(outcome);
});

/** Some gateways probe the endpoint with GET before enabling it. */
export const GET = route(async (_request: Request, context: ProviderRouteContext) => {
  const { provider } = await context.params;
  return ok({ provider, ready: true });
});
