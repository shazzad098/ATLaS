import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getStorefrontContext, storefrontAvailability, themeContextFrom } from "@/lib/storefront";
import { listStorefrontCategories } from "@/lib/storefront-data";
import { getTheme } from "@/themes";
import { themeStyle } from "@/themes/css";
import { AutoRefresh } from "@/components/auto-refresh";

/**
 * Storefront shell (PRD §3.3, FR-07).
 *
 * Resolves the store from the URL segment, applies the merchant's theme tokens,
 * and renders the theme Header/Footer around every child page. A store that is
 * not published yet gets a plain "under construction" notice instead of a 404,
 * so merchants can share a preview link while building.
 */

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const context = await getStorefrontContext(slug);
  if (!context) return { title: "দোকান পাওয়া যায়নি" };

  const seo = context.settings.seo as { title?: string; description?: string };
  return {
    title: seo.title ?? context.store.name,
    description: seo.description ?? context.store.description ?? undefined,
    robots: context.store.status === "PUBLISHED" ? undefined : { index: false, follow: false },
  };
}

export default async function StorefrontLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const context = await getStorefrontContext(slug);
  if (!context) notFound();

  const availability = storefrontAvailability(context);
  const theme = getTheme(context.theme.code);

  if (!availability.visible) {
    const message =
      availability.reason === "DRAFT"
        ? "এই দোকানটি এখনো তৈরি হচ্ছে।"
        : availability.reason === "TENANT_SUSPENDED"
          ? "এই অ্যাকাউন্টটি সাময়িকভাবে বন্ধ আছে।"
          : "এই দোকানটি এই মুহূর্তে বন্ধ আছে।";
    const detail =
      availability.reason === "DRAFT"
        ? "দোকানদার শীঘ্রই publish করবেন — কিছুক্ষণ পর আবার দেখুন।"
        : "সহায়তার জন্য দোকানদারের সাথে যোগাযোগ করুন।";

    return (
      <div
        className="store-surface grid min-h-screen place-items-center px-4"
        style={themeStyle(context.theme.config)}
      >
        <div className="max-w-md text-center">
          <p
            className="mx-auto grid h-12 w-12 place-items-center rounded-full text-lg font-bold text-white"
            style={{ background: "var(--store-primary)" }}
          >
            {context.store.name.trim().charAt(0)}
          </p>
          <h1 className="mt-4 text-xl font-semibold">{context.store.name}</h1>
          <p className="mt-2 text-sm font-medium">{message}</p>
          <p className="muted mt-1 text-sm">{detail}</p>
        </div>
      </div>
    );
  }

  const categories = await listStorefrontCategories(context.store.id);
  const ctx = themeContextFrom(context, categories);

  return (
    <div
      className="store-surface flex min-h-screen flex-col"
      data-density={ctx.config.typography.scale}
      style={themeStyle(ctx.config)}
    >
      <theme.Header ctx={ctx} />
      <main className="flex-1">{children}</main>
      <theme.Footer ctx={ctx} />
      <AutoRefresh intervalMs={30_000} />
    </div>
  );
}
