import { notFound } from "next/navigation";
import { getStorefrontContext, themeContextFrom } from "@/lib/storefront";
import { listStorefrontCategories, listStorefrontProducts } from "@/lib/storefront-data";
import { getTheme } from "@/themes";
import type { ThemeComponents } from "@/themes/types";
import type { ThemeConfig } from "@/lib/theme-catalog";

/**
 * Storefront homepage (PRD §7).
 *
 * Sections render in the order the merchant arranged them (`config.sections`),
 * so the three themes share one page composition while looking distinct.
 */

export default async function StorefrontHome({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const context = await getStorefrontContext(slug);
  if (!context) notFound();

  const theme = getTheme(context.theme.code);
  const ctx = themeContextFrom(context);

  const [{ products }, categories] = await Promise.all([
    listStorefrontProducts(context.store.id, { perPage: 8 }),
    listStorefrontCategories(context.store.id),
  ]);

  const configured = ctx.config.sections.filter((section) => section.enabled);
  const sections = configured.length
    ? configured
    : (["Hero", "CategoryGrid", "ProductGrid", "PromoBanner", "TrustBar"] as const).map((key) => ({
        key,
        enabled: true,
        title: "",
      }));

  return (
    <>
      {sections.map((section) => renderSection(section, theme, ctx, products, categories))}
    </>
  );
}

function renderSection(
  section: ThemeConfig["sections"][number],
  theme: ThemeComponents,
  ctx: ReturnType<typeof themeContextFrom>,
  products: Awaited<ReturnType<typeof listStorefrontProducts>>["products"],
  categories: Awaited<ReturnType<typeof listStorefrontCategories>>,
) {
  switch (section.key) {
    case "Header":
    case "Footer":
      // Rendered by the layout so they wrap every storefront page.
      return null;
    case "Hero":
      return <theme.Hero key="Hero" ctx={ctx} />;
    case "CategoryGrid":
      return (
        <theme.CategoryGrid key="CategoryGrid" ctx={ctx} title={section.title} categories={categories} />
      );
    case "ProductGrid":
      return (
        <theme.ProductGrid key="ProductGrid" ctx={ctx} title={section.title} products={products} columns={4} />
      );
    case "PromoBanner":
      return <theme.PromoBanner key="PromoBanner" ctx={ctx} />;
    case "Testimonials":
      return <theme.Testimonials key="Testimonials" ctx={ctx} />;
    case "TrustBar":
      return <theme.TrustBar key="TrustBar" ctx={ctx} />;
    default:
      return null;
  }
}
