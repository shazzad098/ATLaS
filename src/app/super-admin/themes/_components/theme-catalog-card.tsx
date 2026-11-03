import Link from "next/link";
import { Eye, History, Settings2 } from "lucide-react";
import { getThemeEntry } from "@/lib/theme-catalog";
import type { ThemeCatalogCard } from "@/lib/services/theme-service";
import { ThemePreviewFrame } from "./theme-preview-frame";

/** One catalog card: real preview, live usage numbers and the three actions. */

const numberFormat = new Intl.NumberFormat("en-US");

export function ThemeCatalogCard({ card }: { card: ThemeCatalogCard }) {
  const entry = getThemeEntry(card.code);
  const active = card.status === "ACTIVE";

  return (
    <article className="flex h-full flex-col overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition duration-200 hover:-translate-y-0.5 hover:shadow-[0_18px_40px_-28px_rgba(15,23,42,0.45)]">
      <div className="px-4 pt-4">
        <Link
          href={`/theme-preview/${card.code}`}
          target="_blank"
          rel="noreferrer"
          aria-label={`${card.name} থিম প্রিভিউ নতুন ট্যাবে খুলুন`}
          title="নতুন ট্যাবে প্রিভিউ খুলুন"
          className="group/preview block rounded-xl focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500"
        >
          {entry ? (
            <div className="relative">
              <ThemePreviewFrame entry={entry} className={active ? "" : "opacity-60 saturate-50"} />
              <span className="pointer-events-none absolute inset-0 grid place-items-center rounded-xl bg-slate-950/0 opacity-0 transition duration-200 group-hover/preview:bg-slate-950/35 group-hover/preview:opacity-100">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-[10px] font-semibold text-slate-900 shadow-lg">
                  <Eye className="h-3 w-3" />
                  প্রিভিউ খুলুন
                </span>
              </span>
            </div>
          ) : (
            <div className="h-24 rounded-xl bg-slate-100" />
          )}
        </Link>
      </div>

      <div className="flex flex-1 flex-col p-5">
        <div className="flex items-start justify-between gap-2">
          <h3 className="text-lg font-bold tracking-tight text-slate-900">{card.name}</h3>
          <span
            className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-[9px] font-semibold tracking-[0.1em] ${
              active
                ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                : "border-amber-200 bg-amber-50 text-amber-700"
            }`}
          >
            <span className={`h-1.5 w-1.5 rounded-full ${active ? "bg-emerald-500" : "bg-amber-500"}`} />
            {active ? "ACTIVE" : "INACTIVE"}
          </span>
        </div>

        <p
          className="mt-1 text-[10px] font-semibold tracking-[0.16em] uppercase"
          style={{ color: entry?.preview.swatches[0] ?? "#64748b" }}
        >
          {card.style}
        </p>

        <p className="mt-2 text-sm leading-relaxed text-slate-500">{card.description}</p>

        <div className="mt-3 flex flex-wrap gap-1.5">
          {card.tags.map((tag) => (
            <span
              key={tag}
              className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[10px] font-medium text-slate-600"
            >
              {tag}
            </span>
          ))}
        </div>

        <dl className="mt-5 grid grid-cols-2 gap-x-4 gap-y-3 border-t border-slate-100 pt-4">
          <div>
            <dt className="text-[10px] text-slate-400">কোড</dt>
            <dd className="mt-1">
              <span className="inline-block rounded-md bg-slate-100 px-2 py-0.5 font-mono text-[11px] text-slate-700">
                {card.code}
              </span>
            </dd>
          </div>
          <div>
            <dt className="text-[10px] text-slate-400">সংস্করণ</dt>
            <dd className="mt-1 text-[11px] text-slate-800">{card.version}</dd>
          </div>
          <div>
            <dt className="text-[10px] text-slate-400">ব্যবহারকারী দোকান</dt>
            <dd className="mt-1 flex flex-wrap items-center gap-1.5">
              <span className="text-[11px] font-semibold text-slate-900">
                {numberFormat.format(card.storeCount)} টি দোকান
              </span>
              <span
                className={`rounded border px-1.5 py-px text-[9px] font-medium ${
                  card.storeCount > 0
                    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                    : "border-slate-200 bg-slate-50 text-slate-500"
                }`}
              >
                {card.storeCount > 0 ? "Active" : "Unused"}
              </span>
            </dd>
          </div>
          <div>
            <dt className="text-[10px] text-slate-400">উপলব্ধ প্ল্যান</dt>
            <dd className="mt-1 text-[11px] text-slate-700">{card.compatiblePlans.join(", ")}</dd>
          </div>
        </dl>

        <div className="mt-auto flex items-center gap-2 border-t border-slate-100 pt-4">
          <Link
            href={`/theme-preview/${card.code}`}
            target="_blank"
            rel="noreferrer"
            title="নতুন ট্যাবে পূর্ণ প্রিভিউ"
            className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 transition hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-700"
          >
            <Eye className="h-3.5 w-3.5" />
            প্রিভিউ দেখুন
          </Link>
          <Link
            href={`/super-admin/themes/${card.code}#configuration`}
            className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 transition hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-700"
          >
            <Settings2 className="h-3.5 w-3.5" />
            কনফিগার
          </Link>
          <Link
            href={`/super-admin/themes/${card.code}#versions`}
            aria-label={`${card.name} ভার্সন ইতিহাস`}
            title="ভার্সন ইতিহাস"
            className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-slate-200 bg-white text-slate-500 transition hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-700"
          >
            <History className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>
    </article>
  );
}
