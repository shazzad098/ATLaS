import Link from "next/link";
import { Check, ChevronRight, Star, type LucideIcon } from "lucide-react";
import { storePath } from "@/lib/store-path";

/**
 * Shared storefront page chrome.
 *
 * Storefront pages inherit the merchant theme through `--store-*` CSS variables
 * (set on the layout). These primitives keep spacing, cards, headings and
 * actions consistent across shop, product, cart, checkout, order and account
 * screens without hard-coding any one theme's colours.
 */

export type Crumb = { label: string; href?: string };

export function StoreBreadcrumb({ slug, items }: { slug: string; items: Crumb[] }) {
  return (
    <nav aria-label="Breadcrumb" className="muted flex flex-wrap items-center gap-1.5 text-[11px]">
      {items.map((item, index) => (
        <span key={`${item.label}-${index}`} className="flex items-center gap-1.5">
          {index > 0 ? <ChevronRight className="h-3 w-3 opacity-40" /> : null}
          {item.href ? (
            <Link href={storePath(slug, item.href)} className="transition hover:opacity-70">
              {item.label}
            </Link>
          ) : (
            <span className="font-medium opacity-80" style={{ color: "var(--store-text)" }}>
              {item.label}
            </span>
          )}
        </span>
      ))}
    </nav>
  );
}

export function PageIntro({
  eyebrow,
  title,
  subtitle,
  actions,
  className = "",
}: {
  eyebrow?: string;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`mt-5 flex flex-wrap items-end justify-between gap-4 ${className}`}>
      <div className="min-w-0">
        {eyebrow ? (
          <p
            className="text-[10px] font-semibold tracking-[0.22em] uppercase"
            style={{ color: "var(--store-primary)" }}
          >
            {eyebrow}
          </p>
        ) : null}
        <h1 className="mt-1.5 text-2xl leading-tight font-semibold tracking-tight sm:text-[2rem]">
          {title}
        </h1>
        {subtitle ? (
          <p className="muted mt-1.5 max-w-2xl text-sm leading-relaxed">{subtitle}</p>
        ) : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}

export function SectionHeading({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow?: string;
  title: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div>
        {eyebrow ? (
          <p
            className="text-[10px] font-semibold tracking-[0.2em] uppercase"
            style={{ color: "var(--store-primary)" }}
          >
            {eyebrow}
          </p>
        ) : null}
        <h2 className="mt-1 text-xl font-semibold tracking-tight sm:text-2xl">{title}</h2>
        {description ? <p className="muted mt-1 text-xs">{description}</p> : null}
      </div>
      {action}
    </div>
  );
}

export function Surface({
  className = "",
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={`rounded-2xl border border-black/[0.07] bg-white shadow-[0_2px_14px_-10px_rgba(15,23,42,0.35)] ${className}`}
    >
      {children}
    </div>
  );
}

export function PrimaryLink({
  href,
  children,
  className = "",
}: {
  href: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Link
      href={href}
      className={`store-btn inline-flex items-center justify-center gap-2 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition duration-200 hover:-translate-y-0.5 hover:brightness-110 ${className}`}
      style={{ background: "var(--store-primary)", boxShadow: "0 12px 24px -18px var(--store-primary)" }}
    >
      {children}
    </Link>
  );
}

export function OutlineLink({
  href,
  children,
  className = "",
}: {
  href: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Link
      href={href}
      className={`store-btn inline-flex items-center justify-center gap-2 border border-black/15 bg-white px-5 py-2.5 text-sm font-semibold transition duration-200 hover:-translate-y-0.5 hover:border-black/30 hover:bg-black/[0.02] ${className}`}
    >
      {children}
    </Link>
  );
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <Surface className="mx-auto max-w-lg px-6 py-12 text-center">
      <span
        className="mx-auto grid h-12 w-12 place-items-center rounded-2xl"
        style={{ background: "color-mix(in srgb, var(--store-primary) 10%, white)", color: "var(--store-primary)" }}
      >
        <Icon className="h-5 w-5" strokeWidth={1.8} />
      </span>
      <h2 className="mt-4 text-lg font-semibold">{title}</h2>
      <p className="muted mx-auto mt-1.5 max-w-sm text-sm leading-relaxed">{description}</p>
      {action ? <div className="mt-6 flex justify-center">{action}</div> : null}
    </Surface>
  );
}

export function CheckoutSteps({ current }: { current: 1 | 2 | 3 }) {
  const steps = ["কার্ট", "চেকআউট", "নিশ্চিত"];
  return (
    <ol className="mt-5 flex items-center gap-2 text-[11px] font-medium">
      {steps.map((label, index) => {
        const number = index + 1;
        const done = number < current;
        const active = number === current;
        return (
          <li key={label} className="flex flex-1 items-center gap-2 sm:flex-none">
            <span
              className="grid h-6 w-6 shrink-0 place-items-center rounded-full border text-[10px] font-bold"
              style={
                done || active
                  ? {
                      background: "var(--store-primary)",
                      borderColor: "var(--store-primary)",
                      color: "#fff",
                    }
                  : { borderColor: "rgba(0,0,0,0.14)", color: "rgba(0,0,0,0.45)" }
              }
            >
              {done ? <Check className="h-3 w-3" /> : number}
            </span>
            <span className={active ? "font-semibold" : "muted"}>{label}</span>
            {index < steps.length - 1 ? (
              <span className="mx-1 hidden h-px w-10 bg-black/10 sm:block" aria-hidden="true" />
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}

export function RatingStars({
  rating,
  size = 14,
  className = "",
}: {
  rating: number;
  size?: number;
  className?: string;
}) {
  return (
    <span className={`inline-flex items-center gap-0.5 ${className}`} aria-label={`${rating} / 5`}>
      {Array.from({ length: 5 }).map((_, index) => (
        <Star
          key={index}
          style={{ width: size, height: size }}
          className={index < Math.round(rating) ? "fill-amber-400 text-amber-400" : "text-black/15"}
        />
      ))}
    </span>
  );
}

export function TrustStrip({ items }: { items: string[] }) {
  if (!items.length) return null;
  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
      {items.slice(0, 3).map((item) => (
        <span key={item} className="muted inline-flex items-center gap-1.5 text-[11px]">
          <span
            className="h-1.5 w-1.5 rounded-full"
            style={{ background: "var(--store-primary)" }}
          />
          {item}
        </span>
      ))}
    </div>
  );
}
