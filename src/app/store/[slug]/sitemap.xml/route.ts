import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import {
  getStorefrontContext,
  storefrontAvailability,
  storefrontUrl,
} from "@/lib/storefront";

/**
 * Per-store sitemap. Includes published product and content pages, and is only
 * emitted for a visible store. Canonical URLs use the tenant's own host so a
 * search engine never indexes the internal `/store/[slug]` path in production.
 */

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type RouteContext = { params: Promise<{ slug: string }> };

function xml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export async function GET(_request: Request, context: RouteContext) {
  const { slug } = await context.params;
  const store = await getStorefrontContext(slug);
  if (!store || !storefrontAvailability(store).visible) {
    return new NextResponse("Not found", { status: 404 });
  }

  const [products, pages] = await Promise.all([
    prisma.product.findMany({
      where: { storeId: store.store.id, status: "ACTIVE", deletedAt: null },
      select: { slug: true, updatedAt: true },
      orderBy: { updatedAt: "desc" },
      take: 5000,
    }),
    prisma.contentPage.findMany({
      where: { storeId: store.store.id, status: "ACTIVE" },
      select: { slug: true, updatedAt: true },
      orderBy: { updatedAt: "desc" },
      take: 1000,
    }),
  ]);

  // The starter theme links to these policy pages even before the merchant
  // creates a ContentPage row; the page route renders a built-in fallback.
  const defaultPageSlugs = ["returns", "contact", "delivery", "privacy", "terms"];
  const existingPageSlugs = new Set(pages.map((page) => page.slug));
  const fallbackPages = defaultPageSlugs
    .filter((slug) => !existingPageSlugs.has(slug))
    .map((slug) => ({ slug, updatedAt: new Date() }));

  const entries = [
    { url: storefrontUrl(store), lastModified: new Date(), priority: "1.0", changeFrequency: "daily" },
    { url: storefrontUrl(store, "/shop"), lastModified: new Date(), priority: "0.9", changeFrequency: "daily" },
    ...products.map((product) => ({
      url: storefrontUrl(store, `/product/${product.slug}`),
      lastModified: product.updatedAt,
      priority: "0.8",
      changeFrequency: "weekly",
    })),
    ...[...pages, ...fallbackPages].map((page) => ({
      url: storefrontUrl(store, `/page/${page.slug}`),
      lastModified: page.updatedAt,
      priority: "0.5",
      changeFrequency: "monthly",
    })),
  ];

  const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${entries
  .map(
    (entry) => `  <url>
    <loc>${xml(entry.url)}</loc>
    <lastmod>${entry.lastModified.toISOString()}</lastmod>
    <changefreq>${entry.changeFrequency}</changefreq>
    <priority>${entry.priority}</priority>
  </url>`,
  )
  .join("\n")}
</urlset>`;

  return new NextResponse(body, {
    headers: {
      "content-type": "application/xml; charset=utf-8",
      "cache-control": "public, s-maxage=3600, stale-while-revalidate=86400",
    },
  });
}
