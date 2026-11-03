import type { LucideIcon } from "lucide-react";

/** Stat tile used across the theme catalog header (label, value, badge, hint). */

const TONES = {
  indigo: "bg-indigo-50 text-indigo-600 ring-indigo-100",
  emerald: "bg-emerald-50 text-emerald-600 ring-emerald-100",
  sky: "bg-sky-50 text-sky-600 ring-sky-100",
  amber: "bg-amber-50 text-amber-600 ring-amber-100",
} as const;

export function CatalogStat({
  label,
  value,
  hint,
  icon: Icon,
  tone = "indigo",
  badge,
}: {
  label: string;
  value: React.ReactNode;
  hint: React.ReactNode;
  icon: LucideIcon;
  tone?: keyof typeof TONES;
  badge?: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
      <div className="flex items-start justify-between gap-3">
        <p className="text-xs font-medium text-slate-500">{label}</p>
        <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ring-1 ${TONES[tone]}`}>
          <Icon className="h-4 w-4" strokeWidth={1.8} />
        </span>
      </div>
      <div className="mt-3.5 flex flex-wrap items-center gap-2">
        <span className="text-[26px] leading-none font-bold tracking-tight text-slate-900">{value}</span>
        {badge}
      </div>
      <p className="mt-3 text-[11px] text-slate-400">{hint}</p>
    </div>
  );
}
