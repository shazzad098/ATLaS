import { notFound } from "next/navigation";
import { getStorefrontContext, themeContextFrom } from "@/lib/storefront";
import { listStorefrontCategories, listStorefrontProducts } from "@/lib/storefront-data";
import { getTheme } from "@/themes";
import { StorefrontSections } from "@/themes/storefront-sections";

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

  return (
    <StorefrontSections
      theme={theme}
      ctx={ctx}
      products={products}
      categories={categories}
      sections={ctx.config.sections.filter((section) => section.enabled)}
    />
  );
}
