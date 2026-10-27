import Link from "next/link";
import {
  Mail,
  Menu,
  Phone,
  RefreshCw,
  ShieldCheck,
  ShoppingBag,
  Star,
  Store,
  Truck,
} from "lucide-react";
import { formatBdt } from "@/lib/money";
import { storePath } from "@/lib/storefront";
import type {
  CategoryGridProps,
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
 */

const TRUST_ICONS = [Truck, ShieldCheck, RefreshCw, Store] as const;

function sectionPad(variant: SectionVariant): string {
  return variant === "dense" ? "py-8" : variant === "minimal" ? "py-14" : "py-12";
}

function headingClass(variant: SectionVariant): string {
  const base = "text-2xl font-semibold tracking-tight sm:text-3xl";
  return variant === "editorial" ? `${base} font-serif` : base;
}

function columnsClass(variant: SectionVariant, columns: 3 | 4): string {
  if (variant === "dense") {
    return "grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5";
  }
  if (variant === "minimal") {
    return "grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4";
  }
  return columns === 3
    ? "grid grid-cols-2 gap-5 sm:grid-cols-3"
    : "grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-4";
}

// ── Header ───────────────────────────────────────────────────────────────────

export function Header({ ctx, variant }: SectionProps & { variant: SectionVariant }) {
  const hasAnnouncement = Boolean(ctx.announcement);
  const centered = ctx.config.header.style === "centered";
  const searchEnabled = ctx.config.header.showSearch && ctx.config.header.style !== "minimal";

  return (
    <header
      className={`store-surface ${ctx.config.header.sticky ? "sticky top-0" : "relative"} z-40 border-b ${variant === "minimal" ? "border-black/5" : "border-black/10"}`}
    >
      {hasAnnouncement ? (
        <div
          className="px-4 py-2 text-center text-xs font-medium text-white sm:text-sm"
          style={{ background: "var(--store-primary)" }}
        >
          {ctx.announcement}
        </div>
      ) : null}

      <div className="atlas-shell flex items-center gap-3 py-3">
        <Link
          href={storePath(ctx.slug)}
          className={`flex items-center gap-2 ${centered ? "mx-auto" : ""}`}
          aria-label={ctx.storeName}
        >
          <span
            className="grid h-9 w-9 place-items-center rounded-lg text-sm font-bold text-white"
            style={{ background: "var(--store-primary)" }}
          >
            {ctx.storeName.trim().charAt(0)}
          </span>
          <span
            className={`text-lg font-semibold ${variant === "editorial" ? "font-serif" : ""}`}
            style={{ color: "var(--store-text)" }}
          >
            {ctx.storeName}
          </span>
        </Link>

        {searchEnabled && !centered ? (
          <form
            action={storePath(ctx.slug, "/shop")}
            className="ml-auto hidden max-w-sm flex-1 items-center gap-2 rounded-full border border-black/10 px-3 py-1.5 md:flex"
          >
            <input
              type="search"
              name="q"
              placeholder="পণ্য খুঁজুন…"
              className="w-full bg-transparent text-sm outline-none"
            />
            <button type="submit" className="text-xs font-semibold" style={{ color: "var(--store-primary)" }}>
              খুঁজুন
            </button>
          </form>
        ) : (
          <div className="ml-auto" />
        )}

        <Link
          href={storePath(ctx.slug, "/cart")}
          className="store-btn inline-flex items-center gap-1.5 border border-black/10 px-3 py-1.5 text-sm font-medium"
          aria-label="কার্ট"
        >
          <ShoppingBag className="h-4 w-4" />
          <span className="hidden sm:inline">কার্ট</span>
        </Link>
      </div>

      <nav
        className={`atlas-shell flex gap-1 overflow-x-auto pb-2 text-sm no-scrollbar ${
          centered ? "justify-center" : ""
        }`}
      >
        {ctx.navigation.map((link) => (
          <Link
            key={`${link.label}-${link.href}`}
            href={storePath(ctx.slug, link.href)}
            className="whitespace-nowrap rounded-full px-3 py-1.5 hover:tone-surface"
          >
            {link.label}
          </Link>
        ))}
      </nav>
    </header>
  );
}

// ── Hero ─────────────────────────────────────────────────────────────────────

export function Hero({ ctx, variant }: SectionProps & { variant: SectionVariant }) {
  const { hero } = ctx.config;
  if (!hero.enabled) return null;

  const align = hero.align === "center" ? "items-center text-center" : "items-start text-left";
  const title = hero.title.trim() || ctx.storeName;
  const subtitle = hero.subtitle.trim() || ctx.tagline || "";
  const ctaLabel = hero.ctaLabel || "শপ দেখুন";

  if (variant === "minimal") {
    return (
      <section className="store-surface border-b border-black/5">
        <div className={`atlas-shell flex flex-col gap-4 ${sectionPad(variant)} ${align}`}>
          <p className="text-xs font-semibold uppercase tracking-[0.2em]" style={{ color: "var(--store-primary)" }}>
            {ctx.tagline ?? ctx.storeName}
          </p>
          <h1 className="max-w-3xl text-3xl font-semibold leading-tight sm:text-5xl">{title}</h1>
          {subtitle ? <p className="muted max-w-xl text-base">{subtitle}</p> : null}
          <Link
            href={storePath(ctx.slug, hero.ctaHref)}
            className="store-btn mt-2 px-6 py-3 text-sm font-semibold text-white"
            style={{ background: "var(--store-primary)" }}
          >
            {ctaLabel}
          </Link>
        </div>
      </section>
    );
  }

  return (
    <section className="relative overflow-hidden">
      <div
        className="absolute inset-0"
        style={{
          background: `linear-gradient(120deg, ${ctx.config.colors.primary} 0%, ${ctx.config.colors.accent} 100%)`,
          opacity: variant === "dense" ? 0.92 : 0.88,
        }}
      />
      <div className={`atlas-shell relative flex flex-col gap-4 text-white ${sectionPad(variant)} ${align}`}>
        <h1
          className={`max-w-3xl text-3xl font-bold leading-tight sm:text-5xl ${
            variant === "editorial" ? "font-serif" : ""
          }`}
        >
          {title}
        </h1>
        {subtitle ? <p className="max-w-xl text-base text-white/90">{subtitle}</p> : null}
        <Link
          href={storePath(ctx.slug, hero.ctaHref)}
          className="store-btn mt-2 bg-white px-6 py-3 text-sm font-semibold"
          style={{ color: ctx.config.colors.primary }}
        >
          {ctaLabel}
        </Link>
      </div>
    </section>
  );
}

// ── Category grid ────────────────────────────────────────────────────────────

export function CategoryGrid({
  ctx,
  title,
  categories,
  variant,
}: CategoryGridProps & { variant: SectionVariant }) {
  if (categories.length === 0) return null;

  return (
    <section className={`store-surface ${sectionPad(variant)}`}>
      <div className="atlas-shell">
        {title ? <h2 className={`mb-5 ${headingClass(variant)}`}>{title}</h2> : null}
        <div
          className={
            variant === "dense"
              ? "flex gap-3 overflow-x-auto pb-2 no-scrollbar"
              : "grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4"
          }
        >
          {categories.map((category) => (
            <Link
              key={category.id}
              href={storePath(ctx.slug, `/shop?category=${category.slug}`)}
              className={`group flex items-center gap-3 rounded-[var(--store-button-radius)] border border-black/10 p-3 transition hover:border-black/25 ${
                variant === "dense" ? "min-w-44 shrink-0" : ""
              }`}
            >
              <span
                className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-sm font-semibold"
                style={{ background: "var(--store-surface)", color: "var(--store-primary)" }}
              >
                {category.name.trim().charAt(0)}
              </span>
              <span className="min-w-0">
                <span className="block truncate text-sm font-medium">{category.name}</span>
                <span className="muted block text-xs">{category.productCount}টি পণ্য</span>
              </span>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}

// ── Product card ─────────────────────────────────────────────────────────────

export function ProductCard({ ctx, product, variant }: ProductCardProps & { variant: SectionVariant }) {
  const discounted =
    product.comparePriceFrom !== null && product.comparePriceFrom > product.priceFrom;

  return (
    <Link
      href={storePath(ctx.slug, `/product/${product.slug}`)}
      className={`group flex flex-col overflow-hidden ${
        variant === "minimal"
          ? "rounded-none border border-black/10"
          : "rounded-[var(--store-button-radius)] border border-transparent hover:border-black/10"
      }`}
    >
      <div className="relative aspect-4/5 overflow-hidden tone-surface">
        {product.imageUrl ? (
          <img
            src={product.imageUrl}
            alt={product.name}
            loading="lazy"
            className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="muted flex h-full items-center justify-center text-xs">ছবি নেই</div>
        )}
        {discounted ? (
          <span
            className="absolute left-2 top-2 rounded-full px-2 py-0.5 text-[11px] font-bold text-white"
            style={{ background: "var(--store-accent)" }}
          >
            ছাড়
          </span>
        ) : null}
        {!product.inStock ? (
          <span className="absolute inset-0 grid place-items-center bg-black/45 text-sm font-semibold text-white">
            স্টক নেই
          </span>
        ) : null}
      </div>
      <div className={variant === "minimal" ? "flex flex-1 flex-col gap-1 p-3" : "flex flex-1 flex-col gap-1 pt-3"}>
        {product.categoryName ? <span className="muted text-[11px] uppercase tracking-wide">{product.categoryName}</span> : null}
        <span className={`line-clamp-2 text-sm font-medium ${variant === "editorial" ? "font-serif" : ""}`}>
          {product.name}
        </span>
        <span className="mt-auto flex items-baseline gap-2 pt-1">
          <span className="text-base font-semibold" style={{ color: "var(--store-primary)" }}>
            {formatBdt(product.priceFrom)}
          </span>
          {discounted ? (
            <span className="muted text-xs line-through">{formatBdt(product.comparePriceFrom as number)}</span>
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

  return (
    <section className={`${sectionPad(variant)} ${variant === "minimal" ? "tone-surface" : "store-surface"}`}>
      <div className="atlas-shell">
        <div className="mb-5 flex items-end justify-between gap-4">
          {title ? <h2 className={headingClass(variant)}>{title}</h2> : <span />}
          <Link
            href={storePath(ctx.slug, "/shop")}
            className="text-sm font-semibold whitespace-nowrap"
            style={{ color: "var(--store-primary)" }}
          >
            সব দেখুন →
          </Link>
        </div>
        <div className={columnsClass(variant, columns)}>
          {products.map((product) => (
            <ProductCard key={product.id} ctx={ctx} product={product} variant={variant} />
          ))}
        </div>
      </div>
    </section>
  );
}

// ── Promo banner ─────────────────────────────────────────────────────────────

export function PromoBanner({ ctx, variant }: SectionProps & { variant: SectionVariant }) {
  const { promo } = ctx.config;
  if (!promo.enabled || (!promo.title && !promo.body)) return null;

  return (
    <section className="atlas-shell py-6">
      <div
        className="flex flex-col items-start gap-4 p-6 text-white sm:flex-row sm:items-center sm:justify-between sm:p-8"
        style={{
          background: `linear-gradient(100deg, ${ctx.config.colors.primary}, ${ctx.config.colors.accent})`,
          borderRadius: variant === "minimal" ? "0.25rem" : "calc(var(--store-button-radius) * 1.5)",
        }}
      >
        <div className="max-w-2xl">
          <h3 className={`text-xl font-semibold sm:text-2xl ${variant === "editorial" ? "font-serif" : ""}`}>
            {promo.title}
          </h3>
          {promo.body ? <p className="mt-1 text-sm text-white/90">{promo.body}</p> : null}
        </div>
        {promo.ctaLabel ? (
          <Link
            href={storePath(ctx.slug, promo.ctaHref)}
            className="store-btn bg-white px-5 py-2.5 text-sm font-semibold"
            style={{ color: ctx.config.colors.primary }}
          >
            {promo.ctaLabel}
          </Link>
        ) : null}
      </div>
    </section>
  );
}

// ── Testimonials ─────────────────────────────────────────────────────────────

export function Testimonials({ ctx, title, variant }: SectionProps & { variant: SectionVariant }) {
  const { testimonials } = ctx.config;
  if (!testimonials.enabled || testimonials.items.length === 0) return null;

  return (
    <section className={`store-surface ${sectionPad(variant)}`}>
      <div className="atlas-shell">
        <h2 className={`mb-5 ${headingClass(variant)}`}>{title || "ক্রেতাদের কথা"}</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {testimonials.items.map((item, index) => (
            <figure
              key={`${item.name}-${index}`}
              className={`h-full border border-black/10 p-5 ${
                variant === "minimal" ? "rounded-none bg-transparent" : "rounded-[var(--store-button-radius)] tone-surface"
              }`}
            >
              <div className="mb-2 flex gap-0.5" style={{ color: "var(--store-accent)" }}>
                {Array.from({ length: 5 }).map((_, star) => (
                  <Star key={star} className="h-3.5 w-3.5 fill-current" />
                ))}
              </div>
              <blockquote className={`text-sm ${variant === "editorial" ? "font-serif text-base leading-relaxed" : ""}`}>
                “{item.quote}”
              </blockquote>
              <figcaption className="muted mt-3 text-xs font-medium">
                {item.name}
                {item.location ? ` · ${item.location}` : ""}
              </figcaption>
            </figure>
          ))}
        </div>
      </div>
    </section>
  );
}

// ── Trust bar ────────────────────────────────────────────────────────────────

export function TrustBar({ ctx, title, variant }: SectionProps & { variant: SectionVariant }) {
  const { trust } = ctx.config;
  if (!trust.enabled || trust.items.length === 0) return null;

  return (
    <section className="border-y border-black/10 tone-surface">
      <div className="atlas-shell py-6">
        {title ? <h2 className={`mb-4 text-center ${headingClass(variant)}`}>{title}</h2> : null}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {trust.items.map((item, index) => {
            const Icon = TRUST_ICONS[index % TRUST_ICONS.length];
            return (
              <div key={item} className="flex items-center gap-3">
                <span
                  className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-white"
                  style={{ background: "var(--store-primary)" }}
                >
                  <Icon className="h-4 w-4" />
                </span>
                <span className={`text-sm font-medium ${variant === "editorial" ? "font-serif" : ""}`}>{item}</span>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

// ── Footer ───────────────────────────────────────────────────────────────────

export function Footer({ ctx, variant }: SectionProps & { variant: SectionVariant }) {
  const { footer } = ctx.config;
  const year = new Date().getFullYear();

  return (
    <footer className="mt-auto border-t border-black/10" style={{ background: ctx.config.colors.primary }}>
      <div className="atlas-shell grid gap-8 py-10 text-white/90 sm:grid-cols-2 lg:grid-cols-4">
        <div className="lg:col-span-2">
          <p className={`text-lg font-semibold text-white ${variant === "editorial" ? "font-serif" : ""}`}>
            {ctx.storeName}
          </p>
          {footer.about ? <p className="mt-2 max-w-md text-sm text-white/80">{footer.about}</p> : null}
          <div className="mt-4 space-y-1.5 text-sm">
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

        {footer.columns.map((column) => (
          <div key={column.title}>
            <p className="text-sm font-semibold text-white">{column.title}</p>
            <ul className="mt-3 space-y-2 text-sm">
              {column.links.map((link) => (
                <li key={`${column.title}-${link.href}`}>
                  <Link href={storePath(ctx.slug, link.href)} className="text-white/80 hover:text-white">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div className="border-t border-white/15">
        <div className="atlas-shell flex flex-col gap-2 py-4 text-xs text-white/70 sm:flex-row sm:items-center sm:justify-between">
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
