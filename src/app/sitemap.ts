import type { MetadataRoute } from "next";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const [stores, products, pages] = await Promise.all([
    prisma.store.findMany({
      where: { status: "PUBLISHED", deletedAt: null },
      select: { slug: true, updatedAt: true },
      take: 50_000,
    }),
    prisma.product.findMany({
      where: { status: "ACTIVE", deletedAt: null, store: { status: "PUBLISHED", deletedAt: null } },
      select: { slug: true, updatedAt: true, store: { select: { slug: true } } },
      take: 100_000,
    }),
    prisma.contentPage.findMany({
      where: { status: "ACTIVE", store: { status: "PUBLISHED", deletedAt: null } },
      select: { slug: true, updatedAt: true, store: { select: { slug: true } } },
      take: 100_000,
    }),
  ]);
  const urls: MetadataRoute.Sitemap = [];
  for (const store of stores) {
    urls.push(
      { url: `${base}/store/${store.slug}`, lastModified: store.updatedAt, changeFrequency: "daily", priority: 0.9 },
      { url: `${base}/store/${store.slug}/shop`, lastModified: store.updatedAt, changeFrequency: "daily", priority: 0.8 },
    );
  }
  urls.push(
    ...products.map((product) => ({
      url: `${base}/store/${product.store.slug}/product/${product.slug}`,
      lastModified: product.updatedAt,
      changeFrequency: "daily" as const,
      priority: 0.7,
    })),
    ...pages.map((page) => ({
      url: `${base}/store/${page.store.slug}/page/${page.slug}`,
      lastModified: page.updatedAt,
      changeFrequency: "monthly" as const,
      priority: 0.5,
    })),
  );
  return urls;
}
