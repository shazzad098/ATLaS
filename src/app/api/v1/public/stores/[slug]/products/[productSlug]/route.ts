import { type NextRequest } from "next/server";
import { clientIp, ok, rateLimit, route } from "@/lib/api";
import { NotFoundError } from "@/lib/errors";
import { storefrontAvailability } from "@/lib/storefront";
import { loadStorefront } from "@/lib/services/store-service";
import { storefrontProduct } from "@/lib/services/catalog-service";

/** Public product detail (PRD §11.6), including related products. */

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type ProductRouteContext = { params: Promise<{ slug: string; productSlug: string }> };

export const GET = route(async (request: NextRequest, context: ProductRouteContext) => {
  const { slug, productSlug } = await context.params;
  rateLimit(`public:product:${clientIp(request)}`, 240);

  const store = await loadStorefront(slug);
  if (!store) throw new NotFoundError("Store");
  if (!storefrontAvailability(store).visible) throw new NotFoundError("Store");

  const result = await storefrontProduct(store.store.id, productSlug);
  if (!result) throw new NotFoundError("Product");

  return ok(result);
});
