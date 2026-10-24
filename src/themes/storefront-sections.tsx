import type {
  StorefrontCategory,
  StorefrontProduct,
  ThemeComponents,
  ThemeContext,
} from "@/themes/types";
import type { ThemeConfig } from "@/lib/theme-catalog";

/**
 * Homepage section composition.
 *
 * The live storefront and the merchant's draft preview render the exact same
 * list, in the order the merchant arranged in Admin → ডিজাইন. Keeping this in
 * one place means a preview can never drift from what shoppers see.
 */

const DEFAULT_SECTIONS: ThemeConfig["sections"] = [
  { key: "Hero", enabled: true, title: "" },
  { key: "CategoryGrid", enabled: true, title: "" },
  { key: "ProductGrid", enabled: true, title: "" },
  { key: "PromoBanner", enabled: true, title: "" },
  { key: "TrustBar", enabled: true, title: "" },
];

export function StorefrontSections({
  theme,
  ctx,
  products,
  categories,
  sections,
}: {
  theme: ThemeComponents;
  ctx: ThemeContext;
  products: StorefrontProduct[];
  categories: StorefrontCategory[];
  sections?: ThemeConfig["sections"];
}) {
  const list = sections && sections.length ? sections : DEFAULT_SECTIONS;

  return (
    <>
      {list.map((section) => {
        switch (section.key) {
          case "Header":
          case "Footer":
            // Rendered by the storefront layout so they wrap every page.
            return null;
          case "Hero":
            return <theme.Hero key="Hero" ctx={ctx} title={section.title} products={products} />;
          case "CategoryGrid":
            return (
              <theme.CategoryGrid
                key="CategoryGrid"
                ctx={ctx}
                title={section.title}
                categories={categories}
                products={products}
              />
            );
          case "ProductGrid":
            return (
              <theme.ProductGrid
                key="ProductGrid"
                ctx={ctx}
                title={section.title}
                products={products}
                categories={categories}
                columns={4}
              />
            );
          case "PromoBanner":
            return <theme.PromoBanner key="PromoBanner" ctx={ctx} title={section.title} products={products} />;
          case "Testimonials":
            return (
              <theme.Testimonials key="Testimonials" ctx={ctx} title={section.title} products={products} />
            );
          case "TrustBar":
            return <theme.TrustBar key="TrustBar" ctx={ctx} title={section.title} products={products} />;
          default:
            return null;
        }
      })}
    </>
  );
}
