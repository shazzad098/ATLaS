import Link from "next/link";
import {
  CheckCircle2,
  Mail,
  Menu,
  Phone,
  RefreshCw,
  Search,
  ShieldCheck,
  ShoppingBag,
  Star,
  Store,
  Truck,
  UserRound,
} from "lucide-react";
import { formatBdt } from "@/lib/money";
import { storePath } from "@/lib/store-path";
import { ProductImage } from "@/components/product-image";
import type {
  CategoryGridProps,
  HeroProps,
  ProductCardProps,
  ProductGridProps,
  SectionProps,
  SectionVariant,
} from "@/themes/types";

/**
 * Section kit.
 *
 * One implementation of the eight-section contract, parameterised by a
 * `SectionVariant`. Each theme in `src/themes/index.ts` binds a variant, so the
 * themes stay visually distinct without three copies of the same markup.
 *
 * The `editorial` variant (Nokshi) gets a boutique layout: serif display type,
 * a product-image hero collage, framed product cards and quieter trust marks.
 */

const TRUST_ICONS = [Truck, ShieldCheck, RefreshCw, Store] as const;

function columnsClass(variant: SectionVariant, columns: 3 | 4): string {
  if (variant === "dense") {
    return "grid grid-cols-2 gap-3 @md:grid-cols-3 @lg:grid-cols-4 @xl:grid-cols-5";
  }
  if (variant === "minimal") {
    return "grid grid-cols-2 gap-4 @md:grid-cols-3 @lg:grid-cols-4";
  }
  return columns === 3
    ? "grid grid-cols-2 gap-5 @md:grid-cols-3"
    : "grid grid-cols-2 gap-5 @md:grid-cols-3 @lg:grid-cols-4";
}

// ── Header ───────────────────────────────────────────────────────────────────

function AccountLink({ ctx, className = "" }: SectionProps & { className?: string }) {
  if (!ctx.account) return null;
  const label = ctx.account.signedIn ? "আমার অ্যাকাউন্ট" : "লগইন";
  return (
    <Link href={ctx.account.href} className={className} aria-label={label}>
      <UserRound className="h-4 w-4" />
      <span className="hidden @md:inline">{label}</span>
    </Link>
  );
}

