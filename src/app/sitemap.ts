import type { MetadataRoute } from "next";
import { prisma } from "@/lib/db";
import { env } from "@/lib/env";

/**
 * Platform sitemap: marketing pages plus every published storefront.
 * Runs dynamically so a build never needs a live database, and a store that
 * goes live appears without a redeploy.
 */

export const dynamic = "force-dynamic";

const STATIC_PATHS = [
  "",
  "/pricing",
  "/themes",
  "/how-it-works",
  "/help",
  "/contact",
  "/about",
  "/developers",
  "/terms",
  "/privacy",
  "/refund-policy",
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = env.appUrl.replace(/\/$/, "");
  const now = new Date();

  let stores: Array<{ slug: string; updatedAt: Date }> = [];
  try {
    stores = await prisma.store.findMany({
      where: { status: "PUBLISHED", deletedAt: null },
      select: { slug: true, updatedAt: true },
      orderBy: { updatedAt: "desc" },
      take: 5000,
    });
  } catch {
    // A database outage must not take the marketing site's sitemap down.
  }

  return [
    ...STATIC_PATHS.map((path) => ({
      url: `${base}${path}`,
      lastModified: now,
      changeFrequency: path === "" ? ("daily" as const) : ("weekly" as const),
      priority: path === "" ? 1 : 0.7,
    })),
    ...stores.map((store) => ({
      url: `${base}/store/${store.slug}`,
      lastModified: store.updatedAt,
      changeFrequency: "daily" as const,
      priority: 0.8,
    })),
  ];
}
