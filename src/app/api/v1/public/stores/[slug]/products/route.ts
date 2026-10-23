import { type NextRequest } from "next/server";
import { z } from "zod";
import { clientIp, ok, rateLimit, route } from "@/lib/api";
import { NotFoundError } from "@/lib/errors";
import { storefrontAvailability } from "@/lib/storefront";
import { loadStorefront } from "@/lib/services/store-service";
import { storefrontProducts } from "@/lib/services/catalog-service";

/**
 * Public storefront catalog (PRD §11.6). Only ACTIVE products from a PUBLISHED
 * store are ever returned; the paging contract is page/perPage here because a
 * storefront SEO page number is more useful to a client than an opaque cursor.
 */

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type SlugRouteContext = { params: Promise<{ slug: string }> };

const querySchema = z.object({
  q: z.string().max(120).optional(),
  category: z.string().max(80).optional(),
  sort: z.enum(["newest", "price-asc", "price-desc", "name"]).optional(),
  page: z.coerce.number().int().min(1).max(1000).optional(),
  perPage: z.coerce.number().int().min(1).max(48).optional(),
});

export const GET = route(async (request: NextRequest, context: SlugRouteContext) => {
  const { slug } = await context.params;
  await rateLimit(`public:products:${clientIp(request)}`, 240);

  const store = await loadStorefront(slug);
  if (!store) throw new NotFoundError("Store");
  if (!storefrontAvailability(store).visible) throw new NotFoundError("Store");

  const query = querySchema.parse(Object.fromEntries(request.nextUrl.searchParams));

  const result = await storefrontProducts(store.store.id, {
    q: query.q,
    categorySlug: query.category,
    sort: query.sort,
    page: query.page,
    perPage: query.perPage,
  });

  return ok(result.items, {
    meta: {
      total: result.total,
      hasMore: result.page < result.pageCount,
      nextCursor: result.page < result.pageCount ? String(result.page + 1) : null,
    },
  });
});