export function Header({
  ctx,
  variant,
}: SectionProps & { variant: SectionVariant }) {
  const editorial = variant === "editorial";
  const hasAnnouncement = Boolean(ctx.announcement);
  const centered = ctx.config.header.style === "centered";
  const searchEnabled = ctx.config.header.showSearch;

  if (variant === "dense") {
    return (
      <header className="sticky top-0 z-40 border-b border-black/10 bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
        {hasAnnouncement ? (
          <div
            className="px-4 py-2 text-center text-[11px] font-medium tracking-wide text-white @sm:text-xs"
            style={{ background: "var(--store-primary)" }}
          >
            {ctx.announcement}
          </div>
        ) : null}

        <div className="atlas-shell flex items-center gap-3 py-3">
          <Link
            href={storePath(ctx.slug)}
            className="flex min-w-0 items-center gap-2.5"
            aria-label={ctx.storeName}
          >
            <span
              className="grid h-10 w-10 shrink-0 place-items-center rounded-[var(--store-button-radius)] text-base font-bold text-white shadow-sm"
              style={{ background: "var(--store-primary)" }}
            >
              {ctx.storeName.trim().charAt(0)}
            </span>
            <span className="min-w-0">
              <span
                className="block truncate text-lg leading-tight font-bold tracking-tight"
                style={{ color: "var(--store-text)" }}
              >
                {ctx.storeName}
              </span>
              {ctx.tagline ? (
                <span className="muted mt-0.5 hidden truncate text-[10px] font-medium tracking-wide @sm:block">
                  {ctx.tagline}
                </span>
              ) : null}
            </span>
          </Link>

          {searchEnabled ? (
            <form
              action={storePath(ctx.slug, "/shop")}
              className="relative mx-auto hidden max-w-lg flex-1 items-center @md:flex"
            >
              <Search className="muted pointer-events-none absolute left-3.5 h-4 w-4" />
              <input
                type="search"
                name="q"
                placeholder="সবজি, মাছ, মুদি — যা খুঁজছেন"
                className="h-10 w-full rounded-[var(--store-button-radius)] border border-black/10 bg-[var(--store-surface)] pr-24 pl-10 text-sm outline-none transition focus:border-[var(--store-primary)] focus:bg-white focus:ring-2 focus:ring-black/5"
              />
              <button
                type="submit"
                className="absolute right-1 h-8 rounded-[var(--store-button-radius)] px-4 text-xs font-semibold text-white transition hover:brightness-110"
                style={{ background: "var(--store-primary)" }}
              >
                খুঁজুন
              </button>
            </form>
          ) : (
            <div className="ml-auto" />
          )}

          <AccountLink
            ctx={ctx}
            className="ml-auto inline-flex h-10 shrink-0 items-center gap-1.5 rounded-[var(--store-button-radius)] border border-black/10 px-3 text-sm font-medium"
          />

          <Link
            href={storePath(ctx.slug, "/cart")}
            className="ml-auto inline-flex h-10 shrink-0 items-center gap-2 rounded-[var(--store-button-radius)] px-3.5 text-sm font-semibold text-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md @sm:px-4"
            style={{ background: "var(--store-primary)" }}
            aria-label="কার্ট"
          >
            <ShoppingBag className="h-4 w-4" />
            <span className="hidden @md:inline">কার্ট</span>
          </Link>
        </div>

        <nav
          className="border-t border-black/5"
          style={{ background: "var(--store-surface)" }}
        >
          <div className="atlas-shell flex gap-1 overflow-x-auto py-1.5 no-scrollbar">
            {ctx.navigation.map(link => (
              <Link
                key={`${link.label}-${link.href}`}
                href={storePath(ctx.slug, link.href)}
                className="muted rounded-[var(--store-button-radius)] px-3 py-2 text-sm font-medium whitespace-nowrap transition hover:bg-white hover:text-[var(--store-primary)] hover:shadow-sm"
              >
                {link.label}
              </Link>
            ))}
          </div>
        </nav>

        {searchEnabled ? (
          <form
            action={storePath(ctx.slug, "/shop")}
            className="atlas-shell relative flex items-center pb-3 @md:hidden"
          >
            <Search className="muted pointer-events-none absolute left-3.5 h-4 w-4" />
            <input
              type="search"
              name="q"
              placeholder="পণ্য খুঁজুন…"
              className="h-10 w-full rounded-[var(--store-button-radius)] border border-black/10 bg-[var(--store-surface)] pr-20 pl-10 text-sm outline-none focus:border-[var(--store-primary)] focus:bg-white"
            />
            <button
              type="submit"
              className="absolute right-1.5 h-7 rounded-[var(--store-button-radius)] px-3 text-[11px] font-semibold text-white"
              style={{ background: "var(--store-primary)" }}
            >
              খুঁজুন
            </button>
          </form>
        ) : null}
      </header>
    );
  }

  if (variant === "minimal") {
    return (
      <header className="sticky top-0 z-40 border-b border-black/10 bg-white/95 backdrop-blur">
        <div className="atlas-shell flex h-16 items-center gap-3">
          <Link
            href={storePath(ctx.slug)}
            className="flex min-w-0 items-center gap-2.5"
            aria-label={ctx.storeName}
          >
            <span
              className="grid h-9 w-9 shrink-0 place-items-center rounded-[var(--store-button-radius)] text-sm font-bold text-white"
              style={{ background: "var(--store-primary)" }}
            >
              {ctx.storeName.trim().charAt(0)}
            </span>
            <span className="min-w-0">
              <span
                className="block truncate text-base font-semibold tracking-tight @sm:text-lg"
                style={{ color: "var(--store-text)" }}
              >
                {ctx.storeName}
              </span>
              {ctx.tagline ? (
                <span className="muted mt-0.5 hidden max-w-56 truncate text-[9px] font-medium tracking-[0.14em] uppercase @sm:block">
                  {ctx.tagline}
                </span>
              ) : null}
            </span>
          </Link>

          {searchEnabled ? (
            <form
              action={storePath(ctx.slug, "/shop")}
              className="relative ml-auto hidden max-w-xs flex-1 items-center @md:flex"
            >
              <Search className="muted pointer-events-none absolute left-3 h-3.5 w-3.5" />
              <input
                type="search"
                name="q"
                placeholder="পণ্য খুঁজুন…"
                className="h-9 w-full rounded-[var(--store-button-radius)] border border-black/10 bg-[var(--store-surface)] pr-16 pl-9 text-xs outline-none transition focus:border-[var(--store-primary)] focus:bg-white"
              />
              <button
                type="submit"
                className="absolute right-1 rounded-[var(--store-button-radius)] px-2.5 py-1 text-[10px] font-semibold text-white"
                style={{ background: "var(--store-primary)" }}
              >
                খুঁজুন
              </button>
            </form>
          ) : null}

          <AccountLink
            ctx={ctx}
            className="ml-1 inline-flex h-9 shrink-0 items-center gap-1.5 rounded-[var(--store-button-radius)] border border-black/10 px-3 text-xs font-medium"
          />

          <Link
            href={storePath(ctx.slug, "/cart")}
            className="ml-auto inline-flex h-9 shrink-0 items-center gap-2 rounded-[var(--store-button-radius)] px-3 text-xs font-semibold text-white transition hover:-translate-y-0.5 hover:shadow-md @md:ml-0 @md:px-3.5"
            style={{ background: "var(--store-primary)" }}
            aria-label="কার্ট"
          >
            <ShoppingBag className="h-3.5 w-3.5" />
            <span className="hidden @md:inline">কার্ট</span>
          </Link>
        </div>

        <nav className="border-t border-black/5">
          <div className="atlas-shell flex gap-6 overflow-x-auto py-2.5 text-xs font-medium no-scrollbar @md:justify-center">
            {ctx.navigation.map(link => (
              <Link
                key={`${link.label}-${link.href}`}
                href={storePath(ctx.slug, link.href)}
                className="muted whitespace-nowrap transition-colors hover:text-[var(--store-text)]"
              >
                {link.label}
              </Link>
            ))}
          </div>
        </nav>

        {searchEnabled ? (
          <form
            action={storePath(ctx.slug, "/shop")}
            className="atlas-shell relative flex items-center border-t border-black/5 py-2 @md:hidden"
          >
            <Search className="muted pointer-events-none absolute left-3 h-3.5 w-3.5" />
            <input
              type="search"
              name="q"
              placeholder="পণ্য খুঁজুন…"
              className="h-9 w-full rounded-[var(--store-button-radius)] border border-black/10 bg-[var(--store-surface)] pr-16 pl-9 text-xs outline-none focus:border-[var(--store-primary)] focus:bg-white"
            />
            <button
              type="submit"
              className="absolute right-1 rounded-[var(--store-button-radius)] px-2.5 py-1 text-[10px] font-semibold text-white"
              style={{ background: "var(--store-primary)" }}
            >
              খুঁজুন
            </button>
          </form>
        ) : null}
      </header>
    );
  }

  return (
    <header className="store-surface sticky top-0 z-40 border-b border-black/5">
      {hasAnnouncement ? (
        <div
          className={
            editorial
              ? "px-4 py-2 text-center text-[11px] tracking-[0.14em] text-white"
              : "px-4 py-2 text-center text-xs font-medium text-white @sm:text-sm"
          }
          style={{ background: "var(--store-primary)" }}
        >
          {ctx.announcement}
        </div>
      ) : null}

      <div
        className={`atlas-shell flex items-center gap-3 ${editorial ? "py-4" : "py-3"}`}
      >
        <Link
          href={storePath(ctx.slug)}
          className={`flex min-w-0 items-center gap-2.5 ${centered ? "mx-auto" : ""}`}
          aria-label={ctx.storeName}
        >
          <span
            className={`grid shrink-0 place-items-center font-bold text-white ${
              editorial
                ? "h-10 w-10 rounded-full text-base ring-2 ring-white/25"
                : "h-9 w-9 rounded-lg text-sm"
            }`}
            style={{ background: "var(--store-primary)" }}
          >
            {ctx.storeName.trim().charAt(0)}
          </span>
          <span className="min-w-0">
            <span
              className={`block truncate ${
                editorial
                  ? "font-serif text-xl font-semibold tracking-tight @sm:text-2xl"
                  : "text-lg font-semibold"
              }`}
              style={{ color: "var(--store-text)" }}
            >
              {ctx.storeName}
            </span>
            {editorial && ctx.tagline ? (
              <span className="muted mt-0.5 hidden truncate text-[9px] font-medium tracking-[0.22em] uppercase @sm:block">
                {ctx.tagline}
              </span>
            ) : null}
          </span>
        </Link>

        {searchEnabled && !centered ? (
          editorial ? (
            <form
              action={storePath(ctx.slug, "/shop")}
              className="relative ml-auto hidden max-w-md flex-1 items-center @md:flex"
            >
              <Search className="muted pointer-events-none absolute left-3.5 h-4 w-4" />
              <input
                type="search"
                name="q"
                placeholder="পণ্য খুঁজুন…"
                className="w-full rounded-full border border-black/10 bg-transparent py-2 pr-20 pl-10 text-sm outline-none transition focus:border-black/30"
              />
              <button
                type="submit"
                className="absolute right-1 rounded-full px-3.5 py-1.5 text-[11px] font-semibold text-white"
                style={{ background: "var(--store-primary)" }}
              >
                খুঁজুন
              </button>
            </form>
          ) : (
            <form
              action={storePath(ctx.slug, "/shop")}
              className="ml-auto hidden max-w-sm flex-1 items-center gap-2 rounded-full border border-black/10 px-3 py-1.5 @md:flex"
            >
              <input
                type="search"
                name="q"
                placeholder="পণ্য খুঁজুন…"
                className="w-full bg-transparent text-sm outline-none"
              />
              <button
                type="submit"
                className="text-xs font-semibold"
                style={{ color: "var(--store-primary)" }}
              >
                খুঁজুন
              </button>
            </form>
          )
        ) : (
          <div className="ml-auto" />
        )}

        <AccountLink
          ctx={ctx}
          className={`store-btn ml-auto inline-flex items-center gap-1.5 border border-black/10 font-medium ${
            editorial ? "px-4 py-2 text-sm" : "px-3 py-1.5 text-sm"
          }`}
        />

        <Link
          href={storePath(ctx.slug, "/cart")}
          className={`store-btn inline-flex items-center gap-1.5 border border-black/10 font-medium ${
            editorial ? "px-4 py-2 text-sm" : "px-3 py-1.5 text-sm"
          }`}
          aria-label="কার্ট"
        >
          <ShoppingBag className="h-4 w-4" />
          <span className="hidden @md:inline">কার্ট</span>
        </Link>
      </div>

      <nav
        className={`atlas-shell flex overflow-x-auto text-sm no-scrollbar ${
          editorial
            ? "gap-5 pb-3 @sm:gap-7"
            : `gap-1 pb-2 ${centered ? "justify-center" : ""}`
        } ${editorial && centered ? "justify-center" : ""}`}
      >
        {ctx.navigation.map(link => (
          <Link
            key={`${link.label}-${link.href}`}
            href={storePath(ctx.slug, link.href)}
            className={
              editorial
                ? "whitespace-nowrap border-b border-transparent py-1 text-[13px] tracking-wide transition-colors hover:border-current"
                : "whitespace-nowrap rounded-full px-3 py-1.5 hover:tone-surface"
            }
          >
            {link.label}
          </Link>
        ))}
      </nav>
    </header>
  );
}

// ── Hero ─────────────────────────────────────────────────────────────────────

