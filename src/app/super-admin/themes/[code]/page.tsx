import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ExternalLink, Power, RefreshCw, Store } from "lucide-react";
import { formatDateTime, formatRelativeBn } from "@/lib/dates";
import { NotFoundError } from "@/lib/errors";
import { getThemeDetail } from "@/lib/services/theme-service";
import { FormButton } from "@/app/admin/_components/form-button";
import { setThemeStatusAction, syncThemeCatalogAction } from "@/app/super-admin/actions";
import { ThemePreviewFrame } from "../_components/theme-preview-frame";

/** One theme: live preview, platform configuration, versions and store usage. */

export const dynamic = "force-dynamic";

const STORE_STATUS_LABEL: Record<string, string> = {
  PUBLISHED: "লাইভ",
  DRAFT: "Draft",
  SUSPENDED: "স্থগিত",
  CLOSED: "বন্ধ",
};

const numberFormat = new Intl.NumberFormat("en-US");

export async function generateMetadata({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  try {
    const detail = await getThemeDetail(code);
    return { title: `${detail.entry.name} — থিম` };
  } catch {
    return { title: "থিম" };
  }
}

export default async function ThemeDetailPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;

  let detail;
  try {
    detail = await getThemeDetail(code);
  } catch (error) {
    if (error instanceof NotFoundError) notFound();
    throw error;
  }

  const { entry, theme, versions, stores, lastSyncedAt } = detail;
  const active = theme?.status !== "ARCHIVED";
  const liveStore = stores.find((store) => store.status === "PUBLISHED");
  const enabledSections = entry.defaultConfig.sections.filter((section) => section.enabled).length;

  return (
    <div className="space-y-5">
      <Link
        href="/super-admin/themes"
        className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 transition hover:text-indigo-600"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        থিম ক্যাটালগ
      </Link>

      {/* Identity + primary actions */}
      <section className="rounded-2xl border border-slate-200/80 bg-white px-5 py-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)] sm:px-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2.5">
              <h1 className="text-[26px] leading-tight font-bold tracking-tight text-slate-900">
                {entry.name}
              </h1>
              <span
                className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[9px] font-semibold tracking-[0.1em] ${
                  active
                    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                    : "border-amber-200 bg-amber-50 text-amber-700"
                }`}
              >
                <span className={`h-1.5 w-1.5 rounded-full ${active ? "bg-emerald-500" : "bg-amber-500"}`} />
                {active ? "ACTIVE" : "INACTIVE"}
              </span>
              <span className="rounded-md bg-slate-100 px-2 py-0.5 font-mono text-[10px] text-slate-600">
                {entry.code}
              </span>
            </div>
            <p
              className="mt-1.5 text-[10px] font-semibold tracking-[0.16em] uppercase"
              style={{ color: entry.preview.swatches[0] }}
            >
              {entry.style}
            </p>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-500">{entry.description}</p>
            <p className="mt-3 text-[11px] text-slate-400">
              শেষ সিঙ্ক: {formatRelativeBn(lastSyncedAt)} · version {entry.version}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <FormButton
              action={setThemeStatusAction}
              fields={{ themeCode: entry.code, status: active ? "ARCHIVED" : "ACTIVE" }}
              variant="outline"
              confirmText={
                active
                  ? `${entry.name} থিমটি merchant ক্যাটালগ থেকে বন্ধ করবেন? পুরোনো দোকান আগের মতোই চলবে।`
                  : `${entry.name} থিমটি আবার merchant ক্যাটালগে চালু করবেন?`
              }
              buttonClassName={
                active
                  ? "rounded-full border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100"
                  : "rounded-full bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-lg shadow-indigo-500/25 hover:from-indigo-500 hover:to-violet-500"
              }
            >
              <Power className="h-3.5 w-3.5" />
              {active ? "ক্যাটালগ থেকে বন্ধ করুন" : "ক্যাটালগে চালু করুন"}
            </FormButton>
            {liveStore ? (
              <Link
                href={`/store/${liveStore.slug}`}
                className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-medium text-slate-700 transition hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-700"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                স্টোরফ্রন্ট দেখুন
              </Link>
            ) : null}
          </div>
        </div>
      </section>

      <div className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
        {/* Preview */}
        <section
          id="preview"
          className="scroll-mt-24 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)]"
        >
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold text-slate-900">লাইভ প্রিভিউ</h2>
              <p className="mt-0.5 text-[11px] text-slate-500">থিমের ডিফল্ট কনফিগ থেকে রেন্ডার করা</p>
            </div>
            <div className="flex items-center gap-2">
              <span className="rounded-full border border-indigo-200/70 bg-indigo-50 px-2.5 py-1 text-[9px] font-semibold text-indigo-600">
                v{entry.version}
              </span>
              <Link
                href={`/theme-preview/${entry.code}`}
                target="_blank"
                rel="noreferrer"
                title="নতুন ট্যাবে পূর্ণ প্রিভিউ খুলুন"
                className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-[10px] font-semibold text-slate-700 transition hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-700"
              >
                <ExternalLink className="h-3 w-3" />
                পূর্ণ প্রিভিউ
              </Link>
            </div>
          </div>

          <Link
            href={`/theme-preview/${entry.code}`}
            target="_blank"
            rel="noreferrer"
            aria-label={`${entry.name} পূর্ণ প্রিভিউ নতুন ট্যাবে খুলুন`}
            className="group mt-4 block rounded-xl focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500"
          >
            <div className="relative">
              <ThemePreviewFrame entry={entry} />
              <span className="pointer-events-none absolute inset-0 grid place-items-center rounded-xl bg-slate-950/0 opacity-0 transition group-hover:bg-slate-950/35 group-hover:opacity-100">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-[10px] font-semibold text-slate-900 shadow-lg">
                  <ExternalLink className="h-3 w-3" />
                  নতুন ট্যাবে খুলুন
                </span>
              </span>
            </div>
          </Link>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-3">
              <p className="text-[10px] font-semibold tracking-[0.14em] text-slate-400 uppercase">
                প্রাইমারি প্যালেট
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {Object.entries(entry.defaultConfig.colors).map(([key, value]) => (
                  <span key={key} className="flex items-center gap-1.5 text-[10px] text-slate-600">
                    <span
                      className="h-3.5 w-3.5 rounded-full ring-1 ring-black/10"
                      style={{ background: value }}
                    />
                    <span className="font-mono text-[9px] text-slate-400">{value}</span>
                  </span>
                ))}
              </div>
            </div>
            <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-3">
              <p className="text-[10px] font-semibold tracking-[0.14em] text-slate-400 uppercase">
                টাইপোগ্রাফি ও লেআউট
              </p>
              <ul className="mt-2 space-y-1 text-[11px] text-slate-600">
                <li>হেডিং: {entry.defaultConfig.typography.headingFont}</li>
                <li>বডি: {entry.defaultConfig.typography.bodyFont}</li>
                <li>বাটন: {entry.defaultConfig.buttons.style}</li>
                <li>
                  সেকশন: {numberFormat.format(enabledSections)}টি চালু
                </li>
              </ul>
            </div>
          </div>
        </section>

        <div className="space-y-4">
          {/* Configuration */}
          <section
            id="configuration"
            className="scroll-mt-24 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)]"
          >
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-sm font-semibold text-slate-900">প্ল্যাটফর্ম কনফিগারেশন</h2>
              <FormButton
                action={syncThemeCatalogAction}
                fields={{ source: "super-admin" }}
                variant="ghost"
                size="sm"
                showMessage={false}
                buttonClassName="rounded-full text-[10px] text-slate-500 hover:bg-slate-100"
              >
                <RefreshCw className="h-3 w-3" />
                sync
              </FormButton>
            </div>

            <dl className="mt-4 space-y-3 text-[11px]">
              {[
                ["কোড", entry.code],
                ["সংস্করণ", entry.version],
                ["ইন্ডাস্ট্রি", entry.industry],
                ["স্টাইল", entry.style],
                ["ক্যাটালগ স্ট্যাটাস", active ? "ACTIVE (merchant picker-এ দেখা যায়)" : "INACTIVE (picker-এ লুকানো)"],
                ["উপলব্ধ প্ল্যান", entry.compatiblePlans.join(", ")],
                ["ডেটাবেস রেকর্ড", theme ? "সিঙ্কড" : "সিঙ্ক প্রয়োজন"],
                [
                  "সর্বশেষ পরিবর্তন",
                  theme ? formatDateTime(theme.updatedAt) : "—",
                ],
              ].map(([label, value]) => (
                <div key={label} className="flex items-start justify-between gap-3 border-b border-slate-100 pb-2 last:border-0 last:pb-0">
                  <dt className="shrink-0 text-slate-400">{label}</dt>
                  <dd className="text-right font-medium text-slate-700">{value}</dd>
                </div>
              ))}
            </dl>

            <p className="mt-4 rounded-lg bg-slate-50 px-3 py-2 text-[10px] leading-relaxed text-slate-500">
              থিম বন্ধ করলে নতুন merchant আর এটি বেছে নিতে পারবে না; আগে থেকে যেসব দোকান এটি ব্যবহার
              করছে তারা অপরিবর্তিত চলবে। প্রতিটি পরিবর্তন audit log-এ যায়।
            </p>
          </section>

          {/* Versions */}
          <section
            id="versions"
            className="scroll-mt-24 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)]"
          >
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-sm font-semibold text-slate-900">ভার্সন ইতিহাস</h2>
              <span className="text-[10px] text-slate-400">
                {numberFormat.format(versions.length)}টি version
              </span>
            </div>

            <ul className="mt-3 space-y-2">
              {versions.map((version) => (
                <li
                  key={version.id}
                  className="rounded-xl border border-slate-100 bg-slate-50/50 px-3 py-2.5"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-[11px] font-semibold text-slate-800">
                      v{version.version}
                    </span>
                    <span
                      className={`rounded-full px-1.5 py-0.5 text-[9px] font-semibold ${
                        version.status === "ACTIVE"
                          ? "bg-emerald-100 text-emerald-700"
                          : "bg-slate-200 text-slate-600"
                      }`}
                    >
                      {version.status}
                    </span>
                  </div>
                  <p className="mt-1 text-[10px] text-slate-500">
                    {version.changelog ?? "কোনো changelog নেই"}
                  </p>
                  <p className="mt-1 text-[10px] text-slate-400">
                    {formatDateTime(version.createdAt)} · {numberFormat.format(version.storeCount)}টি দোকান
                  </p>
                </li>
              ))}
            </ul>
          </section>
        </div>
      </div>

      {/* Store usage */}
      <section className="rounded-2xl border border-slate-200/80 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-5 py-4">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">ব্যবহারকারী দোকান</h2>
            <p className="mt-0.5 text-[11px] text-slate-500">
              এই থিম সিলেক্ট করা সর্বশেষ {numberFormat.format(stores.length)}টি দোকান
            </p>
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-medium text-slate-600">
            <Store className="h-3 w-3" />
            {numberFormat.format(stores.length)} active
          </span>
        </div>

        {stores.length === 0 ? (
          <p className="px-5 py-8 text-center text-xs text-slate-500">
            এখনো কোনো দোকান এই থিমটি সিলেক্ট করেনি।
          </p>
        ) : (
          <div className="w-full overflow-x-auto">
            <table className="w-full min-w-full border-collapse text-sm">
              <thead>
                <tr className="bg-slate-50/70">
                  <th className="px-5 py-2.5 text-left text-[10px] font-semibold tracking-wide text-slate-500">
                    দোকান
                  </th>
                  <th className="px-5 py-2.5 text-left text-[10px] font-semibold tracking-wide text-slate-500">
                    স্ট্যাটাস
                  </th>
                  <th className="px-5 py-2.5 text-left text-[10px] font-semibold tracking-wide text-slate-500">
                    ভার্সন
                  </th>
                  <th className="px-5 py-2.5 text-left text-[10px] font-semibold tracking-wide text-slate-500">
                    পাবলিশ
                  </th>
                  <th className="px-5 py-2.5 text-right text-[10px] font-semibold tracking-wide text-slate-500">
                    লিংক
                  </th>
                </tr>
              </thead>
              <tbody>
                {stores.map((store) => (
                  <tr key={store.id} className="border-t border-slate-100 hover:bg-slate-50/60">
                    <td className="px-5 py-2.5">
                      <p className="text-[12px] font-medium text-slate-800">{store.name}</p>
                      <p className="font-mono text-[10px] text-slate-400">/{store.slug}</p>
                    </td>
                    <td className="px-5 py-2.5 text-[11px] text-slate-600">
                      {STORE_STATUS_LABEL[store.status] ?? store.status}
                    </td>
                    <td className="px-5 py-2.5 font-mono text-[11px] text-slate-600">v{store.version}</td>
                    <td className="px-5 py-2.5 text-[11px] text-slate-500">
                      {store.publishedAt ? formatDateTime(store.publishedAt) : "—"}
                    </td>
                    <td className="px-5 py-2.5 text-right">
                      <Link
                        href={`/store/${store.slug}`}
                        className="inline-flex items-center gap-1 text-[11px] font-medium text-indigo-600 hover:underline"
                      >
                        দেখুন
                        <ExternalLink className="h-3 w-3" />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
