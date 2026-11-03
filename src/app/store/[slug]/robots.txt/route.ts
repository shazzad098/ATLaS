import { NextResponse } from "next/server";
import {
  getStorefrontContext,
  storefrontAvailability,
  storefrontUrl,
} from "@/lib/storefront";

/**
 * Per-store robots.txt. A draft or suspended store disallows everything; a
 * published store points crawlers at its own sitemap and keeps transactional
 * pages (cart/checkout/order lookup) out of the index.
 */

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type RouteContext = { params: Promise<{ slug: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const { slug } = await context.params;
  const store = await getStorefrontContext(slug);
  const visible = store ? storefrontAvailability(store).visible : false;

  const lines = visible && store
    ? [
        "User-agent: *",
        "Allow: /",
        "Disallow: /cart",
        "Disallow: /checkout",
        "Disallow: /order/",
        "",
        `Sitemap: ${storefrontUrl(store, "/sitemap.xml")}`,
      ]
    : ["User-agent: *", "Disallow: /"];

  return new NextResponse(`${lines.join("\n")}\n`, {
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "cache-control": "public, s-maxage=3600",
    },
  });
}
