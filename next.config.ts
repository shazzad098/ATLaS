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
   * Baseline security headers (PRD §7 "Security", §13).
   *
   * The CSP intentionally allows `'unsafe-inline'` scripts because Next.js
   * boots the App Router with inline flight/hydration data; a nonce pipeline is
   * the follow-up. It still pins every origin, forbids frames/objects, and
   * blocks inline event-handler attributes.
   */
  async headers() {
    const isDev = process.env.NODE_ENV !== "production";
    const csp = [
      "default-src 'self'",
      `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
      "script-src-attr 'none'",
      "style-src 'self' 'unsafe-inline'",
      // Dev-only: a local MinIO/S3 endpoint (or an image pasted from an http
      // URL) must load while developing; production stays https-only.
      `img-src 'self' data: blob: https:${isDev ? " http:" : ""}`,
      "font-src 'self' data:",
      "connect-src 'self' https:",
      "media-src 'self' https:",
      "worker-src 'self' blob:",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "frame-ancestors 'none'",
      ...(isDev ? [] : ["upgrade-insecure-requests"]),
    ].join("; ");

    const headers = [
      { key: "Content-Security-Policy", value: csp },
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "X-Frame-Options", value: "DENY" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      {
        key: "Permissions-Policy",
        value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
      },
      { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
      { key: "X-DNS-Prefetch-Control", value: "off" },
    ];

    if (!isDev) {
      headers.push({
        key: "Strict-Transport-Security",
        value: "max-age=63072000; includeSubDomains; preload",
      });
    }

    return [{ source: "/:path*", headers }];
  },
};

export default nextConfig;
