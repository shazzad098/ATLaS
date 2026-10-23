import { cookies } from "next/headers";
import { type NextRequest } from "next/server";
import {
  clientIp,
  ok,
  parseBody,
  rateLimit,
  requireIdempotencyKey,
  route,
} from "@/lib/api";
import { ValidationError } from "@/lib/errors";
import { CART_COOKIE } from "@/lib/services/cart-service";
import { checkoutInputSchema, placeOrder } from "@/lib/services/checkout-service";

/**
 * Headless checkout (PRD §11.6, FR-05).
 *
 * The cart is still the cookie-backed session cart, so a client must carry the
 * `atlas_cart` cookie from add-to-cart. `Idempotency-Key` is mandatory: the same
 * key can never create a second order (PRD §11 API rules).
 */

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type SlugRouteContext = { params: Promise<{ slug: string }> };

export const POST = route(async (request: NextRequest, context: SlugRouteContext) => {
  const { slug } = await context.params;
  await rateLimit(`checkout:${clientIp(request)}`, 30);

  const idempotencyKey = requireIdempotencyKey(request);
  const payload = await parseBody(request, checkoutInputSchema);

  const jar = await cookies();
  const sessionKey = jar.get(CART_COOKIE)?.value;
  if (!sessionKey) throw new ValidationError("কার্ট খালি। আগে পণ্য যোগ করুন।");

  const result = await placeOrder({
    storeSlug: slug,
    sessionKey,
    payload,
    idempotencyKey,
    baseUrl: new URL(request.url).origin,
  });

  return ok(result, { status: 201 });
});
