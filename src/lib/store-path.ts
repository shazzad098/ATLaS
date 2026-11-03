/**
 * Canonical storefront path builder.
 *
 * Kept dependency-free (no `next/headers`, no Prisma) so the theme section kit
 * and the admin live-preview can both use it from client components without
 * pulling server-only modules into the browser bundle.
 */

/**
 * Synthetic slug the proxy rewrites verified custom domains to. On those hosts
 * the storefront is served from the domain root, so links must not gain a
 * `/store/_host` prefix.
 */
export const HOST_SEGMENT = "_host";

/** Canonical, always-correct storefront href (works on subdomains and paths). */
export function storePath(slug: string, path = ""): string {
  const suffix = path && !path.startsWith("/") ? `/${path}` : path;

  if (slug === HOST_SEGMENT) {
    if (!suffix || suffix === "/") return "/";
    return suffix;
  }

  return `/store/${slug}${suffix === "/" ? "" : suffix}`;
}
