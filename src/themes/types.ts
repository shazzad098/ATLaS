import type { ComponentType } from "react";
import type { ThemeConfig } from "@/lib/theme-catalog";

/**
 * Theme contract (PRD §7, FR-06).
 *
 * Every theme exposes the same eight sections plus a product card, so business
 * data flows identically while the visual design differs. `ThemeConfig` is what
 * the merchant edits; these props are what the section kit renders.
 */

export type SectionVariant = "editorial" | "dense" | "minimal";

export type StorefrontProduct = {
  id: string;
  name: string;
  slug: string;
  priceFrom: number;
  comparePriceFrom: number | null;
  imageUrl: string | null;
  inStock: boolean;
  categoryName: string | null;
};

export type StorefrontCategory = {
  id: string;
  name: string;
  slug: string;
  productCount: number;
};

export type NavLink = { label: string; href: string };

export type ThemeContext = {
  slug: string;
  storeName: string;
  tagline: string | null;
  config: ThemeConfig;
  navigation: NavLink[];
  contact: {
    phone: string;
    email: string;
    whatsapp: string;
  };
  announcement: string;
};

export type SectionProps = { ctx: ThemeContext };

export type ProductGridProps = SectionProps & {
  title: string;
  products: StorefrontProduct[];
  columns?: 3 | 4;
};

export type CategoryGridProps = SectionProps & {
  title: string;
  categories: StorefrontCategory[];
};

export type ProductCardProps = { ctx: ThemeContext; product: StorefrontProduct };

export type ThemeComponents = {
  code: string;
  name: string;
  variant: SectionVariant;
  Header: ComponentType<SectionProps>;
  Hero: ComponentType<SectionProps>;
  CategoryGrid: ComponentType<CategoryGridProps>;
  ProductGrid: ComponentType<ProductGridProps>;
  PromoBanner: ComponentType<SectionProps>;
  Testimonials: ComponentType<SectionProps>;
  TrustBar: ComponentType<SectionProps>;
  Footer: ComponentType<SectionProps>;
  ProductCard: ComponentType<ProductCardProps>;
};
