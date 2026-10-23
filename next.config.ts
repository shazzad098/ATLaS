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
};

export default nextConfig;
