import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Host → storefront routing (PRD §6 "subdomain routing", FR-07).
 *
 * A merchant's store is reachable three ways, and all three converge on the same
 * `/store/[slug]` route so there is exactly one rendering path:
 *
 *   nokshi-demo.atlas.example/shop   →  /store/nokshi-demo/shop
 *   nokshi-demo.localhost:3000/shop  →  /store/nokshi-demo/shop
 *   shop.example.com/shop            →  /store/_host/shop   (resolved by DB host lookup)
 *
 * Platform hosts (the apex, `www`, and anything reserved) are left untouched so
 * the marketing site, admin and API keep working from the main domain.
 */

const RESERVED_SUBDOMAINS = new Set([
  "www",
  "app",
  "admin",
  "api",
  "cdn",
  "assets",
  "static",
  "mail",
  "smtp",
  "ftp",
  "blog",
  "help",
  "support",
  "status",
  "docs",
  "dev",
  "staging",
  "test",
  "demo",
  "store",
  "stores",
  "shop",
  "account",
  "login",
  "signup",
  "logout",
  "super-admin",
  "system",
  "atlas",
]);

/** Paths the proxy must never touch. `/pay/` is a platform route reached from a storefront host. */
const BYPASS_PREFIXES = ["/api/", "/_next/", "/store/", "/pay/"];

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const host = request.nextUrl.hostname.toLowerCase();

  if (BYPASS_PREFIXES.some((prefix) => pathname.startsWith(prefix))) {
    return NextResponse.next();
  }

  const rootDomain = (process.env.APP_ROOT_DOMAIN ?? "atlas.example").toLowerCase();

  // Platform hosts serve the app shell untouched.
  if (
    host === rootDomain ||
    host === `www.${rootDomain}` ||
    host === "localhost" ||
    host === "127.0.0.1" ||
    host === "0.0.0.0" ||
    host.endsWith(".vercel.app")
  ) {
    return NextResponse.next();
  }

  let slug: string | null = null;
  if (host.endsWith(`.${rootDomain}`)) {
    slug = host.slice(0, -(rootDomain.length + 1));
  } else if (host.endsWith(".localhost")) {
    slug = host.slice(0, -".localhost".length);
  }

  // Reserved platform subdomains keep serving the app shell.
  if (slug && (RESERVED_SUBDOMAINS.has(slug) || slug.includes("."))) {
    return NextResponse.next();
  }

  const target = slug ? `/store/${slug}` : "/store/_host";
  const url = request.nextUrl.clone();
  url.pathname = `${target}${pathname === "/" ? "" : pathname}`;

  const headers = new Headers(request.headers);
  headers.set("x-atlas-host", host);
  headers.set("x-atlas-storefront", "1");

  return NextResponse.rewrite(url, { request: { headers } });
}

export const config = {
  matcher: [
    // Everything except Next internals, the API, and files with an extension.
    "/((?!api|_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|.*\\.[a-zA-Z0-9]+$).*)",
  ],
};
