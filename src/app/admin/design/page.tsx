import { requireActiveStorePermissionPage } from "@/lib/tenant";
import { prisma } from "@/lib/db";
import {
  getStoreThemeState,
  listThemeOptions,
} from "@/lib/services/theme-service";
import { resolveThemeConfig } from "@/lib/theme-catalog";
import {
  listStorefrontCategories,
  listStorefrontProducts,
} from "@/lib/storefront-data";
import { selectThemeAction } from "@/app/admin/actions";
import { ThemeEditor } from "@/app/admin/_components/theme-editor";
import { FormButton } from "@/app/admin/_components/form-button";

/** Theme picker + live customizer (FR-06). */

export const metadata = { title: "ডিজাইন" };

export default async function DesignPage() {
  const { store, workspace } = await requireActiveStorePermissionPage("design:read");
  const tenantId = workspace.activeTenant.tenantId;

  const [state, options, selected, { products }, categories] =
    await Promise.all([
      getStoreThemeState(store.id, tenantId),
      listThemeOptions(store.id, tenantId),
      prisma.storeTheme.findFirst({
        where: { storeId: store.id, isSelected: true },
        include: { themeVersion: { include: { theme: true } } },
      }),
      listStorefrontProducts(store.id, { perPage: 8 }),
      listStorefrontCategories(store.id),
    ]);

  const editorOptions = options.map(option => ({
    code: option.code,
    name: option.name,
    style: option.style,
    gradient: option.preview.gradient,
    swatches: option.preview.swatches,
    allowed: option.allowed,
    selected: option.selected,
  }));

  if (selected) {
    return (
      <ThemeEditor
        storeId={store.id}
        storeName={store.name}
        storeSlug={store.slug}
        themeVersionId={selected.themeVersion.id}
        themeCode={state.themeCode ?? selected.themeVersion.theme.code}
        draft={
          state.draftConfig ??
          resolveThemeConfig(selected.themeVersion.theme.code, null).config
        }
        isPublished={state.isPublished}
        canSwitch={state.canSwitch}
        switchBlockedReason={state.switchBlockedReason}
        options={editorOptions}
        products={products}
        categories={categories}
      />
    );
  }

  // No theme selected yet — offer the plan-gated catalog.
  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-ink-200 bg-white px-5 py-4">
        <p className="text-[11px] font-semibold text-ink-400">
          দোকান কাস্টমাইজার
        </p>
        <h1 className="mt-1 font-display text-xl font-bold text-ink-900">
          থিম বাছুন
        </h1>
        <p className="mt-1 text-sm text-ink-500">
          আপনার plan অনুযায়ী অনুমোদিত থিম বেছে নিয়ে storefront সাজান।
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        {options.map(option => (
          <div
            key={option.code}
            className="rounded-xl border border-ink-200 bg-white p-4 transition hover:border-ink-300"
          >
            <span
              className={`block h-20 rounded-lg bg-gradient-to-br ${option.preview.gradient}`}
            />
            <p className="mt-2 text-sm font-semibold text-ink-900">
              {option.name}
            </p>
            <p className="text-xs text-ink-500">{option.style}</p>
            {option.allowed ? (
              <div className="mt-3">
                <FormButton
                  action={selectThemeAction}
                  fields={{ storeId: store.id, themeCode: option.code }}
                  size="sm"
                  showMessage={false}
                >
                  নির্বাচন করুন
                </FormButton>
              </div>
            ) : (
              <p className="mt-3 text-xs text-amber-600">এই plan-এ উপলব্ধ নয়</p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
