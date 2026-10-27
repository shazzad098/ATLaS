import { cache } from "react";
import { headers } from "next/headers";
import {
  loadStorefront,
  loadStorefrontByHost,
  type StorefrontContext,
} from "@/lib/services/store-service";
import type { StorefrontCategory, ThemeContext } from "@/themes/types";

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
export function themeContextFrom(
  context: StorefrontContext,
  categories: StorefrontCategory[] = [],
): ThemeContext {
  const { config } = context.theme;
  const contact = context.settings.contact as {
    phone?: string;
    email?: string;
    whatsapp?: string;
  };
  const address = context.settings.address as {
    line1?: string;
    area?: string;
    city?: string;
    district?: string;
  };

  // Category links always come from the catalogue, never from hard-coded theme
  // defaults: a store with no categories must not show someone else's taxonomy.
  const baseLinks = config.navigation.filter((link) => !link.href.startsWith("/shop?category="));
  const navigation = baseLinks.length
    ? baseLinks
    : [
        { label: "হোম", href: "/" },
        { label: "দোকান", href: "/shop" },
      ];
  const categoryLinks = categories.map((category) => ({
    label: category.name,
    href: `/shop?category=${category.slug}`,
  }));
  const catalogHrefs = new Set(categoryLinks.map((link) => link.href));
  const navigationWithCategories = navigation.flatMap((link) =>
    link.href === "/shop" ? [link, ...categoryLinks] : [link],
  );
  // Stale configs may still contain category links for products that never
  // existed. Keep a footer link only when the category is in this catalogue.
  const footerColumns = config.footer.columns
    .map((column) => ({
      ...column,
      links: column.links.filter(
        (link) => !link.href.startsWith("/shop?category=") || catalogHrefs.has(link.href),
      ),
    }))
    .filter((column) => column.links.length > 0);

  return {
    slug: context.store.slug,
    storeName: context.store.name,
    tagline: context.store.description,
    config: { ...config, footer: { ...config.footer, columns: footerColumns } },
    navigation: navigationWithCategories,
    contact: {
      phone: String(contact.phone ?? ""),
      email: String(contact.email ?? ""),
      whatsapp: String(contact.whatsapp ?? ""),
    },
    address: {
      line1: String(address.line1 ?? ""),
      area: String(address.area ?? ""),
      city: String(address.city ?? ""),
      district: String(address.district ?? ""),
    },
    announcement: config.header.announcement,
  };
}
