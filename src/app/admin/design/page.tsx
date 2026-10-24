import Link from "next/link";
import { requireActiveStore } from "@/lib/tenant";
import { prisma } from "@/lib/db";
import { getStoreThemeState, listThemeOptions } from "@/lib/services/theme-service";
import { resolveThemeConfig } from "@/lib/theme-catalog";
import { storePath } from "@/lib/storefront";
import { Alert, Card, CardBody, CardHeader, EmptyState, PageHeader } from "@/components/ui/shell";
import { ThemeEditor } from "@/app/admin/_components/theme-editor";
import { FormButton } from "@/app/admin/_components/form-button";
import { selectThemeAction } from "@/app/admin/actions";

/** Theme picker + config editor (FR-06). */

export const metadata = { title: "ডিজাইন" };

export default async function DesignPage() {
  const { store, workspace } = await requireActiveStore();
  const tenantId = workspace.activeTenant.tenantId;

  const [state, options, selected] = await Promise.all([
    getStoreThemeState(store.id, tenantId),
    listThemeOptions(store.id, tenantId),
    prisma.storeTheme.findFirst({
      where: { storeId: store.id, isSelected: true },
      include: { themeVersion: { include: { theme: true } } },
    }),
  ]);

  const editorOptions = options.map((option) => ({
    code: option.code,
    name: option.name,
    style: option.style,
    gradient: option.preview.gradient,
    swatches: option.preview.swatches,
    allowed: option.allowed,
    selected: option.selected,
  }));

  return (
    <div className="space-y-5">
      <PageHeader
        title="ডিজাইন"
        description="থিম, রঙ, হিরো, সেকশন, মেনু ও ফুটার — সব এক জায়গায়। Publish করলে live দোকানে যাবে।"
        action={
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href="/design-preview"
              target="_blank"
              className="rounded-lg border border-ink-200 px-3 py-1.5 text-xs font-medium text-ink-700 hover:bg-ink-50"
            >
              ড্রাফট প্রিভিউ
            </Link>
            {store.status === "PUBLISHED" ? (
              <Link
                href={storePath(store.slug)}
                target="_blank"
                className="rounded-lg border border-ink-200 px-3 py-1.5 text-xs font-medium text-ink-700 hover:bg-ink-50"
              >
                live দোকান
              </Link>
            ) : null}
          </div>
        }
      />

      <Alert tone="info">
        সব পরিবর্তন আগে draft-এ সেভ হয়। Publish চাপলে সেভ হয়ে সরাসরি live দোকানে যাবে — তাই নির্ভয়ে সম্পাদনা করুন।
      </Alert>

      {selected ? (
        <ThemeEditor
          storeId={store.id}
          themeVersionId={selected.themeVersion.id}
          themeCode={state.themeCode ?? selected.themeVersion.theme.code}
          themeName={state.themeName ?? selected.themeVersion.theme.name}
          storeName={store.name}
          draft={state.draftConfig ?? resolveThemeConfig(selected.themeVersion.theme.code, null).config}
          isPublished={state.isPublished}
          canSwitch={state.canSwitch}
          switchBlockedReason={state.switchBlockedReason}
          options={editorOptions}
        />
      ) : (
        <Card>
          <CardHeader title="থিম বাছুন" description="plan অনুযায়ী অনুমোদিত থিম দেখানো হয়েছে।" />
          <CardBody>
            <div className="grid gap-3 sm:grid-cols-3">
              {options.map((option) => (
                <div key={option.code} className="rounded-xl border border-ink-200 p-3">
                  <span className={`block h-16 rounded-lg bg-gradient-to-br ${option.preview.gradient}`} />
                  <p className="mt-2 text-sm font-semibold text-ink-900">{option.name}</p>
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
                    <p className="mt-3 text-xs text-amber-700">এই plan-এ উপলব্ধ নয়</p>
                  )}
                </div>
              ))}
            </div>
            <EmptyState
              title="ডিফল্ট theme নির্বাচন করা হয়নি"
              description="উপরের যেকোনো theme বেছে নিন — ডিফল্ট content সহ সেটি draft-এ চলে যাবে।"
            />
          </CardBody>
        </Card>
      )}
    </div>
  );
}
