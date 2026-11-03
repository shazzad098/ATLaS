import Link from "next/link";
import { Database, Layers, RefreshCw, SearchX, Store, Zap } from "lucide-react";
import { formatRelativeBn } from "@/lib/dates";
import { getThemeCatalogSnapshot } from "@/lib/services/theme-service";
import { FormButton } from "@/app/admin/_components/form-button";
import { syncThemeCatalogAction } from "@/app/super-admin/actions";
import { CatalogStat } from "./_components/catalog-stat";
import { ThemeCatalogCard } from "./_components/theme-catalog-card";

/** Super Admin theme catalog (PRD §7): shipped themes, drift, usage and sync. */

export const metadata = { title: "থিম ক্যাটালগ" };

export const dynamic = "force-dynamic";

const numberFormat = new Intl.NumberFormat("en-US");

function formatNumber(value: number): string {
  return numberFormat.format(value);
}

export default async function ThemesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const query = (q ?? "").trim();
  const needle = query.toLowerCase();

  const snapshot = await getThemeCatalogSnapshot();
  const cards = needle
    ? snapshot.cards.filter((card) =>
        [card.name, card.code, card.style, card.description, ...card.tags]
          .join(" ")
          .toLowerCase()
          .includes(needle),
      )
    : snapshot.cards;

  const readyPercent = snapshot.totals.catalog
    ? Math.round((snapshot.totals.active / snapshot.totals.catalog) * 100)
    : 0;
  const driftCount = snapshot.sync.missingThemes.length + snapshot.sync.missingVersions.length;
  const growth = snapshot.growth.percent;
  const newStoresLabel =
    growth === null
      ? `${formatNumber(snapshot.growth.newThisMonth)} টি নতুন এই মাসে`
      : `${growth >= 0 ? "+" : ""}${formatNumber(growth)}% এই মাসে`;

  return (
    <div className="space-y-5">
      {/* Hero: what this catalog is, when it last synced, and the sync action. */}
      <section className="rounded-2xl border border-slate-200/80 bg-white px-5 py-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)] sm:px-6 sm:py-6">
        <div className="flex flex-wrap items-start justify-between gap-5">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2.5">
              <h1 className="text-[26px] leading-tight font-bold tracking-tight text-slate-900 sm:text-[30px]">
                থিম ক্যাটালগ
              </h1>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-indigo-200/70 bg-indigo-50 px-3 py-1 text-[10px] font-semibold text-indigo-600">
                <span className="h-1.5 w-1.5 rounded-full bg-indigo-500" />
                Core System
              </span>
            </div>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-500">
              প্ল্যাটফর্মে শিপ করা থিম, version ও ব্যবহার — merchant ডিজাইন স্ক্রিন এখান থেকেই পড়ে
              এবং তাৎক্ষণিক সিঙ্ক হয়।
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-4">
            <div className="text-right">
              <p className="text-[9px] font-semibold tracking-[0.18em] text-slate-400 uppercase">
                লাস্ট সিঙ্ক
              </p>
              <p className="mt-1 flex items-center justify-end gap-1.5 text-[11px] text-slate-500">
                <span
                  className={`h-1.5 w-1.5 rounded-full ${
                    snapshot.sync.upToDate ? "bg-emerald-500" : "bg-amber-500"
                  }`}
                />
                শেষ সিঙ্ক: {formatRelativeBn(snapshot.sync.lastSyncedAt)}
              </p>
            </div>

            <FormButton
              action={syncThemeCatalogAction}
              fields={{ source: "super-admin" }}
              buttonClassName="rounded-full bg-gradient-to-r from-indigo-600 to-violet-600 px-5 py-2.5 text-xs font-semibold text-white shadow-lg shadow-indigo-500/25 hover:from-indigo-500 hover:to-violet-500"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              ক্যাটালগ sync করুন
            </FormButton>
          </div>
        </div>
      </section>

      {/* Live counters — every value is read from the database on each request. */}
      <section aria-label="ক্যাটালগ সারসংক্ষেপ" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <CatalogStat
          label="মোট ইনস্টলড থিম"
          value={
            <>
              {formatNumber(snapshot.totals.catalog)}{" "}
              <span className="text-base font-semibold text-slate-500">টি</span>
            </>
          }
          tone="indigo"
          icon={Layers}
          badge={
            <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[9px] font-semibold text-emerald-700">
              {snapshot.totals.active === snapshot.totals.catalog
                ? "সবগুলোই অ্যাকটিভ"
                : `${formatNumber(snapshot.totals.active)} অ্যাকটিভ`}
            </span>
          }
          hint={`${formatNumber(readyPercent)}% production ready release`}
        />
        <CatalogStat
          label="মোট সক্রিয় স্টোর"
          value={formatNumber(snapshot.totals.storesUsingThemes)}
          tone="emerald"
          icon={Store}
          badge={
            <span
              className={`text-[10px] font-semibold ${
                growth !== null && growth < 0 ? "text-rose-500" : "text-emerald-600"
              }`}
            >
              {newStoresLabel}
            </span>
          }
          hint={
            snapshot.totals.storesUsingThemes === 0
              ? "এখনো কোনো দোকান থিম নির্বাচন করেনি"
              : "মার্চেন্ট স্টোরে সক্রিয় থিম ইনস্টলেশন"
          }
        />
        <CatalogStat
          label="সিঙ্ক স্ট্যাটাস"
          value={snapshot.sync.upToDate ? "Up-to-date" : "Sync প্রয়োজন"}
          tone="sky"
          icon={Database}
          badge={
            <span
              className={`mt-0.5 h-1.5 w-1.5 rounded-full ${
                snapshot.sync.upToDate ? "bg-emerald-500" : "bg-amber-500"
              }`}
            />
          }
          hint={
            snapshot.sync.upToDate
              ? "Zero schema drift detected"
              : `${formatNumber(driftCount)}টি ক্যাটালগ পার্থক্য পাওয়া গেছে`
          }
        />
        <CatalogStat
          label="পারফরম্যান্স স্কোর"
          value={
            <>
              {formatNumber(snapshot.health.score)}
              <span className="text-base font-semibold text-slate-400">/100</span>
            </>
          }
          tone="amber"
          icon={Zap}
          badge={
            <span className="font-mono text-[10px] text-slate-400">
              {(snapshot.health.latencyMs / 1000).toFixed(2)}s DB
            </span>
          }
          hint={
            snapshot.sync.upToDate
              ? "Schema drift নেই, ক্যাটালগ response স্বাভাবিক"
              : "Drift ঠিক করতে ক্যাটালগ sync করুন"
          }
        />
      </section>

      {/* Catalog grid */}
      <section className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 className="text-lg font-bold tracking-tight text-slate-900">
              {query ? `“${query}” এর ফলাফল` : "আজকের থিম ক্যাটালগ"}
            </h2>
            <p className="mt-0.5 text-xs text-slate-500">
              মার্চেন্ট শপ ইনস্টলেশন ও লাইভ কনফিগারেশনের জনা দৃষ্টি
            </p>
          </div>
          <div className="flex items-center gap-3">
            {query ? (
              <Link
                href="/super-admin/themes"
                className="text-[11px] font-medium text-indigo-600 hover:underline"
              >
                সব থিম দেখুন
              </Link>
            ) : null}
            <p className="text-xs text-slate-400">
              {formatNumber(cards.length)} টি থিম প্রদর্শিত হচ্ছে
            </p>
          </div>
        </div>

        {cards.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-14 text-center">
            <span className="mx-auto grid h-11 w-11 place-items-center rounded-xl bg-slate-50 text-slate-400">
              <SearchX className="h-5 w-5" />
            </span>
            <p className="mt-3 text-sm font-semibold text-slate-800">কোনো থিম পাওয়া যায়নি</p>
            <p className="mx-auto mt-1 max-w-md text-xs text-slate-500">
              “{query}” নামে বা কোডে কোনো থিম নেই। অন্য কিছু লিখে দেখুন, অথবা পুরো ক্যাটালগ দেখুন।
            </p>
            <Link
              href="/super-admin/themes"
              className="mt-4 inline-flex items-center rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
            >
              সব থিম দেখুন
            </Link>
          </div>
        ) : (
          <div className="grid gap-4 lg:grid-cols-2 2xl:grid-cols-3">
            {cards.map((card) => (
              <ThemeCatalogCard key={card.code} card={card} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
