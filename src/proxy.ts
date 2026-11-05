import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { jwtVerify } from "jose";
import { checkRateLimit, type RateLimitResult } from "@/lib/rate-limit";

/**
 * Host routing + trusted RLS context (PRD §6, FR-07).
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
 *
 * The proxy also verifies the session token and forwards a trusted
 * `x-atlas-rls` header. `src/lib/db.ts` uses it to pick a database pool whose
 * Postgres session variables drive Row-Level Security. Any client-supplied
 * copy of that header is stripped first, so a request cannot choose its own
 * tenant context.
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

/** Paths the proxy must never rewrite. `/pay/` is a platform route reached from a storefront host. */
const BYPASS_PREFIXES = ["/api/", "/_next/", "/store/", "/pay/"];

/** Paths where a merchant/super-admin session (not a buyer session) is authoritative. */
const MERCHANT_PREFIXES = ["/admin", "/super-admin", "/api/", "/account", "/onboarding"];

const ACCESS_COOKIE = "atlas_at";
const BUYER_COOKIE = "atlas_buyer";
const CART_COOKIE = "atlas_cart"; // keep in sync with cart-service

/**
 * Global IP gates (PRD §13). Per-action limits still run inside the server
 * actions; these stop a single source from hammering the edge at all.
 *
 *  - Auth mutations (login/signup/OTP/password reset): 30 POSTs / 10 minutes.
 *    Server actions POST back to the page URL, so the path is stable.
 *  - API routes: 120 requests / minute for GET and POST alike.
 */
const AUTH_PATHS = new Set(["/login", "/login/2fa", "/signup", "/forgot-password"]);
const AUTH_LIMIT = 30;
const AUTH_WINDOW_MS = 10 * 60_000;
const API_LIMIT = 120;
const API_WINDOW_MS = 60_000;

function requestIp(request: NextRequest): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return request.headers.get("x-real-ip") ?? "unknown";
}

function rateLimited(result: RateLimitResult, isApi: boolean): NextResponse {
  const headers = new Headers({
    "retry-after": String(result.retryAfterSeconds),
    "x-ratelimit-limit": String(result.limit),
    "cache-control": "no-store",
  });
  if (isApi) {
    headers.set("content-type", "application/json; charset=utf-8");
    return new NextResponse(
      JSON.stringify({
        ok: false,
        error: { code: "RATE_LIMITED", message: "খুব বেশি request পাঠানো হয়েছে। আবার চেষ্টা করুন।" },
      }),
      { status: 429, headers },
    );
  }
  headers.set("content-type", "text/plain; charset=utf-8");
  return new NextResponse("খুব বেশি চেষ্টা হয়েছে। কিছুক্ষণ পরে আবার চেষ্টা করুন।", {
    status: 429,
    headers,
  });
}

type TokenClaims = { sub?: string; sa?: boolean; storeId?: string };

function secretKey(): Uint8Array {
  return new TextEncoder().encode(process.env.AUTH_SECRET ?? "");
}

async function verifyToken(token: string, audience: "atlas-app" | "atlas-buyer") {
  try {
    const { payload } = await jwtVerify(token, secretKey(), {
      issuer: "atlas",
      audience,
    });
    return payload as TokenClaims;
  } catch {
    return null;
  }
}

/**
 * Choose the database context for this request.
 *
 * Merchant/admin routes use the access token (or bearer token). Storefront and
 * marketing routes use a buyer session when present, otherwise the public
 * context. Public requests are unauthenticated by definition and the database
 * grants them a bypass pool; authenticated requests are always restricted.
 */
async function resolveRlsContext(request: NextRequest, isMerchantPath: boolean): Promise<string> {
  if (isMerchantPath) {
    const bearer = request.headers.get("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1];
    const accessToken = request.cookies.get(ACCESS_COOKIE)?.value ?? bearer;
    if (accessToken) {
      const claims = await verifyToken(accessToken, "atlas-app");
      if (claims) {
        if (claims.sa === true) return "platform";
        if (typeof claims.sub === "string") return `user:${claims.sub}`;
      }
    }
    return "public";
  }

  const buyerToken = request.cookies.get(BUYER_COOKIE)?.value;
  if (buyerToken) {
    const claims = await verifyToken(buyerToken, "atlas-buyer");
    if (
      claims &&
      typeof claims.sub === "string" &&
      typeof claims.storeId === "string" &&
      claims.storeId.length <= 80 &&
      claims.sub.length <= 80
    ) {
      const cartKey = request.cookies.get(CART_COOKIE)?.value ?? "";
      return `buyer:${claims.storeId}:${claims.sub}:${cartKey.slice(0, 80)}`;
    }
  }

  return "public";
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Edge-level IP throttling before any routing work (PRD §13).
  const ip = requestIp(request);
  if (request.method === "POST" && AUTH_PATHS.has(pathname)) {
    const authLimit = checkRateLimit(`auth:${ip}`, AUTH_LIMIT, AUTH_WINDOW_MS);
    if (!authLimit.ok) return rateLimited(authLimit, false);
  }
  if (pathname.startsWith("/api/")) {
    const apiLimit = checkRateLimit(`api:${ip}`, API_LIMIT, API_WINDOW_MS);
    if (!apiLimit.ok) return rateLimited(apiLimit, true);
  }

  const isPublicApi = pathname.startsWith("/api/v1/public/");
  const isMerchantPath =
    !isPublicApi && MERCHANT_PREFIXES.some((prefix) => pathname.startsWith(prefix));
  const rlsContext = await resolveRlsContext(request, isMerchantPath);

  // `nextUrl.hostname` can be normalised to the dev server's own host; the
  // forwarded/Host header is the merchant-facing hostname we must route on.
  const rawHost =
    request.headers.get("x-forwarded-host") ??
    request.headers.get("host") ??
    request.nextUrl.hostname;
  const host = rawHost.split(",")[0].trim().toLowerCase().replace(/:\d+$/, "");

  const forwardedHeaders = new Headers(request.headers);
  // Never trust an incoming context header: it is derived from the verified token.
  forwardedHeaders.delete("x-atlas-rls");
  forwardedHeaders.set("x-atlas-rls", rlsContext);

  const next = () => NextResponse.next({ request: { headers: forwardedHeaders } });

  if (BYPASS_PREFIXES.some((prefix) => pathname.startsWith(prefix))) {
    return next();
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
    return next();
  }

  let slug: string | null = null;
  if (host.endsWith(`.${rootDomain}`)) {
    slug = host.slice(0, -(rootDomain.length + 1));
  } else if (host.endsWith(".localhost")) {
    slug = host.slice(0, -".localhost".length);
  }

  // Reserved platform subdomains keep serving the app shell.
  if (slug && (RESERVED_SUBDOMAINS.has(slug) || slug.includes("."))) {
    return next();
  }

  const target = slug ? `/store/${slug}` : "/store/_host";
  const url = request.nextUrl.clone();
  url.pathname = `${target}${pathname === "/" ? "" : pathname}`;

  forwardedHeaders.set("x-atlas-host", host);
  forwardedHeaders.set("x-atlas-storefront", "1");

  return NextResponse.rewrite(url, { request: { headers: forwardedHeaders } });
}

export const config = {
  matcher: [
    // Everything except Next internals and static files. API routes are
    // included so bearer/cookie sessions can set the RLS context too.
    "/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|.*\\.[a-zA-Z0-9]+$).*)",
  ],
};