export function Hero({
  ctx,
  variant,
  featured,
}: HeroProps & { variant: SectionVariant }) {
  const { hero } = ctx.config;
  if (!hero.enabled) return null;

  if (variant === "editorial") {
    const picks = (featured ?? [])
      .flatMap(product =>
        product.imageUrl ? [{ ...product, imageUrl: product.imageUrl }] : []
      )
      .slice(0, 3);

    const tile = (
      product: (typeof picks)[number] | undefined,
      slot: "main" | "small",
      index: number
    ) => {
      const span =
        slot === "main" ? "col-span-3 row-span-2" : "col-span-2 row-span-1";

      if (!product) {
        return (
          <div
            key={`${slot}-${index}`}
            className={`${span} grid place-items-center overflow-hidden rounded-2xl border border-black/5`}
            style={{
              background: `linear-gradient(135deg, ${ctx.config.colors.primary}12, ${ctx.config.colors.accent}22)`,
            }}
          >
            <span
              className="font-serif text-3xl opacity-25"
              style={{ color: "var(--store-primary)" }}
            >
              {ctx.storeName.trim().charAt(0)}
            </span>
          </div>
        );
      }

      return (
        <Link
          key={product.id}
          href={storePath(ctx.slug, `/product/${product.slug}`)}
          className={`${span} group relative overflow-hidden rounded-2xl ring-1 ring-black/5`}
        >
          <ProductImage
            src={product.imageUrl}
            alt={product.name}
            loading="eager"
            className="h-full w-full object-cover transition duration-700 group-hover:scale-105"
          />
          <span className="absolute inset-0 bg-gradient-to-t from-black/50 via-black/0 to-black/0" />
          <span className="absolute inset-x-0 bottom-0 flex flex-wrap items-end justify-between gap-2 p-3">
            <span className="text-xs font-medium text-white/90">
              {product.name}
            </span>
            {slot === "main" ? (
              <span
                className="rounded-full bg-white/95 px-2.5 py-0.5 text-[10px] font-semibold"
                style={{ color: "var(--store-primary)" }}
              >
                {formatBdt(product.priceFrom)}
              </span>
            ) : null}
          </span>
        </Link>
      );
    };

    return (
      <section className="store-surface relative overflow-hidden">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0"
        >
          <div
            className="absolute -top-32 -right-24 h-80 w-80 rounded-full opacity-20 blur-3xl"
            style={{ background: "var(--store-primary)" }}
          />
          <div
            className="absolute -bottom-32 -left-24 h-80 w-80 rounded-full opacity-10 blur-3xl"
            style={{ background: "var(--store-accent)" }}
          />
          <div
            className="absolute inset-0 opacity-40"
            style={{
              backgroundImage:
                "radial-gradient(rgba(0,0,0,0.07) 1px, transparent 1px)",
              backgroundSize: "22px 22px",
              maskImage:
                "radial-gradient(ellipse at center, black, transparent 74%)",
            }}
          />
        </div>

        <div className="atlas-shell relative grid items-center gap-10 py-12 @sm:py-16 @lg:grid-cols-[1.02fr_0.98fr] @lg:gap-14">
          <div className="max-w-xl">
            <p
              className="animate-fade-up text-[11px] font-semibold tracking-[0.24em] uppercase"
              style={{ color: "var(--store-primary)" }}
            >
              {ctx.tagline ?? ctx.storeName}
            </p>
            <h1
              className="animate-fade-up mt-3 font-serif text-4xl leading-[1.12] font-semibold tracking-tight @sm:text-5xl @lg:text-[3.35rem]"
              style={{ animationDelay: "70ms", color: "var(--store-text)" }}
            >
              {hero.title}
            </h1>
            <p
              className="animate-fade-up muted mt-4 text-base leading-relaxed"
              style={{ animationDelay: "140ms" }}
            >
              {hero.subtitle}
            </p>

            <div
              className="animate-fade-up mt-7 flex flex-wrap items-center gap-3"
              style={{ animationDelay: "210ms" }}
            >
              <Link
                href={storePath(ctx.slug, hero.ctaHref)}
                className="store-btn px-6 py-3 text-sm font-semibold text-white transition duration-300 hover:-translate-y-0.5"
                style={{
                  background: "var(--store-primary)",
                  boxShadow: `0 18px 38px -22px ${ctx.config.colors.primary}`,
                }}
              >
                {hero.ctaLabel}
              </Link>
              <Link
                href={storePath(ctx.slug, "/shop")}
                className="store-btn inline-flex items-center gap-2 border border-black/15 px-5 py-3 text-sm font-semibold transition hover:bg-black/[0.03]"
              >
                সব পণ্য দেখুন
                <span aria-hidden="true">→</span>
              </Link>
            </div>

            {ctx.config.trust.enabled && ctx.config.trust.items.length ? (
              <div
                className="animate-fade-up mt-8 flex flex-wrap gap-x-5 gap-y-2"
                style={{ animationDelay: "280ms" }}
              >
                {ctx.config.trust.items.slice(0, 3).map(item => (
                  <span
                    key={item}
                    className="muted inline-flex items-center gap-1.5 text-[11px]"
                  >
                    <span
                      className="h-1 w-1 rounded-full"
                      style={{ background: "var(--store-primary)" }}
                    />
                    {item}
                  </span>
                ))}
              </div>
            ) : null}
          </div>

          <div className="relative mx-auto w-full max-w-md @lg:max-w-none">
            <div
              aria-hidden="true"
              className="absolute -inset-3 rounded-[2rem]"
              style={{ background: "var(--store-surface)" }}
            />
            <div className="relative grid h-72 grid-cols-5 grid-rows-2 gap-2.5 @sm:h-96 @lg:h-[27rem]">
              {tile(picks[0], "main", 0)}
              {tile(picks[1], "small", 1)}
              {tile(picks[2], "small", 2)}
            </div>
            <div className="absolute -bottom-4 left-4 flex items-center gap-2 rounded-full border border-black/10 bg-white px-4 py-2 shadow-lg">
              <span
                className="h-1.5 w-1.5 rounded-full"
                style={{ background: "var(--store-accent)" }}
              />
              <span className="text-[11px] font-semibold">হাতে বাছাই করা</span>
            </div>
          </div>
        </div>
      </section>
    );
  }

  if (variant === "dense") {
    const picks = (featured ?? [])
      .flatMap(product =>
        product.imageUrl ? [{ ...product, imageUrl: product.imageUrl }] : []
      )
      .slice(0, 2);
    const [main, second] = picks;

    return (
      <section
        className="relative overflow-hidden border-b border-black/5"
        style={{
          background: `linear-gradient(165deg, ${ctx.config.colors.surface} 0%, #ffffff 62%)`,
        }}
      >
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0"
        >
          <div
            className="absolute -top-24 right-0 h-72 w-72 rounded-full opacity-[0.09] blur-3xl"
            style={{ background: "var(--store-primary)" }}
          />
          <div
            className="absolute -bottom-24 left-0 h-64 w-64 rounded-full opacity-[0.08] blur-3xl"
            style={{ background: "var(--store-accent)" }}
          />
        </div>

        <div className="atlas-shell relative grid items-center gap-8 py-10 @sm:py-12 @lg:grid-cols-[1.05fr_0.95fr] @lg:gap-12 @lg:py-14">
          <div className="max-w-xl">
            <span
              className="animate-fade-up inline-flex items-center gap-2 rounded-full border border-black/10 bg-white px-3 py-1 text-[11px] font-semibold shadow-sm"
              style={{ color: "var(--store-primary)" }}
            >
              <span
                className="atlas-pulse-dot h-1.5 w-1.5 rounded-full"
                style={{ background: "var(--store-accent)" }}
              />
              {ctx.tagline ?? "প্রতিদিন টাটকা বাজার"}
            </span>

            <h1 className="animate-fade-up mt-4 text-3xl leading-[1.15] font-bold tracking-tight @sm:text-4xl @lg:text-[2.9rem]">
              {hero.title}
            </h1>
            <p
              className="animate-fade-up muted mt-3 max-w-lg text-base leading-relaxed"
              style={{ animationDelay: "90ms" }}
            >
              {hero.subtitle}
            </p>

            <div
              className="animate-fade-up mt-6 flex flex-wrap items-center gap-3"
              style={{ animationDelay: "180ms" }}
            >
              <Link
                href={storePath(ctx.slug, hero.ctaHref)}
                className="inline-flex h-11 items-center gap-2 rounded-[var(--store-button-radius)] px-6 text-sm font-semibold text-white shadow-sm transition hover:-translate-y-0.5 hover:brightness-110 hover:shadow-md"
                style={{ background: "var(--store-primary)" }}
              >
                {hero.ctaLabel}
                <span aria-hidden="true">→</span>
              </Link>
              <Link
                href={storePath(ctx.slug, "/shop")}
                className="inline-flex h-11 items-center gap-2 rounded-[var(--store-button-radius)] border border-black/15 bg-white px-5 text-sm font-semibold transition hover:border-black/30 hover:bg-black/[0.02]"
              >
                ক্যাটাগরি দেখুন
              </Link>
            </div>

            {ctx.config.trust.enabled && ctx.config.trust.items.length ? (
              <div
                className="animate-fade-up mt-6 flex flex-wrap gap-x-5 gap-y-2 border-t border-black/10 pt-4"
                style={{ animationDelay: "270ms" }}
              >
                {ctx.config.trust.items.slice(0, 3).map(item => (
                  <span
                    key={item}
                    className="muted inline-flex items-center gap-1.5 text-xs font-medium"
                  >
                    <CheckCircle2
                      className="h-3.5 w-3.5"
                      style={{ color: "var(--store-primary)" }}
                    />
                    {item}
                  </span>
                ))}
              </div>
            ) : null}
          </div>

          <div
            className="animate-fade-up relative mx-auto w-full max-w-md @lg:max-w-none"
            style={{ animationDelay: "120ms" }}
          >
            <div className="grid h-72 grid-cols-2 grid-rows-2 gap-3 @sm:h-80 @lg:h-[25rem]">
              <Link
                href={
                  main
                    ? storePath(ctx.slug, `/product/${main.slug}`)
                    : storePath(ctx.slug, "/shop")
                }
                className="group relative row-span-2 overflow-hidden rounded-xl ring-1 ring-black/5"
              >
                {main ? (
                  <ProductImage
                    src={main.imageUrl}
                    alt={main.name}
                    loading="eager"
                    className="h-full w-full object-cover transition duration-700 group-hover:scale-105"
                  />
                ) : (
                  <span
                    className="grid h-full w-full place-items-center"
                    style={{
                      background: `linear-gradient(135deg, ${ctx.config.colors.primary}18, ${ctx.config.colors.accent}26)`,
                    }}
                  >
                    <span
                      className="font-serif text-5xl opacity-20"
                      style={{ color: "var(--store-primary)" }}
                    >
                      {ctx.storeName.trim().charAt(0)}
                    </span>
                  </span>
                )}
                <span
                  className="absolute top-2.5 left-2.5 rounded-md bg-white/95 px-2 py-0.5 text-[10px] font-bold shadow-sm"
                  style={{ color: "var(--store-primary)" }}
                >
                  আজকের স্টক
                </span>
                {main ? (
                  <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent p-3">
                    <span className="block text-xs font-medium text-white/90">
                      {main.name}
                    </span>
                    <span
                      className="mt-1 inline-block rounded bg-white/95 px-2 py-0.5 text-[11px] font-bold"
                      style={{ color: "var(--store-primary)" }}
                    >
                      {formatBdt(main.priceFrom)}
                    </span>
                  </span>
                ) : null}
              </Link>

              <Link
                href={
                  second
                    ? storePath(ctx.slug, `/product/${second.slug}`)
                    : storePath(ctx.slug, "/shop")
                }
                className="group relative overflow-hidden rounded-xl ring-1 ring-black/5"
              >
                {second ? (
                  <ProductImage
                    src={second.imageUrl}
                    alt={second.name}
                    loading="eager"
                    className="h-full w-full object-cover transition duration-700 group-hover:scale-105"
                  />
                ) : (
                  <span
                    className="grid h-full w-full place-items-center"
                    style={{
                      background: `linear-gradient(135deg, ${ctx.config.colors.accent}22, ${ctx.config.colors.primary}12)`,
                    }}
                  >
                    <span
                      className="text-xs font-semibold opacity-40"
                      style={{ color: "var(--store-primary)" }}
                    >
                      {ctx.storeName}
                    </span>
                  </span>
                )}
                {second ? (
                  <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/55 to-transparent p-2.5">
                    <span className="block truncate text-[11px] font-medium text-white/90">
                      {second.name}
                    </span>
                  </span>
                ) : null}
              </Link>

              <div
                className="relative flex flex-col justify-between overflow-hidden rounded-xl p-4 text-white"
                style={{ background: "var(--store-primary)" }}
              >
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute -right-6 -bottom-8 h-24 w-24 rounded-full border border-white/20"
                />
                <Truck className="h-6 w-6" />
                <div className="relative">
                  <p className="text-[10px] font-semibold tracking-[0.18em] text-white/70 uppercase">
                    ডেলিভারি
                  </p>
                  <p className="mt-1 text-sm leading-snug font-semibold">
                    সকালের অর্ডার
                    <br />
                    সন্ধ্যায় পৌঁছে যাবে
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    );
  }

  if (variant === "minimal") {
    const withImages = (featured ?? []).flatMap(product =>
      product.imageUrl ? [{ ...product, imageUrl: product.imageUrl }] : []
    );
    // Prefer one product per category so the hero shows the range of the store
    // instead of three items from whichever category was saved last.
    const picks: typeof withImages = [];
    for (const product of withImages) {
      if (picks.length === 3) break;
      if (picks.some(pick => pick.categoryName === product.categoryName))
        continue;
      picks.push(product);
    }
    for (const product of withImages) {
      if (picks.length === 3) break;
      if (!picks.some(pick => pick.id === product.id)) picks.push(product);
    }
    const centered = hero.align === "center";

    return (
      <section className="store-surface relative overflow-hidden border-b border-black/10">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0"
        >
          <div
            className="absolute inset-0 opacity-50"
            style={{
              backgroundImage:
                "radial-gradient(rgba(15,23,42,0.08) 1px, transparent 1px)",
              backgroundSize: "20px 20px",
              maskImage:
                "radial-gradient(ellipse at 50% 0%, black, transparent 70%)",
            }}
          />
          <div
            className="absolute -top-32 left-1/2 h-72 w-72 -translate-x-1/2 rounded-full opacity-10 blur-3xl"
            style={{ background: "var(--store-primary)" }}
          />
        </div>

        <div
          className={`atlas-shell relative py-12 @sm:py-16 ${centered ? "text-center" : ""}`}
        >
          <div className={`max-w-3xl ${centered ? "mx-auto" : ""}`}>
            <span
              className="animate-fade-up inline-flex items-center gap-2 rounded-[var(--store-button-radius)] border border-black/10 bg-white px-3 py-1 text-[10px] font-semibold tracking-[0.18em] uppercase shadow-xs"
              style={{ color: "var(--store-primary)" }}
            >
              <span
                className="h-1.5 w-1.5 rounded-full"
                style={{ background: "var(--store-accent)" }}
              />
              নতুন কালেকশন
            </span>

            <h1
              className="animate-fade-up mt-5 text-4xl leading-[1.06] font-semibold tracking-tight @sm:text-5xl @lg:text-6xl"
              style={{ animationDelay: "70ms" }}
            >
              {hero.title}
            </h1>
            <p
              className="animate-fade-up muted mx-auto mt-4 max-w-xl text-sm leading-relaxed @sm:text-base"
              style={{ animationDelay: "140ms" }}
            >
              {hero.subtitle}
            </p>

            <div
              className={`animate-fade-up mt-7 flex flex-wrap items-center gap-3 ${
                centered ? "justify-center" : ""
              }`}
              style={{ animationDelay: "210ms" }}
            >
              <Link
                href={storePath(ctx.slug, hero.ctaHref)}
                className="inline-flex h-11 items-center gap-2 rounded-[var(--store-button-radius)] px-6 text-sm font-semibold text-white shadow-sm transition hover:-translate-y-0.5 hover:brightness-110 hover:shadow-md"
                style={{ background: "var(--store-primary)" }}
              >
                {hero.ctaLabel}
                <span aria-hidden="true">→</span>
              </Link>
              <Link
                href={storePath(ctx.slug, "/shop")}
                className="inline-flex h-11 items-center gap-2 rounded-[var(--store-button-radius)] border border-black/15 bg-white px-5 text-sm font-semibold transition hover:border-black/30 hover:bg-black/[0.02]"
              >
                সব পণ্য দেখুন
              </Link>
            </div>
          </div>

          {picks.length ? (
            <div
              className={`animate-fade-up mt-10 grid max-w-4xl grid-cols-2 gap-3 text-left @sm:grid-cols-3 ${
                centered ? "mx-auto" : ""
              }`}
              style={{ animationDelay: "280ms" }}
            >
              {picks.map((product, index) => (
                <Link
                  key={product.id}
                  href={storePath(ctx.slug, `/product/${product.slug}`)}
                  className={`group overflow-hidden rounded-[var(--store-button-radius)] border border-black/10 bg-white transition duration-300 hover:-translate-y-1 hover:border-black/25 hover:shadow-lg ${
                    index === 2 ? "col-span-2 @sm:col-span-1" : ""
                  }`}
                >
                  <div className="aspect-square overflow-hidden bg-[var(--store-surface)]">
                    <ProductImage
                      src={product.imageUrl}
                      alt={product.name}
                      loading="eager"
                      className="h-full w-full object-cover transition duration-700 group-hover:scale-105"
                    />
                  </div>
                  <div className="flex items-center justify-between gap-2 p-3">
                    <span className="min-w-0">
                      <span className="block truncate text-[11px] font-medium">
                        {product.name}
                      </span>
                      <span className="muted mt-0.5 block text-[10px]">
                        {formatBdt(product.priceFrom)}
                      </span>
                    </span>
                    <span
                      className="grid h-6 w-6 shrink-0 place-items-center rounded-[var(--store-button-radius)] border border-black/10 text-[10px] transition group-hover:border-transparent group-hover:bg-[var(--store-primary)] group-hover:text-white"
                      aria-hidden="true"
                    >
                      →
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          ) : null}

          {ctx.config.trust.enabled && ctx.config.trust.items.length ? (
            <div
              className={`animate-fade-up mt-8 flex flex-wrap items-center gap-x-6 gap-y-2 text-[11px] ${
                centered ? "justify-center" : ""
              }`}
              style={{ animationDelay: "340ms" }}
            >
              {ctx.config.trust.items.slice(0, 3).map(item => (
                <span
                  key={item}
                  className="muted inline-flex items-center gap-1.5"
                >
                  <CheckCircle2
                    className="h-3.5 w-3.5"
                    style={{ color: "var(--store-primary)" }}
                  />
                  {item}
                </span>
              ))}
            </div>
          ) : null}
        </div>
      </section>
    );
  }

  return null;
}

// ── Category grid ────────────────────────────────────────────────────────────

export function CategoryGrid({
  ctx,
  title,
  categories,
  variant,
}: CategoryGridProps & { variant: SectionVariant }) {
  if (categories.length === 0) return null;

  if (variant === "dense") {
    return (
      <section className="store-surface py-8">
        <div className="atlas-shell">
          <div className="mb-4 flex items-end justify-between gap-4">
            <div className="flex items-center gap-3">
              <span
                className="h-6 w-1 rounded-full"
                style={{ background: "var(--store-primary)" }}
                aria-hidden="true"
              />
              <h2 className="text-xl font-bold tracking-tight @sm:text-2xl">
                {title || "ক্যাটাগরি"}
              </h2>
            </div>
            <Link
              href={storePath(ctx.slug, "/shop")}
              className="group inline-flex items-center gap-1.5 text-sm font-semibold whitespace-nowrap"
              style={{ color: "var(--store-primary)" }}
            >
              সব পণ্য
              <span
                aria-hidden="true"
                className="transition-transform group-hover:translate-x-1"
              >
                →
              </span>
            </Link>
          </div>

          <div className="grid grid-cols-2 gap-3 @sm:grid-cols-3 @lg:grid-cols-6">
            {categories.map(category => (
              <Link
                key={category.id}
                href={storePath(ctx.slug, `/shop?category=${category.slug}`)}
                className="group flex items-center gap-3 rounded-[var(--store-button-radius)] border border-black/[0.08] bg-white p-3 transition duration-300 hover:-translate-y-0.5 hover:border-black/20 hover:shadow-md"
              >
                <span
                  className="grid h-11 w-11 shrink-0 place-items-center rounded-[var(--store-button-radius)] text-sm font-bold"
                  style={{
                    background: `${ctx.config.colors.primary}14`,
                    color: "var(--store-primary)",
                  }}
                >
                  {category.name.trim().charAt(0)}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold">
                    {category.name}
                  </span>
                  <span className="muted mt-0.5 block text-[11px]">
                    {category.productCount}টি পণ্য
                  </span>
                </span>
                <span
                  aria-hidden="true"
                  className="text-base opacity-40 transition duration-300 group-hover:translate-x-0.5 group-hover:opacity-100"
                  style={{ color: "var(--store-primary)" }}
                >
                  →
                </span>
              </Link>
            ))}

            <Link
              href={storePath(ctx.slug, "/shop")}
              className="group flex items-center justify-center gap-2 rounded-[var(--store-button-radius)] border border-dashed border-black/20 p-3 transition duration-300 hover:-translate-y-0.5 hover:border-[var(--store-primary)] hover:bg-white"
            >
              <span
                className="grid h-8 w-8 place-items-center rounded-full text-base font-semibold transition group-hover:scale-105"
                style={{
                  background: `${ctx.config.colors.primary}14`,
                  color: "var(--store-primary)",
                }}
                aria-hidden="true"
              >
                +
              </span>
              <span
                className="text-sm font-semibold"
                style={{ color: "var(--store-primary)" }}
              >
                সব ক্যাটাগরি
              </span>
            </Link>
          </div>
        </div>
      </section>
    );
  }

  if (variant === "editorial") {
    return (
      <section className="store-surface py-12 @sm:py-14">
        <div className="atlas-shell">
          <div className="flex flex-wrap items-end justify-between gap-4 border-b border-black/10 pb-4">
            <div>
              <p
                className="text-[10px] font-semibold tracking-[0.22em] uppercase"
                style={{ color: "var(--store-primary)" }}
              >
                ব্রাউজ করুন
              </p>
              <h2 className="mt-1 font-serif text-2xl font-semibold tracking-tight @sm:text-3xl">
                {title || "ক্যাটাগরি"}
              </h2>
            </div>
            <Link
              href={storePath(ctx.slug, "/shop")}
              className="group inline-flex items-center gap-1.5 text-sm font-semibold"
              style={{ color: "var(--store-primary)" }}
            >
              সব পণ্য
              <span
                aria-hidden="true"
                className="transition-transform group-hover:translate-x-1"
              >
                →
              </span>
            </Link>
          </div>

          <div className="mt-6 grid grid-cols-2 gap-3 @sm:grid-cols-3 @lg:grid-cols-4">
            {categories.map(category => (
              <Link
                key={category.id}
                href={storePath(ctx.slug, `/shop?category=${category.slug}`)}
                className="group relative overflow-hidden rounded-xl border border-black/10 p-4 transition duration-300 hover:-translate-y-0.5 hover:border-black/20 hover:shadow-lg"
              >
                <span
                  aria-hidden="true"
                  className="pointer-events-none absolute -right-2 -bottom-6 font-serif text-6xl opacity-[0.06] transition-opacity duration-300 group-hover:opacity-[0.12]"
                  style={{ color: "var(--store-primary)" }}
                >
                  {category.name.trim().charAt(0)}
                </span>
                <span className="relative flex items-center justify-between gap-2">
                  <span className="truncate text-sm font-semibold">
                    {category.name}
                  </span>
                  <span
                    aria-hidden="true"
                    className="opacity-0 transition duration-300 group-hover:translate-x-0.5 group-hover:opacity-100"
                    style={{ color: "var(--store-primary)" }}
                  >
                    →
                  </span>
                </span>
                <span className="muted relative mt-1 block text-[11px]">
                  {category.productCount}টি পণ্য
                </span>
                <span
                  className="relative mt-4 block h-px w-8 transition-all duration-300 group-hover:w-14"
                  style={{ background: "var(--store-primary)" }}
                />
              </Link>
            ))}
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="store-surface border-t border-black/5 py-12">
      <div className="atlas-shell">
        <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
          <div>
            <p
              className="text-[10px] font-semibold tracking-[0.2em] uppercase"
              style={{ color: "var(--store-primary)" }}
            >
              কালেকশন
            </p>
            <h2 className="mt-1 text-2xl font-semibold tracking-tight @sm:text-3xl">
              {title || "ক্যাটাগরি"}
            </h2>
          </div>
          <Link
            href={storePath(ctx.slug, "/shop")}
            className="group inline-flex items-center gap-1.5 text-xs font-semibold"
            style={{ color: "var(--store-primary)" }}
          >
            সব দেখুন
            <span
              aria-hidden="true"
              className="transition-transform group-hover:translate-x-1"
            >
              →
            </span>
          </Link>
        </div>

        <div className="grid grid-cols-2 gap-3 @sm:grid-cols-4">
          {categories.map((category, index) => (
            <Link
              key={category.id}
              href={storePath(ctx.slug, `/shop?category=${category.slug}`)}
              className="group relative flex flex-col justify-between overflow-hidden rounded-[var(--store-button-radius)] border border-black/10 bg-white p-4 transition duration-300 hover:-translate-y-0.5 hover:border-black/25 hover:shadow-sm @sm:p-5"
            >
              <span className="flex items-start justify-between gap-2">
                <span
                  className="font-mono text-[10px]"
                  style={{ color: "var(--store-muted)" }}
                >
                  {String(index + 1).padStart(2, "0")}
                </span>
                <span
                  aria-hidden="true"
                  className="text-xs opacity-0 transition duration-300 group-hover:translate-x-0.5 group-hover:opacity-100"
                  style={{ color: "var(--store-primary)" }}
                >
                  →
                </span>
              </span>
              <span className="mt-8">
                <span className="block truncate text-sm font-semibold">
                  {category.name}
                </span>
                <span className="muted mt-0.5 block text-[11px]">
                  {category.productCount}টি পণ্য
                </span>
              </span>
              <span
                aria-hidden="true"
                className="absolute inset-x-4 bottom-0 h-px origin-left scale-x-0 transition-transform duration-300 group-hover:scale-x-100"
                style={{ background: "var(--store-primary)" }}
              />
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}

// ── Product card ─────────────────────────────────────────────────────────────

export function ProductCard({
  ctx,
  product,
  variant,
}: ProductCardProps & { variant: SectionVariant }) {
  const discounted =
    product.comparePriceFrom !== null &&
    product.comparePriceFrom > product.priceFrom;

  if (variant === "dense") {
    return (
      <Link
        href={storePath(ctx.slug, `/product/${product.slug}`)}
        className="group flex flex-col overflow-hidden rounded-[var(--store-button-radius)] border border-black/[0.08] bg-white transition duration-300 hover:-translate-y-0.5 hover:border-black/15 hover:shadow-lg"
      >
        <div className="relative aspect-square overflow-hidden bg-[var(--store-surface)]">
          {product.imageUrl ? (
            <ProductImage
              src={product.imageUrl}
              alt={product.name}
              loading="lazy"
              className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
            />
          ) : (
            <div className="muted flex h-full items-center justify-center text-xs">
              ছবি নেই
            </div>
          )}

          {discounted ? (
            <span
              className="absolute top-2 left-2 rounded-md px-2 py-0.5 text-[10px] font-bold text-white shadow-sm"
              style={{ background: "var(--store-accent)" }}
            >
              ছাড়
            </span>
          ) : null}

          {!product.inStock ? (
            <span className="absolute inset-0 grid place-items-center bg-black/50 text-xs font-semibold text-white backdrop-blur-[1px]">
              স্টক নেই
            </span>
          ) : (
            <span
              className="absolute inset-x-2 bottom-2 hidden translate-y-2 items-center justify-center gap-1 rounded-[var(--store-button-radius)] bg-white/95 py-1.5 text-[11px] font-semibold opacity-0 shadow-sm transition duration-300 group-hover:translate-y-0 group-hover:opacity-100 @sm:flex"
              style={{ color: "var(--store-primary)" }}
            >
              বিস্তারিত দেখুন
              <span aria-hidden="true">→</span>
            </span>
          )}
        </div>

        <div className="flex flex-1 flex-col p-3">
          {product.categoryName ? (
            <span className="muted text-[10px] font-medium tracking-[0.12em] uppercase">
              {product.categoryName}
            </span>
          ) : null}
          <span className="mt-0.5 line-clamp-2 text-sm leading-snug font-medium">
            {product.name}
          </span>
          <span className="mt-auto flex flex-wrap items-baseline gap-x-2 pt-2">
            <span
              className="text-base font-bold"
              style={{ color: "var(--store-primary)" }}
            >
              {formatBdt(product.priceFrom)}
            </span>
            {discounted ? (
              <span className="muted text-[11px] line-through">
                {formatBdt(product.comparePriceFrom as number)}
              </span>
            ) : null}
          </span>
        </div>
      </Link>
    );
  }

  if (variant === "editorial") {
    return (
      <Link
        href={storePath(ctx.slug, `/product/${product.slug}`)}
        className="group flex flex-col"
      >
        <div className="relative aspect-4/5 overflow-hidden rounded-xl bg-[var(--store-surface)] ring-1 ring-black/5">
          {product.imageUrl ? (
            <ProductImage
              src={product.imageUrl}
              alt={product.name}
              loading="lazy"
              className="h-full w-full object-cover transition duration-700 group-hover:scale-105"
            />
          ) : (
            <div className="muted flex h-full items-center justify-center text-xs">
              ছবি নেই
            </div>
          )}

          <span className="absolute inset-0 bg-gradient-to-t from-black/40 via-black/0 to-black/0 opacity-0 transition-opacity duration-300 group-hover:opacity-100" />

          {discounted ? (
            <span
              className="absolute top-2.5 left-2.5 rounded-full px-2.5 py-0.5 text-[10px] font-bold text-white shadow-sm"
              style={{ background: "var(--store-accent)" }}
            >
              ছাড়
            </span>
          ) : null}

          {!product.inStock ? (
            <span className="absolute inset-0 grid place-items-center bg-black/50 text-sm font-semibold text-white">
              স্টক নেই
            </span>
          ) : (
            <span
              className="absolute inset-x-2.5 bottom-2.5 hidden translate-y-2 items-center justify-center gap-1.5 rounded-full bg-white/95 py-2 text-[11px] font-semibold opacity-0 shadow-sm transition duration-300 group-hover:translate-y-0 group-hover:opacity-100 @sm:flex"
              style={{ color: "var(--store-primary)" }}
            >
              বিস্তারিত দেখুন
              <span aria-hidden="true">→</span>
            </span>
          )}
        </div>

        <div className="mt-3 flex flex-1 flex-col">
          {product.categoryName ? (
            <span className="muted text-[10px] font-medium tracking-[0.16em] uppercase">
              {product.categoryName}
            </span>
          ) : null}
          <span className="mt-0.5 line-clamp-2 font-serif text-[15px] leading-snug font-medium">
            {product.name}
          </span>
          <span className="mt-auto flex items-baseline gap-2 pt-2">
            <span
              className="text-[15px] font-semibold"
              style={{ color: "var(--store-primary)" }}
            >
              {formatBdt(product.priceFrom)}
            </span>
            {discounted ? (
              <span className="muted text-xs line-through">
                {formatBdt(product.comparePriceFrom as number)}
              </span>
            ) : null}
          </span>
        </div>
      </Link>
    );
  }

  return (
    <Link
      href={storePath(ctx.slug, `/product/${product.slug}`)}
      className="group flex flex-col overflow-hidden rounded-[var(--store-button-radius)] border border-black/10 bg-white transition duration-300 hover:-translate-y-0.5 hover:border-black/25 hover:shadow-sm"
    >
      <div className="relative aspect-square overflow-hidden bg-[var(--store-surface)]">
        {product.imageUrl ? (
          <ProductImage
            src={product.imageUrl}
            alt={product.name}
            loading="lazy"
            className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]"
          />
        ) : (
          <div className="muted flex h-full items-center justify-center text-xs">
            ছবি নেই
          </div>
        )}

        {discounted ? (
          <span
            className="absolute top-2 left-2 rounded-[var(--store-button-radius)] px-1.5 py-0.5 text-[9px] font-semibold text-white"
            style={{ background: "var(--store-primary)" }}
          >
            ছাড়
          </span>
        ) : null}

        {!product.inStock ? (
          <span className="absolute inset-0 grid place-items-center bg-black/45 text-xs font-semibold text-white">
            স্টক নেই
          </span>
        ) : (
          <span
            aria-hidden="true"
            className="absolute right-2 bottom-2 grid h-7 w-7 translate-y-1 place-items-center rounded-[var(--store-button-radius)] border border-black/10 bg-white text-[10px] opacity-0 shadow-sm transition duration-300 group-hover:translate-y-0 group-hover:opacity-100"
            style={{ color: "var(--store-primary)" }}
          >
            →
          </span>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-1 p-3">
        {product.categoryName ? (
          <span className="muted text-[9px] font-medium tracking-[0.14em] uppercase">
            {product.categoryName}
          </span>
        ) : null}
        <span className="line-clamp-2 text-xs leading-snug font-medium @sm:text-[13px]">
          {product.name}
        </span>
        <span className="mt-auto flex flex-wrap items-baseline gap-x-2 pt-1.5">
          <span
            className="text-sm font-semibold"
            style={{ color: "var(--store-primary)" }}
          >
            {formatBdt(product.priceFrom)}
          </span>
          {discounted ? (
            <span className="muted text-[10px] line-through">
              {formatBdt(product.comparePriceFrom as number)}
            </span>
          ) : null}
        </span>
      </div>
    </Link>
  );
}

// ── Product grid ─────────────────────────────────────────────────────────────

export function ProductGrid({
  ctx,
  title,
  products,
  columns = 4,
  variant,
}: ProductGridProps & { variant: SectionVariant }) {
  if (products.length === 0) return null;

  if (variant === "dense") {
    return (
      <section className="py-8" style={{ background: "var(--store-surface)" }}>
        <div className="atlas-shell">
          <div className="mb-4 flex items-end justify-between gap-4">
            <div className="flex items-center gap-3">
              <span
                className="h-6 w-1 rounded-full"
                style={{ background: "var(--store-accent)" }}
                aria-hidden="true"
              />
              <h2 className="text-xl font-bold tracking-tight @sm:text-2xl">
                {title || "সব পণ্য"}
              </h2>
            </div>
            <Link
              href={storePath(ctx.slug, "/shop")}
              className="group inline-flex items-center gap-1.5 text-sm font-semibold whitespace-nowrap"
              style={{ color: "var(--store-primary)" }}
            >
              সব দেখুন
              <span
                aria-hidden="true"
                className="transition-transform group-hover:translate-x-1"
              >
                →
              </span>
            </Link>
          </div>

          <div className={columnsClass(variant, columns)}>
            {products.map(product => (
              <ProductCard
                key={product.id}
                ctx={ctx}
                product={product}
                variant={variant}
              />
            ))}
          </div>
        </div>
      </section>
    );
  }

  if (variant === "editorial") {
    return (
      <section className="store-surface py-12 @sm:py-14">
        <div className="atlas-shell">
          <div className="mb-7 flex flex-wrap items-end justify-between gap-4 border-b border-black/10 pb-4">
            <div>
              <p
                className="text-[10px] font-semibold tracking-[0.22em] uppercase"
                style={{ color: "var(--store-primary)" }}
              >
                নির্বাচিত
              </p>
              <h2 className="mt-1 font-serif text-2xl font-semibold tracking-tight @sm:text-3xl">
                {title || "আমাদের সংগ্রহ"}
              </h2>
            </div>
            <Link
              href={storePath(ctx.slug, "/shop")}
              className="group inline-flex items-center gap-1.5 text-sm font-semibold"
              style={{ color: "var(--store-primary)" }}
            >
              সব দেখুন
              <span
                aria-hidden="true"
                className="transition-transform group-hover:translate-x-1"
              >
                →
              </span>
            </Link>
          </div>

          <div className={columnsClass(variant, columns)}>
            {products.map(product => (
              <ProductCard
                key={product.id}
                ctx={ctx}
                product={product}
                variant={variant}
              />
            ))}
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="store-surface border-t border-black/5 py-12">
      <div className="atlas-shell">
        <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
          <div>
            <p
              className="text-[10px] font-semibold tracking-[0.2em] uppercase"
              style={{ color: "var(--store-primary)" }}
            >
              হাতে বাছাই
            </p>
            <h2 className="mt-1 text-2xl font-semibold tracking-tight @sm:text-3xl">
              {title || "আমাদের কালেকশন"}
            </h2>
          </div>
          <Link
            href={storePath(ctx.slug, "/shop")}
            className="group inline-flex items-center gap-1.5 text-xs font-semibold"
            style={{ color: "var(--store-primary)" }}
          >
            সব দেখুন
            <span
              aria-hidden="true"
              className="transition-transform group-hover:translate-x-1"
            >
              →
            </span>
          </Link>
        </div>
        <div className={columnsClass("minimal", columns)}>
          {products.map(product => (
            <ProductCard
              key={product.id}
              ctx={ctx}
              product={product}
              variant="minimal"
            />
          ))}
        </div>
      </div>
    </section>
  );
}

// ── Promo banner ─────────────────────────────────────────────────────────────

export function PromoBanner({
  ctx,
  variant,
}: SectionProps & { variant: SectionVariant }) {
  const { promo } = ctx.config;
  if (!promo.enabled || (!promo.title && !promo.body)) return null;

  if (variant === "dense") {
    return (
      <section className="atlas-shell py-8">
        <div
          className="relative overflow-hidden rounded-[var(--store-button-radius)] px-6 py-8 text-white @sm:px-9 @sm:py-10"
          style={{
            background: `linear-gradient(110deg, ${ctx.config.colors.primary} 0%, ${ctx.config.colors.accent} 100%)`,
          }}
        >
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -top-24 -right-10 h-56 w-56 rounded-full border border-white/20"
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -right-16 -bottom-28 h-56 w-56 rounded-full border border-white/15"
          />

          <div className="relative flex flex-col items-start gap-5 @sm:flex-row @sm:items-center @sm:justify-between">
            <div className="max-w-2xl">
              <span className="inline-flex rounded-full bg-white/15 px-2.5 py-0.5 text-[10px] font-semibold tracking-[0.16em] uppercase">
                বিশেষ অফার
              </span>
              <h3 className="mt-2 text-2xl font-bold tracking-tight @sm:text-3xl">
                {promo.title}
              </h3>
              {promo.body ? (
                <p className="mt-1.5 text-sm leading-relaxed text-white/85">
                  {promo.body}
                </p>
              ) : null}
            </div>
            {promo.ctaLabel ? (
              <Link
                href={storePath(ctx.slug, promo.ctaHref)}
                className="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-[var(--store-button-radius)] bg-white px-5 text-sm font-semibold shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
                style={{ color: ctx.config.colors.primary }}
              >
                {promo.ctaLabel}
                <span aria-hidden="true">→</span>
              </Link>
            ) : null}
          </div>
        </div>
      </section>
    );
  }

  if (variant === "editorial") {
    return (
      <section className="atlas-shell py-8">
        <div
          className="relative overflow-hidden rounded-2xl px-6 py-9 text-white @sm:px-10 @sm:py-11"
          style={{
            background: `linear-gradient(115deg, ${ctx.config.colors.primary}, ${ctx.config.colors.accent})`,
          }}
        >
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -top-20 -right-10 h-56 w-56 rounded-full border border-white/20"
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -right-4 -bottom-24 h-56 w-56 rounded-full border border-white/15"
          />
          <div className="relative flex flex-col items-start gap-5 @sm:flex-row @sm:items-center @sm:justify-between">
            <div className="max-w-2xl">
              <p className="text-[10px] font-semibold tracking-[0.22em] text-white/70 uppercase">
                বিশেষ অফার
              </p>
              <h3 className="mt-1.5 font-serif text-2xl font-semibold tracking-tight @sm:text-3xl">
                {promo.title}
              </h3>
              {promo.body ? (
                <p className="mt-2 text-sm leading-relaxed text-white/85">
                  {promo.body}
                </p>
              ) : null}
            </div>
            {promo.ctaLabel ? (
              <Link
                href={storePath(ctx.slug, promo.ctaHref)}
                className="store-btn shrink-0 bg-white px-5 py-2.5 text-sm font-semibold shadow-sm transition hover:-translate-y-0.5"
                style={{ color: ctx.config.colors.primary }}
              >
                {promo.ctaLabel}
              </Link>
            ) : null}
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="atlas-shell py-8">
      <div
        className="relative overflow-hidden rounded-[var(--store-button-radius)] px-6 py-9 text-white @sm:px-10"
        style={{ background: "var(--store-primary)" }}
      >
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 opacity-[0.12]"
          style={{
            backgroundImage:
              "linear-gradient(to right, white 1px, transparent 1px), linear-gradient(to bottom, white 1px, transparent 1px)",
            backgroundSize: "28px 28px",
            maskImage: "linear-gradient(to right, transparent, black)",
          }}
        />
        <div className="relative flex flex-col items-start gap-5 @sm:flex-row @sm:items-center @sm:justify-between">
          <div className="max-w-2xl">
            <p className="text-[10px] font-semibold tracking-[0.2em] text-white/60 uppercase">
              বিশেষ সুবিধা
            </p>
            <h3 className="mt-1.5 text-2xl font-semibold tracking-tight @sm:text-3xl">
              {promo.title}
            </h3>
            {promo.body ? (
              <p className="mt-2 text-sm leading-relaxed text-white/70">
                {promo.body}
              </p>
            ) : null}
          </div>
          {promo.ctaLabel ? (
            <Link
              href={storePath(ctx.slug, promo.ctaHref)}
              className="inline-flex h-10 shrink-0 items-center gap-2 rounded-[var(--store-button-radius)] bg-white px-5 text-sm font-semibold transition hover:-translate-y-0.5 hover:shadow-md"
              style={{ color: "var(--store-primary)" }}
            >
              {promo.ctaLabel}
              <span aria-hidden="true">→</span>
            </Link>
          ) : null}
        </div>
      </div>
    </section>
  );
}

// ── Testimonials ─────────────────────────────────────────────────────────────

export function Testimonials({
  ctx,
  variant,
}: SectionProps & { variant: SectionVariant }) {
  const { testimonials } = ctx.config;
  if (!testimonials.enabled || testimonials.items.length === 0) return null;

  if (variant === "dense") {
    return (
      <section className="store-surface py-8">
        <div className="atlas-shell">
          <div className="mb-4 flex items-center gap-3">
            <span
              className="h-6 w-1 rounded-full"
              style={{ background: "var(--store-primary)" }}
              aria-hidden="true"
            />
            <h2 className="text-xl font-bold tracking-tight @sm:text-2xl">
              ক্রেতাদের কথা
            </h2>
          </div>

          <div className="grid gap-3 @sm:grid-cols-2 @lg:grid-cols-3">
            {testimonials.items.map((item, index) => (
              <figure
                key={`${item.name}-${index}`}
                className="h-full rounded-[var(--store-button-radius)] border border-black/[0.08] bg-white p-5 transition duration-300 hover:-translate-y-0.5 hover:border-black/15 hover:shadow-md"
              >
                <div
                  className="flex gap-0.5"
                  style={{ color: "var(--store-accent)" }}
                >
                  {Array.from({ length: 5 }).map((_, star) => (
                    <Star key={star} className="h-3.5 w-3.5 fill-current" />
                  ))}
                </div>
                <blockquote className="mt-2.5 text-sm leading-relaxed">
                  “{item.quote}”
                </blockquote>
                <figcaption className="mt-3 flex items-center gap-2 border-t border-black/5 pt-3">
                  <span
                    className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-[11px] font-bold"
                    style={{
                      background: `${ctx.config.colors.primary}14`,
                      color: "var(--store-primary)",
                    }}
                  >
                    {item.name.trim().charAt(0)}
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-xs font-semibold">
                      {item.name}
                    </span>
                    {item.location ? (
                      <span className="muted block text-[11px]">
                        {item.location}
                      </span>
                    ) : null}
                  </span>
                </figcaption>
              </figure>
            ))}
          </div>
        </div>
      </section>
    );
  }

  if (variant === "editorial") {
    return (
      <section className="store-surface py-12 @sm:py-14">
        <div className="atlas-shell">
          <div className="mx-auto max-w-xl text-center">
            <p
              className="text-[10px] font-semibold tracking-[0.22em] uppercase"
              style={{ color: "var(--store-primary)" }}
            >
              রিভিউ
            </p>
            <h2 className="mt-1 font-serif text-2xl font-semibold tracking-tight @sm:text-3xl">
              ক্রেতাদের কথা
            </h2>
          </div>

          <div className="mt-8 grid gap-4 @sm:grid-cols-2 @lg:grid-cols-3">
            {testimonials.items.map((item, index) => (
              <figure
                key={`${item.name}-${index}`}
                className="group relative h-full rounded-2xl border border-black/10 bg-white/60 p-6 transition duration-300 hover:-translate-y-0.5 hover:shadow-lg"
              >
                <span
                  aria-hidden="true"
                  className="pointer-events-none absolute top-1 right-4 font-serif text-6xl leading-none opacity-10"
                  style={{ color: "var(--store-primary)" }}
                >
                  ”
                </span>
                <div
                  className="mb-3 flex gap-0.5"
                  style={{ color: "var(--store-accent)" }}
                >
                  {Array.from({ length: 5 }).map((_, star) => (
                    <Star key={star} className="h-3.5 w-3.5 fill-current" />
                  ))}
                </div>
                <blockquote className="font-serif text-base leading-relaxed">
                  “{item.quote}”
                </blockquote>
                <figcaption className="mt-4 flex items-center gap-2.5">
                  <span
                    className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-[11px] font-semibold text-white"
                    style={{ background: "var(--store-primary)" }}
                  >
                    {item.name.trim().charAt(0)}
                  </span>
                  <span>
                    <span className="block text-xs font-semibold">
                      {item.name}
                    </span>
                    {item.location ? (
                      <span className="muted block text-[11px]">
                        {item.location}
                      </span>
                    ) : null}
                  </span>
                </figcaption>
              </figure>
            ))}
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="store-surface border-t border-black/5 py-12">
      <div className="atlas-shell">
        <div className="mx-auto max-w-xl text-center">
          <p
            className="text-[10px] font-semibold tracking-[0.2em] uppercase"
            style={{ color: "var(--store-primary)" }}
          >
            রিভিউ
          </p>
          <h2 className="mt-1 text-2xl font-semibold tracking-tight @sm:text-3xl">
            ক্রেতাদের কথা
          </h2>
        </div>

        <div
          className={
            testimonials.items.length === 1
              ? "mx-auto mt-8 max-w-2xl"
              : "mt-8 grid gap-4 @sm:grid-cols-2 @lg:grid-cols-3"
          }
        >
          {testimonials.items.map((item, index) => (
            <figure
              key={`${item.name}-${index}`}
              className="relative h-full overflow-hidden rounded-[var(--store-button-radius)] border border-black/10 bg-white p-6"
            >
              <span
                aria-hidden="true"
                className="pointer-events-none absolute top-1 right-4 font-serif text-6xl leading-none opacity-[0.07]"
                style={{ color: "var(--store-primary)" }}
              >
                ”
              </span>
              <div
                className="flex gap-0.5"
                style={{ color: "var(--store-accent)" }}
              >
                {Array.from({ length: 5 }).map((_, star) => (
                  <Star key={star} className="h-3.5 w-3.5 fill-current" />
                ))}
              </div>
              <blockquote
                className={`mt-3 leading-relaxed ${
                  testimonials.items.length === 1
                    ? "text-base @sm:text-lg"
                    : "text-sm"
                }`}
              >
                “{item.quote}”
              </blockquote>
              <figcaption className="mt-5 flex items-center gap-2.5 border-t border-black/5 pt-4">
                <span
                  className="grid h-8 w-8 shrink-0 place-items-center rounded-[var(--store-button-radius)] text-[11px] font-semibold text-white"
                  style={{ background: "var(--store-primary)" }}
                >
                  {item.name.trim().charAt(0)}
                </span>
                <span>
                  <span className="block text-xs font-semibold">
                    {item.name}
                  </span>
                  {item.location ? (
                    <span className="muted block text-[11px]">
                      {item.location}
                    </span>
                  ) : null}
                </span>
              </figcaption>
            </figure>
          ))}
        </div>
      </div>
    </section>
  );
}

// ── Trust bar ────────────────────────────────────────────────────────────────

export function TrustBar({
  ctx,
  variant,
}: SectionProps & { variant: SectionVariant }) {
  const { trust } = ctx.config;
  if (!trust.enabled || trust.items.length === 0) return null;

  if (variant === "dense") {
    return (
      <section className="border-y border-black/10 bg-white">
        <div className="atlas-shell grid gap-3 py-5 @sm:grid-cols-3">
          {trust.items.map((item, index) => {
            const Icon = TRUST_ICONS[index % TRUST_ICONS.length];
            return (
              <div
                key={item}
                className="flex items-center gap-3 rounded-[var(--store-button-radius)] px-4 py-3 @sm:justify-center"
                style={{ background: "var(--store-surface)" }}
              >
                <span
                  className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-white shadow-sm"
                  style={{ color: "var(--store-primary)" }}
                >
                  <Icon className="h-4 w-4" />
                </span>
                <span className="text-xs font-semibold leading-snug">
                  {item}
                </span>
              </div>
            );
          })}
        </div>
      </section>
    );
  }

  if (variant === "editorial") {
    return (
      <section className="store-surface border-y border-black/10">
        <div className="atlas-shell grid gap-5 py-7 @sm:grid-cols-2 @lg:grid-cols-4">
          {trust.items.map((item, index) => {
            const Icon = TRUST_ICONS[index % TRUST_ICONS.length];
            return (
              <div
                key={item}
                className="flex items-center gap-3 @lg:justify-center"
              >
                <span
                  className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-black/10"
                  style={{ color: "var(--store-primary)" }}
                >
                  <Icon className="h-4 w-4" />
                </span>
                <span className="text-xs font-medium leading-snug">{item}</span>
              </div>
            );
          })}
        </div>
      </section>
    );
  }

  return (
    <section className="border-y border-black/10 bg-[var(--store-surface)]">
      <div className="atlas-shell grid gap-3 py-5 @sm:grid-cols-3">
        {trust.items.map((item, index) => {
          const Icon = TRUST_ICONS[index % TRUST_ICONS.length];
          return (
            <div
              key={item}
              className={`flex items-center gap-2.5 @sm:justify-center ${
                index > 0 ? "@sm:border-l @sm:border-black/10" : ""
              }`}
            >
              <Icon
                className="h-4 w-4 shrink-0"
                style={{ color: "var(--store-primary)" }}
              />
              <span className="text-xs font-medium">{item}</span>
            </div>
          );
        })}
      </div>
    </section>
  );
}

// ── Footer ───────────────────────────────────────────────────────────────────

export function Footer({
  ctx,
  variant,
}: SectionProps & { variant: SectionVariant }) {
  const { footer } = ctx.config;
  const year = new Date().getFullYear();
  const editorial = variant === "editorial";

  return (
    <footer
      className="mt-auto border-t border-black/10"
      style={{ background: ctx.config.colors.primary }}
    >
      {!editorial ? (
        <div
          className="h-1"
          style={{ background: "var(--store-accent)" }}
          aria-hidden="true"
        />
      ) : null}
      <div
        className={`atlas-shell grid gap-8 text-white/90 @sm:grid-cols-2 @lg:grid-cols-4 ${
          editorial ? "py-12" : "py-10"
        }`}
      >
        <div className="@sm:col-span-2">
          <p
            className={`font-semibold text-white ${
              editorial
                ? "font-serif text-2xl tracking-tight"
                : "text-xl tracking-tight"
            }`}
          >
            {ctx.storeName}
          </p>
          {footer.about ? (
            <p
              className={`mt-2 max-w-md text-sm leading-relaxed ${editorial ? "text-white/75" : "text-white/80"}`}
            >
              {footer.about}
            </p>
          ) : null}
          <div className={`space-y-1.5 text-sm ${editorial ? "mt-5" : "mt-4"}`}>
            {ctx.contact.phone ? (
              <p className="flex items-center gap-2">
                <Phone className="h-3.5 w-3.5" /> {ctx.contact.phone}
              </p>
            ) : null}
            {ctx.contact.email ? (
              <p className="flex items-center gap-2">
                <Mail className="h-3.5 w-3.5" /> {ctx.contact.email}
              </p>
            ) : null}
          </div>
        </div>

        {footer.columns.map(column => (
          <div key={column.title}>
            <p className="text-sm font-semibold tracking-[0.12em] text-white uppercase">
              {column.title}
            </p>
            <ul className="mt-3 space-y-2 text-sm">
              {column.links.map(link => (
                <li key={`${column.title}-${link.href}`}>
                  <Link
                    href={storePath(ctx.slug, link.href)}
                    className={`text-white/80 transition hover:text-white ${editorial ? "hover:underline hover:underline-offset-4" : ""}`}
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div className="border-t border-white/15">
        <div className="atlas-shell flex flex-col gap-2 py-4 text-xs text-white/70 @sm:flex-row @sm:items-center @sm:justify-between">
          <p>{footer.note || `© ${year} ${ctx.storeName}`}</p>
          <p className="flex items-center gap-1.5">
            <Menu className="h-3 w-3" />
            ATLaS দিয়ে তৈরি
          </p>
        </div>
      </div>
    </footer>
  );
}
