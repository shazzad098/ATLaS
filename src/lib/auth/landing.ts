import { prisma } from "@/lib/db";

/**
 * Post-auth landing resolution.
 *
 * Every "open the dashboard" entry point funnels through here so the merchant
 * always takes the same path: authenticate → (no store? onboarding) → admin.
 * `next` comes from the query string, so it is treated as untrusted input and
 * only ever resolved to a local path.
 */

export const DEFAULT_MERCHANT_LANDING = "/admin";

const AUTH_PATHS = ["/login", "/signup", "/forgot-password"];

/** True when `path` is a same-origin, absolute path we are willing to follow. */
export function isSafeInternalPath(path: string): boolean {
  if (!path.startsWith("/")) return false;
  if (path.startsWith("//")) return false;
  if (path.includes("\\") || path.includes("://")) return false;
  // Control characters, whitespace-only tricks and protocol-relative payloads.
  if (/[\u0000-\u001f\u007f]/.test(path)) return false;
  return true;
}

/**
 * Clamp a `next` value to a safe merchant path. Auth screens are excluded so a
 * signed-in merchant cannot be bounced back into the login form.
 */
export function safeNextPath(
  raw: string | null | undefined,
  fallback: string = DEFAULT_MERCHANT_LANDING,
): string {
  const value = raw?.trim();
  if (!value || !isSafeInternalPath(value)) return fallback;

  const pathname = value.split("?")[0] ?? value;
  if (AUTH_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`))) {
    return fallback;
  }
  return value;
}

export function onboardingPath(next?: string | null): string {
  return `/onboarding?next=${encodeURIComponent(safeNextPath(next))}`;
}

/**
 * Where a session should land after sign-in. Super admins go to the platform
 * console; merchants with a store go to the dashboard (or their requested
 * merchant page); merchants still setting up go to onboarding.
 */
export async function resolveLandingPath(
  userId: string,
  isSuperAdmin: boolean,
  next?: string | null,
): Promise<string> {
  if (isSuperAdmin) return "/super-admin";

  const store = await prisma.store.findFirst({
    where: {
      tenant: { memberships: { some: { userId, status: "ACTIVE" } } },
      deletedAt: null,
    },
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });

  return store ? safeNextPath(next) : onboardingPath(next);
}
