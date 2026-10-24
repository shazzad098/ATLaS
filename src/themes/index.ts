import * as bazar from "@/themes/bazar";
import * as kit from "@/themes/kit";
import * as nokshi from "@/themes/nokshi";
import type { SectionVariant, ThemeComponents } from "@/themes/types";

/**
 * Theme registry (PRD §7 / FR-06).
 *
 * `studio` binds a `SectionVariant` into the shared section kit; `nokshi` and
 * `bazar` ship their own component sets because their storefront layouts are
 * structurally different (editorial boutique vs. dense grocery marketplace).
 * When a merchant selects a theme whose UI has not been implemented yet (a plan
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

const REGISTRY: Record<string, ThemeComponents> = {
  nokshi: {
    code: "nokshi",
    name: THEME_LABELS.nokshi,
    variant: "editorial",
    Header: nokshi.Header,
    Hero: nokshi.Hero,
    CategoryGrid: nokshi.CategoryGrid,
    ProductGrid: nokshi.ProductGrid,
    PromoBanner: nokshi.PromoBanner,
    Testimonials: nokshi.Testimonials,
    TrustBar: nokshi.TrustBar,
    Footer: nokshi.Footer,
    ProductCard: nokshi.ProductCard,
  },
  bazar: {
    code: "bazar",
    name: THEME_LABELS.bazar,
    variant: "dense",
    Header: bazar.Header,
    Hero: bazar.Hero,
    CategoryGrid: bazar.CategoryGrid,
    ProductGrid: bazar.ProductGrid,
    PromoBanner: bazar.PromoBanner,
    Testimonials: bazar.Testimonials,
    TrustBar: bazar.TrustBar,
    Footer: bazar.Footer,
    ProductCard: bazar.ProductCard,
  },
  studio: bind("studio", "minimal"),
};

export const DEFAULT_THEME_CODE = "nokshi";

export function hasTheme(code: string): boolean {
  return code in REGISTRY;
}

export function getTheme(code: string | null | undefined): ThemeComponents {
  if (code && REGISTRY[code]) return REGISTRY[code];
  return REGISTRY[DEFAULT_THEME_CODE];
}
