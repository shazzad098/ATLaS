import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  return {
    rules: [
      { userAgent: "*", allow: ["/", "/store/"], disallow: ["/admin/", "/super-admin/", "/api/", "/account/", "/onboarding/"] },
    ],
    sitemap: `${base}/sitemap.xml`,
  };
}
