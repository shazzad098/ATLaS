import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Cache Components are intentionally OFF. Every page in ATLaS reads
  // tenant-scoped data from PostgreSQL on the request path, so the PPR /
  // `use cache` model would force Suspense boundaries everywhere for no gain.
  // The MVP stays a conventional SSR app; caching is applied per-query later.

  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },

  // `pg` is a native driver: keep it out of the bundler.
  serverExternalPackages: ["pg", "@prisma/client"],

  images: {
    // Merchant product images come from object storage on arbitrary hosts.
    remotePatterns: [{ protocol: "https", hostname: "**" }],
  },

  // The platform is served from an apex domain and rewrites merchant subdomains
  // in `src/proxy.ts`, so host normalisation must not interfere.
  skipProxyUrlNormalize: false,
  poweredByHeader: false,

  // The dev server is previewed from 127.0.0.1 as well as localhost; without this
  // Next blocks its own HMR/dev resources as cross-origin.
  allowedDevOrigins: ["127.0.0.1", "localhost"],

  /**
   * Baseline security headers for every HTML/asset response. HSTS is production
   * only so a local http:// session never gets pinned to https for six months.
   * API JSON responses add the same set in `src/lib/api.ts`.
   */
  async headers() {
    const values = [
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "X-Frame-Options", value: "SAMEORIGIN" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
      { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
    ];

    if (process.env.NODE_ENV === "production") {
      values.push({
        key: "Strict-Transport-Security",
        value: "max-age=63072000; includeSubDomains",
      });
    }

    return [{ source: "/(.*)", headers: values }];
  },
};

export default nextConfig;
