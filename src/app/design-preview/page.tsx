import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ExternalLink, Eye, PencilRuler } from "lucide-react";
import { requireActiveStorePage } from "@/lib/tenant";
import { getStoreThemeState } from "@/lib/services/theme-service";
import { loadStorefront } from "@/lib/services/store-service";
import { storePath, themeContextFrom } from "@/lib/storefront";
import { listStorefrontCategories, listStorefrontProducts } from "@/lib/storefront-data";
import { getTheme } from "@/themes";
import { themeStyle } from "@/themes/css";
import { StorefrontSections } from "@/themes/storefront-sections";

/**
 * Draft storefront preview.
 *
 * Lives outside `/admin` on purpose: it renders the real theme components with
 * the saved draft config, full-bleed, so the merchant can check the actual
 * storefront before publishing. It is private (`noindex`) and requires a signed
 * in merchant session.
 */

export const metadata = {
  title: "ড্রাফট প্রিভিউ",
  robots: { index: false, follow: false },
};

export default async function DesignPreviewPage() {
  const { store, workspace } = await requireActiveStorePage();
  const [context, state] = await Promise.all([
    loadStorefront(store.slug),
    getStoreThemeState(store.id, workspace.activeTenant.tenantId),
  ]);
  if (!context) notFound();

  const themeCode = state.themeCode ?? context.theme.code;
  const config = state.draftConfig ?? context.theme.config;
  const theme = getTheme(themeCode);

  const previewContext = {
    ...context,
    theme: { ...context.theme, code: themeCode, config },
  };
  const ctx = themeContextFrom(previewContext);

  const [{ products }, categories] = await Promise.all([
    listStorefrontProducts(store.id, { perPage: 8 }),
    listStorefrontCategories(store.id),
  ]);

  const hasUnpublishedChanges = state.isPublished && state.config
    ? JSON.stringify(state.config) !== JSON.stringify(config)
    : !state.isPublished;

  return (
    <div
      className="store-surface flex min-h-screen flex-col"
      data-density={config.typography.scale}
      style={themeStyle(config)}
    >
      <div className="sticky top-0 z-50 border-b border-white/10 bg-[#0B1220] text-white">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-2 px-3 py-2.5 sm:px-5">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white/12 px-2.5 py-1 text-[10.5px] font-semibold">
            <Eye className="h-3.5 w-3.5" />
            ড্রাফট প্রিভিউ
          </span>
          <span className="hidden min-w-0 items-center gap-1.5 text-[11px] text-white/60 sm:inline-flex">
            <PencilRuler className="h-3.5 w-3.5" />
            <span className="truncate">
              {theme.name} থিম · {store.name}
            </span>
          </span>
          <span
            className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
              hasUnpublishedChanges
                ? "bg-amber-400/15 text-amber-200"
                : "bg-emerald-400/15 text-emerald-200"
            }`}
          >
            {hasUnpublishedChanges ? "publish বাকি আছে" : "live"}
          </span>

          <div className="ml-auto flex items-center gap-1.5">
            <Link
              href="/admin/design"
              className="inline-flex items-center gap-1.5 rounded-lg border border-white/15 px-2.5 py-1.5 text-[11px] font-medium text-white/80 hover:bg-white/10 hover:text-white"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              এডিটরে ফিরুন
            </Link>
            {store.status === "PUBLISHED" ? (
              <Link
                href={storePath(store.slug)}
                target="_blank"
                className="inline-flex items-center gap-1.5 rounded-lg bg-white px-2.5 py-1.5 text-[11px] font-semibold text-ink-900 hover:bg-white/90"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                লাইভ সাইট
              </Link>
            ) : null}
          </div>
        </div>
      </div>

      <theme.Header ctx={ctx} />
      <main className="flex-1">
        <StorefrontSections
          theme={theme}
          ctx={ctx}
          products={products}
          categories={categories}
          sections={ctx.config.sections.filter((section) => section.enabled)}
        />
      </main>
      <theme.Footer ctx={ctx} />
    </div>
  );
}
