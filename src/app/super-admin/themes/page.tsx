import { themeCatalogOverview } from "@/lib/services/platform-service";
import { THEME_CATALOG } from "@/lib/theme-catalog";
import { Badge, Card, CardBody, CardHeader, PageHeader } from "@/components/ui/shell";
import { FormButton } from "@/app/admin/_components/form-button";
import { syncThemeCatalogAction } from "@/app/super-admin/actions";

/** Shipped theme catalog and how many stores use each (PRD §7). */

export const metadata = { title: "থিম ক্যাটালগ" };

export default async function ThemesPage() {
  const themes = await themeCatalogOverview();

  return (
    <div className="space-y-5">
      <PageHeader
        title="থিম ক্যাটালগ"
        description="প্ল্যাটফর্মে শিপ করা থিম, version ও ব্যবহার — merchant ডিজাইন স্ক্রিন এখান থেকেই পড়ে।"
        action={
          <FormButton action={syncThemeCatalogAction} fields={{ source: "super-admin" }} variant="outline">
            ক্যাটালগ sync করুন
          </FormButton>
        }
      />

      <div className="grid gap-4 lg:grid-cols-3">
        {THEME_CATALOG.map((entry) => {
          const row = themes.find((theme) => theme.code === entry.code);
          return (
            <Card key={entry.code}>
              <span className={`block h-24 rounded-t-xl bg-gradient-to-br ${entry.preview.gradient}`}>
                <span className="flex h-full items-end gap-1.5 p-3">
                  {entry.preview.swatches.map((swatch) => (
                    <span
                      key={swatch}
                      className="h-5 w-5 rounded-full border border-white/70"
                      style={{ background: swatch }}
                    />
                  ))}
                </span>
              </span>
              <CardHeader
                title={entry.name}
                description={entry.style}
                action={<Badge tone={row?.status === "ACTIVE" ? "success" : "neutral"}>{row?.status ?? "—"}</Badge>}
              />
              <CardBody className="space-y-3">
                <p className="text-xs text-ink-500">{entry.description}</p>
                <dl className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <dt className="text-ink-400">কোড</dt>
                    <dd className="font-mono text-ink-800">{entry.code}</dd>
                  </div>
                  <div>
                    <dt className="text-ink-400">ইন্ডাস্ট্রি</dt>
                    <dd className="text-ink-800">{entry.industry}</dd>
                  </div>
                  <div>
                    <dt className="text-ink-400">সংস্করণ</dt>
                    <dd className="text-ink-800">{entry.version}</dd>
                  </div>
                  <div>
                    <dt className="text-ink-400">ব্যবহারকারী দোকান</dt>
                    <dd className="font-medium text-ink-900">{row?.storeCount ?? 0}</dd>
                  </div>
                </dl>
                <p className="text-[11px] text-ink-400">
                  উপলব্ধ প্ল্যান: {entry.compatiblePlans.join(", ")}
                </p>
              </CardBody>
            </Card>
          );
        })}
      </div>

      <Card>
        <CardHeader title="ডেটাবেস রেকর্ড" description="Theme ও ThemeVersion row — ক্যাটালগ sync করলে হালনাগাদ হয়" />
        <CardBody>
          <div className="grid gap-3 sm:grid-cols-3">
            {themes.map((theme) => (
              <div key={theme.id} className="rounded-lg border border-ink-200 px-3 py-2">
                <p className="text-sm font-semibold text-ink-900">{theme.name}</p>
                <p className="font-mono text-[11px] text-ink-500">{theme.code}</p>
                <p className="mt-1 text-xs text-ink-500">
                  {theme.versions.length} version · {theme.storeCount} দোকান ব্যবহার করছে
                </p>
              </div>
            ))}
            {themes.length === 0 ? (
              <p className="text-sm text-ink-500">
                ডেটাবেসে এখনো কোনো থিম row নেই — উপরের “ক্যাটালগ sync করুন” চাপুন।
              </p>
            ) : null}
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
