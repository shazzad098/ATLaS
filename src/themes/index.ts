import * as kit from "@/themes/kit";
import type { SectionVariant, ThemeComponents } from "@/themes/types";

/**
 * Theme registry (PRD §7 / FR-06).
 *
 * Each catalog theme binds a `SectionVariant` into the shared section kit. When
 * a merchant has selected a theme whose UI has not been implemented yet (a plan
 * upgrade may unlock a future theme), the registry falls back to `nokshi` so a
 * published storefront never renders blank.
 */

export const THEME_VARIANTS: Record<string, SectionVariant> = {
  nokshi: "editorial",
  bazar: "dense",
  studio: "minimal",
};

const THEME_LABELS: Record<string, string> = {
  nokshi: "Nokshi",
  bazar: "Bazar",
  studio: "Studio",
};

function bind(code: string, variant: SectionVariant): ThemeComponents {
  return {
    code,
    name: THEME_LABELS[code] ?? code,
    variant,
    Header: (props) => kit.Header({ ...props, variant }),
    Hero: (props) => kit.Hero({ ...props, variant }),
    CategoryGrid: (props) => kit.CategoryGrid({ ...props, variant }),
    ProductGrid: (props) => kit.ProductGrid({ ...props, variant }),
    PromoBanner: (props) => kit.PromoBanner({ ...props, variant }),
    Testimonials: (props) => kit.Testimonials({ ...props, variant }),
    TrustBar: (props) => kit.TrustBar({ ...props, variant }),
    Footer: (props) => kit.Footer({ ...props, variant }),
    ProductCard: (props) => kit.ProductCard({ ...props, variant }),
  };
}

const REGISTRY: Record<string, ThemeComponents> = Object.fromEntries(
  Object.entries(THEME_VARIANTS).map(([code, variant]) => [code, bind(code, variant)]),
);

export const DEFAULT_THEME_CODE = "nokshi";

export function hasTheme(code: string): boolean {
  return code in REGISTRY;
}

export function getTheme(code: string | null | undefined): ThemeComponents {
  if (code && REGISTRY[code]) return REGISTRY[code];
  return REGISTRY[DEFAULT_THEME_CODE];
}
