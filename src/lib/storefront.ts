import { cache } from "react";
import { headers } from "next/headers";
import {
  loadStorefront,
  loadStorefrontByHost,
  type StorefrontContext,
} from "@/lib/services/store-service";
import type { ThemeContext } from "@/themes/types";

/**
 * Storefront request context.
 *
 * Every `/store/[slug]` page resolves its store through this helper rather than
 * trusting the URL segment, because the proxy rewrites custom domains to the
 * synthetic `_host` segment. React's `cache` keeps it to one query per request.
 */

export const HOST_SEGMENT = "_host";

export const getStorefrontContext = cache(
  async (slugSegment: string): Promise<StorefrontContext | null> => {
    if (slugSegment === HOST_SEGMENT) {
      const jar = await headers();
      const host = jar.get("x-atlas-host");
      if (!host) return null;
      return loadStorefrontByHost(host);
    }
    return loadStorefront(slugSegment);
  },
);

/** True when a store can be shown to shoppers (PRD FR-07 publish gate). */
export function storefrontAvailability(context: StorefrontContext): {
  visible: boolean;
  reason: "OK" | "DRAFT" | "SUSPENDED" | "TENANT_SUSPENDED";
} {
  if (context.tenant.status === "SUSPENDED" || context.tenant.status === "CANCELLED") {
    return { visible: false, reason: "TENANT_SUSPENDED" };
  }
  if (context.store.status === "SUSPENDED") return { visible: false, reason: "SUSPENDED" };
  if (context.store.status !== "PUBLISHED") return { visible: false, reason: "DRAFT" };
  return { visible: true, reason: "OK" };
}

/** Canonical, always-correct storefront href (works on subdomains and paths). */
export function storePath(slug: string, path = ""): string {
  // Merchant-entered links may point off-site; never prefix those.
  if (/^(?:https?:|mailto:|tel:)/i.test(path)) return path;
  const suffix = path && !path.startsWith("/") ? `/${path}` : path;
  return `/store/${slug}${suffix === "/" ? "" : suffix}`;
}

/**
 * Adapts the DB-backed storefront context into the theme-facing contract, so
 * section components never touch Prisma shapes.
 */
export function themeContextFrom(context: StorefrontContext): ThemeContext {
  const { config } = context.theme;
  const contact = context.settings.contact as {
    phone?: string;
    email?: string;
    whatsapp?: string;
  };

  return {
    slug: context.store.slug,
    storeName: context.store.name,
    tagline: context.store.description,
    config,
    navigation: config.navigation.length
      ? config.navigation
      : [
          { label: "হোম", href: "/" },
          { label: "দোকান", href: "/shop" },
        ],
    contact: {
      phone: String(contact.phone ?? ""),
      email: String(contact.email ?? ""),
      whatsapp: String(contact.whatsapp ?? ""),
    },
    announcement: config.header.announcement,
  };
}
