import type { MetadataRoute } from "next";
import { env } from "@/lib/env";

/**
 * Platform-level robots.txt. Per-store storefronts have their own
 * `/store/[slug]/robots.txt` (or the custom domain root) so they can point
 * crawlers at their own sitemap.
 */
export default function robots(): MetadataRoute.Robots {
  const base = env.appUrl.replace(/\/$/, "");

  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/admin",
          "/super-admin",
          "/account",
          "/onboarding",
          "/api/",
          "/pay/",
          "/store/*/cart",
          "/store/*/checkout",
          "/store/*/order/",
        ],
      },
    ],
    sitemap: `${base}/sitemap.xml`,
    host: base,
  };
}
