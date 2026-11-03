import type { LucideIcon } from "lucide-react";

/** KPI tile used by the tenant directory (label, live value, trend, hint). */

const TONES = {
  sky: "bg-sky-50 text-sky-600 ring-sky-100",
  emerald: "bg-emerald-50 text-emerald-600 ring-emerald-100",
  amber: "bg-amber-50 text-amber-600 ring-amber-100",
  violet: "bg-violet-50 text-violet-600 ring-violet-100",
} as const;

export function TenantKpi({
  label,
  value,
  badge,
  hint,
  icon: Icon,
  tone = "sky",
}: {
  label: string;
  value: React.ReactNode;
  badge?: React.ReactNode;
  hint: React.ReactNode;
  icon: LucideIcon;
  tone?: keyof typeof TONES;
}) {
  return (
    <div className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
      <div className="flex items-start justify-between gap-2">
        <p className="text-[11px] font-medium text-slate-500">{label}</p>
        <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg ring-1 ${TONES[tone]}`}>
          <Icon className="h-4 w-4" strokeWidth={1.8} />
        </span>
      </div>
      <div className="mt-2.5 flex flex-wrap items-center gap-2">
        <span className="text-[22px] leading-none font-bold tracking-tight text-slate-900">
          {value}
        </span>
        {badge}
      </div>
      <p className="mt-2.5 text-[10px] text-slate-400">{hint}</p>
    </div>
  );
}

export function GrowthBadge({ value, empty = "নতুন" }: { value: number | null; empty?: string }) {
  if (value === null) {
    return (
      <span className="rounded-full bg-sky-50 px-1.5 py-0.5 text-[9px] font-semibold text-sky-600">
        {empty}
      </span>
    );
  }
  if (value === 0) {
    return (
      <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[9px] font-semibold text-slate-500">
        স্থির
      </span>
    );
  }
  const positive = value > 0;
  const label = new Intl.NumberFormat("bn-BD").format(Math.abs(value));
  return (
    <span
      className={`rounded-full px-1.5 py-0.5 text-[9px] font-semibold ${
        positive ? "bg-emerald-50 text-emerald-600" : "bg-rose-50 text-rose-600"
      }`}
    >
      {positive ? "↑" : "↓"} {label}%
    </span>
  );
}
