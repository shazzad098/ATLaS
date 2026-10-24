import { cn } from "@/lib/cn";

/** Small presentational primitives: cards, badges, alerts, page headers. */

export function Card({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <div className={cn("rounded-xl border border-ink-200 bg-white shadow-xs", className)}>{children}</div>
  );
}

export function CardHeader({
  title,
  description,
  action,
  className,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-wrap items-start justify-between gap-3 border-b border-ink-100 px-5 py-4", className)}>
      <div className="space-y-0.5">
        <h2 className="text-sm font-semibold text-ink-900">{title}</h2>
        {description ? <p className="text-xs text-ink-500">{description}</p> : null}
      </div>
      {action}
    </div>
  );
}

export function CardBody({ className, children }: { className?: string; children: React.ReactNode }) {
  return <div className={cn("px-5 py-4", className)}>{children}</div>;
}

export type Tone = "neutral" | "success" | "warning" | "danger" | "info" | "brand";

const TONES: Record<Tone, string> = {
  neutral: "bg-ink-100 text-ink-700 border-ink-200",
  success: "bg-emerald-50 text-emerald-700 border-emerald-200",
  warning: "bg-amber-50 text-amber-700 border-amber-200",
  danger: "bg-red-50 text-red-700 border-red-200",
  info: "bg-sky-50 text-sky-700 border-sky-200",
  brand: "bg-brand-50 text-brand-700 border-brand-200",
};

export function Badge({
  tone = "neutral",
  className,
  children,
}: {
  tone?: Tone;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium whitespace-nowrap",
        TONES[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

export function Alert({
  tone = "info",
  title,
  children,
  className,
}: {
  tone?: Tone;
  title?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("rounded-lg border px-4 py-3 text-sm", TONES[tone], className)}>
      {title ? <p className="font-semibold">{title}</p> : null}
      {children ? <div className={cn(title ? "mt-1" : "")}>{children}</div> : null}
    </div>
  );
}

export function PageHeader({
  title,
  description,
  action,
  breadcrumb,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactNode;
  breadcrumb?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div className="space-y-1">
        {breadcrumb ? <div className="text-xs text-ink-500">{breadcrumb}</div> : null}
        <h1 className="text-xl font-semibold tracking-tight text-ink-900 sm:text-2xl">{title}</h1>
        {description ? <p className="text-sm text-ink-500">{description}</p> : null}
      </div>
      {action}
    </div>
  );
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-dashed border-ink-200 bg-white px-6 py-12 text-center">
      <p className="text-sm font-semibold text-ink-800">{title}</p>
      {description ? <p className="mx-auto mt-1 max-w-md text-sm text-ink-500">{description}</p> : null}
      {action ? <div className="mt-4 flex justify-center">{action}</div> : null}
    </div>
  );
}

export function Stat({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
  tone?: Tone;
}) {
  return (
    <div className="rounded-xl border border-ink-200 bg-white px-4 py-3">
      <p className="text-xs font-medium text-ink-500">{label}</p>
      <p className="mt-1 text-xl font-semibold text-ink-900">{value}</p>
      {hint ? (
        <p className="mt-1 text-xs text-ink-500">
          {tone ? <Badge tone={tone}>{hint}</Badge> : hint}
        </p>
      ) : null}
    </div>
  );
}

/**
 * Usage meter shared by the platform dashboard, the tenant detail page and the
 * merchant plan strip. `limit === null` means the plan is unlimited, so the bar
 * stays a quiet accent instead of pretending there is a ceiling.
 */
export function Meter({
  label,
  used,
  limit,
  unit = "",
  className,
}: {
  label: string;
  used: number;
  limit: number | null;
  unit?: string;
  className?: string;
}) {
  const percent = limit && limit > 0 ? Math.min(100, Math.round((used / limit) * 100)) : null;
  const bar =
    percent === null
      ? "bg-brand-400/60"
      : percent >= 90
        ? "bg-red-500"
        : percent >= 70
          ? "bg-amber-500"
          : "bg-brand-600";

  return (
    <div className={className}>
      <div className="flex items-baseline justify-between gap-2 text-[11px]">
        <span className="font-medium text-ink-600">{label}</span>
        <span className="text-ink-500 tabular-nums">
          {used.toLocaleString("en-US")}
          {unit}
          <span className="text-ink-400"> / {limit === null ? "∞" : `${limit.toLocaleString("en-US")}${unit}`}</span>
        </span>
      </div>
      <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-ink-100">
        <div
          className={cn("h-full rounded-full transition-[width]", bar)}
          style={{ width: percent === null ? "14%" : `${Math.max(percent, 2)}%` }}
        />
      </div>
    </div>
  );
}

export function Table({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        "w-full overflow-x-auto overscroll-x-contain [scrollbar-color:var(--color-ink-300)_transparent] [scrollbar-width:thin]",
        className,
      )}
    >
      <table className="w-full min-w-full border-collapse text-sm">{children}</table>
    </div>
  );
}

export function Th({ className, children }: { className?: string; children?: React.ReactNode }) {
  return (
    <th
      className={cn(
        "border-b border-ink-100 px-4 py-2.5 text-left text-xs font-semibold whitespace-nowrap text-ink-500",
        className,
      )}
    >
      {children}
    </th>
  );
}

export function Td({ className, children }: { className?: string; children?: React.ReactNode }) {
  return <td className={cn("border-b border-ink-100 px-4 py-2.5 align-middle text-ink-700", className)}>{children}</td>;
}
