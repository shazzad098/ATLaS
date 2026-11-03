"use client";

import type { CSSProperties } from "react";
import type {
  SectionVariant,
  StorefrontCategory,
  StorefrontProduct,
  ThemeContext,
} from "@/themes/types";
import {
  CategoryGrid,
  Footer,
  Header,
  Hero,
  ProductGrid,
  PromoBanner,
  Testimonials,
  TrustBar,
} from "@/themes/kit";
import { DEFAULT_THEME_CODE, THEME_VARIANTS } from "@/themes";
import { themeStyle } from "@/themes/css";
import type { ThemeConfig } from "@/lib/theme-catalog";
import type { EditableThemeConfig } from "./theme-editor";

/**
 * Live storefront preview for the theme customizer (FR-06).
 *
 * Renders the same section kit the real storefront uses, bound to the current
 * theme variant and fed the merchant's *draft* config, so every edit in the
 * inspector is reflected immediately. Links are decorative here — the whole
 * canvas is `pointer-events: none` so a click never navigates away.
 */

export function ThemePreview({
  config,
  themeCode,
  storeName,
  slug,
  products,
  categories,
}: {
  config: EditableThemeConfig;
  themeCode: string;
  storeName: string;
  slug: string;
  products: StorefrontProduct[];
  categories: StorefrontCategory[];
}) {
  const variant: SectionVariant =
    THEME_VARIANTS[themeCode] ?? THEME_VARIANTS[DEFAULT_THEME_CODE];
  const themeConfig = config as unknown as ThemeConfig;

  const ctx: ThemeContext = {
    slug,
    storeName,
    tagline: null,
    config: themeConfig,
    navigation: themeConfig.navigation.length
      ? themeConfig.navigation
      : [
          { label: "হোম", href: "/" },
          { label: "দোকান", href: "/shop" },
        ],
    contact: { phone: "", email: "", whatsapp: "" },
    announcement: themeConfig.header.announcement,
  };

  const style = themeStyle(themeConfig) as CSSProperties;
  const sections = themeConfig.sections.filter((section) => section.enabled);
  const ordered = sections.length
    ? sections
    : (["Hero", "CategoryGrid", "ProductGrid", "PromoBanner", "TrustBar"] as const).map((key) => ({
        key,
        enabled: true,
        title: "",
      }));

  return (
    <div
      className="design-preview-surface store-surface pointer-events-none min-h-full w-full max-w-full select-none overflow-x-hidden break-words bg-white text-left"
      style={style}
    >
      <Header ctx={ctx} variant={variant} />
      {ordered.map((section) => renderSection(section, variant, ctx, products, categories))}
      <Footer ctx={ctx} variant={variant} />
    </div>
  );
}

function renderSection(
  section: { key: string; enabled: boolean; title: string },
  variant: SectionVariant,
  ctx: ThemeContext,
  products: StorefrontProduct[],
  categories: StorefrontCategory[],
) {
  switch (section.key) {
    case "Header":
    case "Footer":
      // Rendered above/below the canvas, mirroring the storefront layout.
      return null;
    case "Hero":
      return <Hero key="Hero" ctx={ctx} variant={variant} featured={products} />;
    case "CategoryGrid":
      return (
        <CategoryGrid key="CategoryGrid" ctx={ctx} variant={variant} title={section.title} categories={categories} />
      );
    case "ProductGrid":
      return (
        <ProductGrid key="ProductGrid" ctx={ctx} variant={variant} title={section.title} products={products} columns={4} />
      );
    case "PromoBanner":
      return <PromoBanner key="PromoBanner" ctx={ctx} variant={variant} />;
    case "Testimonials":
      return <Testimonials key="Testimonials" ctx={ctx} variant={variant} />;
    case "TrustBar":
      return <TrustBar key="TrustBar" ctx={ctx} variant={variant} />;
    default:
      return null;
  }
}
