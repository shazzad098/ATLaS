import Link from "next/link";
import {
  ArrowRight,
  ArrowUpRight,
  BadgeCheck,
  Check,
  Mail,
  MapPin,
  Phone,
  RefreshCw,
  Search,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  Truck,
} from "lucide-react";
import { formatBdt } from "@/lib/money";
import { storePath } from "@/lib/storefront";
import type {
  CategoryGridProps,
  ProductCardProps,
  ProductGridProps,
  SectionProps,
  StorefrontCategory,
} from "@/themes/types";

/**
 * Nokshi — warm editorial boutique theme.
 *
 * A dedicated implementation rather than a `kit` variant: the reference design
 * is a full fashion storefront (announcement bar, split hero with a product
 * card, circular category rail, filter chips, brand story, newsletter band and
 * a deep-maroon footer). Everything is driven by `ThemeConfig` + live catalogue
 * data, so a merchant's colours, copy and products flow straight through.
 */

const primary = "var(--store-primary)";
const accent = "var(--store-accent)";
const background = "var(--store-background)";
const surface = "var(--store-surface)";

const HEADING = "store-heading tracking-tight";

/** "শিরোনাম, বাকি অংশ" → two lines, the second one tinted like the reference. */
function splitTitle(title: string): [string, string] {
  const comma = title.indexOf(",");
  if (comma === -1) return [title, ""];
  return [title.slice(0, comma + 1), title.slice(comma + 1).trim()];
}

function SectionHeading({
  eyebrow,
  title,
  subtitle,
  href,
  linkLabel,
  align = "left",
}: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  href?: string;
  linkLabel?: string;
  align?: "left" | "center";
}) {
  return (
    <div
      className={`flex flex-wrap gap-3 ${
        align === "center" ? "flex-col items-center text-center" : "items-end justify-between"
      }`}
    >
      <div className="max-w-2xl">
        {eyebrow ? (
          <p
            className="mb-1.5 flex items-center gap-1.5 text-[10px] font-semibold tracking-[0.18em] uppercase"
            style={{ color: primary }}
          >
            <span className="inline-block h-1.5 w-1.5 rotate-45" style={{ background: accent }} />
            {eyebrow}
          </p>
        ) : null}
        <h2 className={`${HEADING} text-[24px] leading-tight font-bold sm:text-[30px]`}>{title}</h2>
        {subtitle ? <p className="muted mt-1.5 max-w-xl text-[12.5px] leading-6">{subtitle}</p> : null}
      </div>
      {href && linkLabel ? (
        <Link
          href={href}
          className="inline-flex items-center gap-1 text-[12px] font-semibold whitespace-nowrap hover:underline"
          style={{ color: primary }}
        >
          {linkLabel} <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      ) : null}
    </div>
  );
}

// ── Header ───────────────────────────────────────────────────────────────────

export function Header({ ctx }: SectionProps) {
  const { header } = ctx.config;
  const home = storePath(ctx.slug);
  const shop = storePath(ctx.slug, "/shop");
  const cart = storePath(ctx.slug, "/cart");
  const centered = header.style === "centered";
  const minimal = header.style === "minimal";
  const showSearch = header.showSearch && !minimal;

  const logo = (
    <Link href={home} className="flex shrink-0 items-center gap-2.5" aria-label={ctx.storeName}>
      <span
        className="grid h-10 w-10 place-items-center rounded-full text-lg font-bold text-white shadow-[0_6px_16px_-8px_rgba(90,20,30,0.8)]"
        style={{ background: primary }}
      >
        {ctx.storeName.trim().charAt(0)}
      </span>
      <span className="flex flex-col leading-none">
        <span className={`${HEADING} text-[17px] font-bold sm:text-[19px]`}>{ctx.storeName}</span>
        {!minimal ? (
          <span className="muted mt-1 text-[8.5px] font-medium tracking-[0.2em]">
            {ctx.tagline?.slice(0, 38) || "অনলাইন দোকান"}
          </span>
        ) : null}
      </span>
    </Link>
  );

  const links = ctx.navigation.map((link) => (
    <Link
      key={`${link.label}-${link.href}`}
      href={storePath(ctx.slug, link.href)}
      className="rounded-full px-2.5 py-1.5 text-[12.5px] font-medium transition hover:bg-[var(--store-surface)]"
      style={{ color: "var(--store-text)" }}
    >
      {link.label}
    </Link>
  ));

  const searchForm = (
    <form
      action={shop}
      className={`items-center gap-2 rounded-full border px-3 py-1.5 ${centered ? "flex" : "hidden xl:flex"}`}
      style={{ borderColor: "color-mix(in srgb, var(--store-primary) 18%, transparent)" }}
    >
      <Search className="h-3.5 w-3.5 opacity-60" />
      <input
        type="search"
        name="q"
        placeholder="পণ্য খুঁজুন…"
        className={`${centered ? "w-40" : "w-32"} bg-transparent text-[12px] outline-none placeholder:opacity-60`}
      />
    </form>
  );

  const cartLink = (
    <Link
      href={cart}
      className="store-btn inline-flex h-9 items-center gap-1.5 rounded-full px-3 text-white transition hover:opacity-90"
      style={{ background: primary }}
      aria-label="কার্ট"
    >
      <ShoppingBag className="h-4 w-4" />
      <span className="hidden text-[12px] font-semibold sm:inline">কার্ট</span>
    </Link>
  );

  return (
    <header
      className={`${header.sticky ? "sticky top-0" : "relative"} z-40 border-b bg-[var(--store-background)] backdrop-blur`}
      style={{ borderColor: "color-mix(in srgb, var(--store-primary) 14%, transparent)" }}
    >
      {ctx.announcement ? (
        <div
          className="text-white"
          style={{ background: "color-mix(in srgb, var(--store-primary) 82%, #000)" }}
        >
          <div className="atlas-shell flex items-center justify-center gap-2 py-2 text-center text-[10.5px] font-medium tracking-wide sm:text-[11.5px]">
            <Sparkles className="hidden h-3.5 w-3.5 sm:block" />
            <span>{ctx.announcement}</span>
          </div>
        </div>
      ) : null}

      {centered ? (
        <div className="atlas-shell flex flex-col items-center gap-2 py-3">
          {logo}
          <div className="flex flex-wrap items-center justify-center gap-1.5">
            {showSearch ? searchForm : null}
            {cartLink}
          </div>
          <nav className="hidden items-center gap-0.5 lg:flex">{links}</nav>
        </div>
      ) : (
        <div className="atlas-shell flex items-center gap-3 py-3">
          {logo}

          <nav className="ml-4 hidden flex-1 items-center gap-0.5 lg:flex">{links}</nav>

          <div className="ml-auto flex items-center gap-1.5 lg:ml-0">
            {showSearch ? searchForm : null}
            {showSearch ? (
              <Link
                href={shop}
                aria-label="পণ্য খুঁজুন"
                className="grid h-9 w-9 place-items-center rounded-full border transition hover:bg-[var(--store-surface)] xl:hidden"
                style={{ borderColor: "color-mix(in srgb, var(--store-primary) 18%, transparent)" }}
              >
                <Search className="h-4 w-4" />
              </Link>
            ) : null}
            {cartLink}
          </div>
        </div>
      )}

      <nav className="atlas-shell no-scrollbar flex gap-1 overflow-x-auto pb-2 text-[12px] lg:hidden">
        {ctx.navigation.map((link) => (
          <Link
            key={`${link.label}-${link.href}-mobile`}
            href={storePath(ctx.slug, link.href)}
            className="whitespace-nowrap rounded-full border px-3 py-1.5 font-medium"
            style={{
              borderColor: "color-mix(in srgb, var(--store-primary) 14%, transparent)",
              background: background,
            }}
          >
            {link.label}
          </Link>
        ))}
      </nav>
    </header>
  );
}

// ── Hero ─────────────────────────────────────────────────────────────────────

export function Hero({ ctx, products = [] }: SectionProps) {
  const { hero } = ctx.config;
  if (!hero.enabled) return null;

  const heroTitle = hero.title.trim() || ctx.storeName;
  const heroSubtitle = hero.subtitle.trim() || ctx.tagline || "";
  const [firstLine, secondLine] = splitTitle(heroTitle);
  const featured = products[0] ?? null;
  const image = featured?.imageUrl ?? null;
  const points = ctx.config.trust.items.slice(0, 3);
  const centered = hero.align === "center";

  return (
    <section
      className="relative overflow-hidden border-b"
      style={{
        background: `linear-gradient(180deg, ${surface} 0%, ${background} 78%)`,
        borderColor: "color-mix(in srgb, var(--store-primary) 12%, transparent)",
      }}
    >
      <div
        className="pointer-events-none absolute -top-16 -left-24 h-64 w-64 rounded-full opacity-20 blur-3xl"
        style={{ background: accent }}
      />
      <div
        className="pointer-events-none absolute -right-20 bottom-0 h-72 w-72 rounded-full opacity-15 blur-3xl"
        style={{ background: primary }}
      />

      <div className="atlas-shell relative grid gap-10 py-10 lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:py-14">
        <div className={centered ? "text-center" : ""}>
          <span
            className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[10.5px] font-semibold"
            style={{
              borderColor: "color-mix(in srgb, var(--store-primary) 22%, transparent)",
              color: primary,
              background: background,
            }}
          >
            <Sparkles className="h-3 w-3" style={{ color: accent }} />
            {featured?.categoryName ?? "স্বাগতম"}
          </span>

          <h1 className={`${HEADING} mt-3 text-[32px] leading-[1.15] font-bold sm:text-[46px]`}>
            {firstLine}
            {secondLine ? (
              <>
                <br />
                <span style={{ color: primary }}>{secondLine}</span>
              </>
            ) : null}
          </h1>

          {heroSubtitle ? (
            <p className={`muted mt-4 max-w-xl text-[13px] leading-7 sm:text-[13.5px] ${centered ? "mx-auto" : ""}`}>
              {heroSubtitle}
            </p>
          ) : null}

          <div className={`mt-6 flex flex-wrap items-center gap-2.5 ${centered ? "justify-center" : ""}`}>
            <Link
              href={storePath(ctx.slug, hero.ctaHref)}
              className="store-btn inline-flex items-center gap-1.5 rounded-full px-5 py-3 text-[12.5px] font-semibold text-white shadow-[0_14px_28px_-16px_rgba(90,20,30,0.9)] transition hover:opacity-90"
              style={{ background: primary }}
            >
              {hero.ctaLabel || "শপ দেখুন"} <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href={storePath(ctx.slug, "/page/contact")}
              className="store-btn inline-flex items-center gap-1.5 rounded-full border bg-white/70 px-5 py-3 text-[12.5px] font-semibold transition hover:bg-white"
              style={{
                borderColor: "color-mix(in srgb, var(--store-primary) 25%, transparent)",
                color: primary,
              }}
            >
              আমাদের গল্প
            </Link>
          </div>

          {points.length ? (
            <ul className={`muted mt-6 flex flex-wrap gap-x-5 gap-y-2 text-[11px] font-medium ${centered ? "justify-center" : ""}`}>
              {points.map((point) => (
                <li key={point} className="inline-flex items-center gap-1.5">
                  <Check className="h-3.5 w-3.5" style={{ color: primary }} strokeWidth={2.6} />
                  {point}
                </li>
              ))}
            </ul>
          ) : null}
        </div>

        <div className="relative">
          <div
            className="relative overflow-hidden rounded-[22px] border bg-white shadow-[0_30px_60px_-40px_rgba(90,20,30,0.55)]"
            style={{ borderColor: "color-mix(in srgb, var(--store-primary) 16%, transparent)" }}
          >
            <div className="aspect-4/5 max-h-[460px] w-full overflow-hidden sm:aspect-5/4 lg:aspect-4/5">
              {image ? (
                <img src={image} alt={featured?.name ?? ctx.storeName} className="h-full w-full object-cover" />
              ) : (
                <div className="grid h-full place-items-center bg-[var(--store-surface)]">
                  <span className={`${HEADING} text-3xl opacity-40`}>{ctx.storeName}</span>
                </div>
              )}
            </div>
            <span
              className="absolute top-3 right-3 rounded-full px-2.5 py-1 text-[9.5px] font-bold tracking-wide text-white shadow"
              style={{ background: accent }}
            >
              {featured?.categoryName ?? "পণ্য"}
            </span>
          </div>

          {featured ? (
            <Link
              href={storePath(ctx.slug, `/product/${featured.slug}`)}
              className="absolute -bottom-4 left-3 right-3 flex items-center justify-between gap-3 rounded-xl border border-white/60 bg-white/95 p-3 shadow-[0_18px_40px_-24px_rgba(90,20,30,0.65)] backdrop-blur sm:left-5 sm:right-auto sm:max-w-[280px]"
            >
              <span className="min-w-0">
                <span className="muted block text-[9px] font-semibold tracking-[0.16em] uppercase">
                  {featured.categoryName ?? "নির্বাচিত"}
                </span>
                <span className={`${HEADING} mt-0.5 block truncate text-[13px] font-semibold`}>
                  {featured.name}
                </span>
                <span className="mt-0.5 flex items-baseline gap-1.5">
                  <span className="text-[13px] font-bold" style={{ color: primary }}>
                    {formatBdt(featured.priceFrom)}
                  </span>
                  {featured.comparePriceFrom && featured.comparePriceFrom > featured.priceFrom ? (
                    <span className="muted text-[10px] line-through">{formatBdt(featured.comparePriceFrom)}</span>
                  ) : null}
                </span>
              </span>
              <span
                className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-white"
                style={{ background: primary }}
              >
                <ArrowUpRight className="h-4 w-4" />
              </span>
            </Link>
          ) : null}
        </div>
      </div>
    </section>
  );
}

// ── Categories ───────────────────────────────────────────────────────────────

export function CategoryGrid({ ctx, title, categories, products = [] }: CategoryGridProps) {
  if (categories.length === 0) return null;

  const imageFor = (category: StorefrontCategory) =>
    products.find((product) => product.categoryName === category.name)?.imageUrl ?? null;

  return (
    <section className="store-surface py-10 sm:py-12">
      <div className="atlas-shell">
        <SectionHeading
          eyebrow="ক্যাটাগরি"
          title={title || "ক্যাটাগরি"}
          subtitle="আপনার পছন্দের ক্যাটাগরি বেছে নিন।"
          href={storePath(ctx.slug, "/shop")}
          linkLabel="সব দেখুন"
        />

        <div className="no-scrollbar mt-6 flex gap-4 overflow-x-auto pb-2 sm:grid sm:grid-cols-3 sm:overflow-visible lg:grid-cols-5">
          {categories.map((category) => {
            const image = imageFor(category);
            return (
              <Link
                key={category.id}
                href={storePath(ctx.slug, `/shop?category=${category.slug}`)}
                className="group flex w-[104px] shrink-0 flex-col items-center gap-2 text-center sm:w-auto"
              >
                <span
                  className="relative h-[92px] w-[92px] overflow-hidden rounded-full border-[3px] border-white sm:h-24 sm:w-24"
                  style={{
                    background: surface,
                    boxShadow:
                      "0 0 0 1px color-mix(in srgb, var(--store-primary) 15%, transparent), 0 10px 24px -16px rgba(90,20,30,0.7)",
                  }}
                >
                  {image ? (
                    <img
                      src={image}
                      alt={category.name}
                      loading="lazy"
                      className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
                    />
                  ) : (
                    <span className={`${HEADING} grid h-full place-items-center text-xl`} style={{ color: primary }}>
                      {category.name.trim().charAt(0)}
                    </span>
                  )}
                </span>
                <span className={`${HEADING} text-[12.5px] font-semibold`}>{category.name}</span>
                <span className="muted -mt-1 text-[10px]">{category.productCount}টি পণ্য</span>
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}

// ── Product card ─────────────────────────────────────────────────────────────

export function ProductCard({ ctx, product }: ProductCardProps) {
  const discounted = product.comparePriceFrom !== null && product.comparePriceFrom > product.priceFrom;
  const badge = !product.inStock ? "স্টক নেই" : discounted ? "ছাড়" : null;

  return (
    <Link href={storePath(ctx.slug, `/product/${product.slug}`)} className="group flex flex-col">
      <div
        className="relative aspect-3/4 overflow-hidden rounded-xl border"
        style={{ background: surface, borderColor: "color-mix(in srgb, var(--store-primary) 10%, transparent)" }}
      >
        {product.imageUrl ? (
          <img
            src={product.imageUrl}
            alt={product.name}
            loading="lazy"
            className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.04]"
          />
        ) : (
          <div className="muted grid h-full place-items-center text-[11px]">ছবি নেই</div>
        )}
        {badge ? (
          <span
            className="absolute top-2 left-2 rounded-full px-2 py-0.5 text-[9px] font-bold text-white shadow"
            style={{ background: discounted ? primary : "color-mix(in srgb, var(--store-text) 72%, transparent)" }}
          >
            {badge}
          </span>
        ) : null}
        {!product.inStock ? (
          <span className="absolute inset-0 grid place-items-center bg-black/40 text-[12px] font-semibold text-white">
            স্টক নেই
          </span>
        ) : null}
      </div>

      <div className="flex flex-1 flex-col pt-2.5">
        {product.categoryName ? (
          <span className="muted text-[9px] font-semibold tracking-[0.16em] uppercase">{product.categoryName}</span>
        ) : null}
        <span className={`${HEADING} mt-0.5 line-clamp-2 text-[13px] leading-6 font-semibold`}>{product.name}</span>
        <span className="mt-auto flex items-baseline gap-1.5 pt-1.5">
          <span className="text-[14px] font-bold" style={{ color: primary }}>
            {formatBdt(product.priceFrom)}
          </span>
          {discounted ? (
            <span className="muted text-[10.5px] line-through">{formatBdt(product.comparePriceFrom as number)}</span>
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
  categories = [],
  columns = 4,
}: ProductGridProps) {
  if (products.length === 0) return null;

  const chips: Array<{ label: string; href: string }> = [
    { label: "সব", href: storePath(ctx.slug, "/shop") },
    ...categories.slice(0, 4).map((category) => ({
      label: category.name,
      href: storePath(ctx.slug, `/shop?category=${category.slug}`),
    })),
  ];

  return (
    <section className="store-surface py-10 sm:py-12">
      <div className="atlas-shell">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="max-w-2xl">
            <p
              className="mb-1.5 flex items-center gap-1.5 text-[10px] font-semibold tracking-[0.18em] uppercase"
              style={{ color: primary }}
            >
              <span className="inline-block h-1.5 w-1.5 rotate-45" style={{ background: accent }} />
              নতুন কালেকশন
            </p>
            <h2 className={`${HEADING} text-[24px] leading-tight font-bold sm:text-[30px]`}>
              {title || "আজকের নির্বাচিত পোশাক"}
            </h2>
            <p className="muted mt-1.5 max-w-xl text-[12.5px] leading-6">
              প্রতিটি পিস সীমিত সংখ্যায় — পছন্দ হলে দেরি নয়।
            </p>
          </div>

          {chips.length > 1 ? (
            <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0">
              {chips.map((chip, index) => (
                <Link
                  key={chip.href}
                  href={chip.href}
                  className="rounded-full border px-3.5 py-1.5 text-[11.5px] font-semibold whitespace-nowrap transition"
                  style={
                    index === 0
                      ? { background: primary, borderColor: primary, color: "#fff" }
                      : {
                          borderColor: "color-mix(in srgb, var(--store-primary) 18%, transparent)",
                          color: "var(--store-text)",
                          background: background,
                        }
                  }
                >
                  {chip.label}
                </Link>
              ))}
            </div>
          ) : null}
        </div>

        <div className="mt-6 grid grid-cols-2 gap-x-4 gap-y-7 sm:grid-cols-3 lg:grid-cols-4">
          {products.slice(0, columns).map((product) => (
            <ProductCard key={product.id} ctx={ctx} product={product} />
          ))}
        </div>

        <div className="mt-8 text-center">
          <Link
            href={storePath(ctx.slug, "/shop")}
            className="store-btn inline-flex items-center gap-1.5 rounded-full border px-5 py-2.5 text-[12px] font-semibold transition hover:bg-[var(--store-surface)]"
            style={{
              borderColor: "color-mix(in srgb, var(--store-primary) 28%, transparent)",
              color: primary,
            }}
          >
            সব পণ্য দেখুন <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>
    </section>
  );
}

// ── Promo + brand story ──────────────────────────────────────────────────────

export function PromoBanner({ ctx, products = [] }: SectionProps) {
  const { promo } = ctx.config;
  const storyImage = products[1]?.imageUrl ?? products[0]?.imageUrl ?? null;

  return (
    <>
      {promo.enabled && (promo.title || promo.body) ? (
        <section className="atlas-shell py-6 sm:py-8">
          <div
            className="relative overflow-hidden rounded-[22px] px-6 py-8 text-white sm:px-10 sm:py-10"
            style={{
              background: `linear-gradient(115deg, ${primary} 0%, color-mix(in srgb, var(--store-primary) 70%, #2b070c) 100%)`,
            }}
          >
            <div className="pointer-events-none absolute -top-16 -right-10 h-56 w-56 rounded-full border border-white/15" />
            <div className="pointer-events-none absolute -right-6 -bottom-20 h-56 w-56 rounded-full border border-white/10" />

            <div className="relative flex flex-wrap items-center justify-between gap-6">
              <div className="max-w-xl">
                <span
                  className="inline-flex items-center gap-1.5 rounded-full border border-white/25 px-2.5 py-1 text-[9.5px] font-semibold tracking-[0.14em] uppercase"
                  style={{ color: "#F6E7C8" }}
                >
                  <Sparkles className="h-3 w-3" />
                  সীমিত সময়ের অফার
                </span>
                <h3 className={`${HEADING} mt-3 text-[24px] leading-tight font-bold sm:text-[30px]`}>
                  {promo.title || "নির্বাচিত কালেকশনে বিশেষ ছাড়"}
                </h3>
                {promo.body ? <p className="mt-2 text-[12.5px] leading-6 text-white/85">{promo.body}</p> : null}
              </div>

              {promo.ctaLabel ? (
                <Link
                  href={storePath(ctx.slug, promo.ctaHref)}
                  className="store-btn inline-flex items-center gap-1.5 rounded-full bg-white px-5 py-2.5 text-[12px] font-bold"
                  style={{ color: primary }}
                >
                  {promo.ctaLabel} <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              ) : null}
            </div>
          </div>
        </section>
      ) : null}

      {/* Brand story */}
      <section
        className="border-y py-12 sm:py-14"
        style={{
          background: surface,
          borderColor: "color-mix(in srgb, var(--store-primary) 12%, transparent)",
        }}
      >
        <div className="atlas-shell grid gap-8 lg:grid-cols-[1fr_0.9fr] lg:items-center">
          <div>
            <p
              className="mb-2 flex items-center gap-1.5 text-[10px] font-semibold tracking-[0.18em] uppercase"
              style={{ color: primary }}
            >
              <span className="inline-block h-1.5 w-1.5 rotate-45" style={{ background: accent }} />
              আমাদের গল্প
            </p>
            <h2 className={`${HEADING} text-[24px] leading-tight font-bold sm:text-[30px]`}>
              {ctx.storeName}
            </h2>
            {ctx.tagline ? (
              <p className="muted mt-3 max-w-xl text-[12.5px] leading-7">{ctx.tagline}</p>
            ) : null}
          </div>

          <div className="relative">
            <div
              className="overflow-hidden rounded-[20px] border bg-white shadow-[0_24px_50px_-36px_rgba(90,20,30,0.6)]"
              style={{ borderColor: "color-mix(in srgb, var(--store-primary) 14%, transparent)" }}
            >
              {storyImage ? (
                <img src={storyImage} alt={ctx.storeName} loading="lazy" className="aspect-4/3 w-full object-cover" />
              ) : (
                <div className="grid aspect-4/3 place-items-center" style={{ background: background }}>
                  <span className={`${HEADING} text-2xl opacity-40`}>{ctx.storeName}</span>
                </div>
              )}
            </div>
            <div className="absolute -bottom-4 right-4 flex items-center gap-2 rounded-full border border-white/70 bg-white/95 px-3.5 py-2 text-[10.5px] font-semibold shadow-lg backdrop-blur">
              <BadgeCheck className="h-4 w-4" style={{ color: primary }} />
              {ctx.storeName}
            </div>
          </div>
        </div>
      </section>
    </>
  );
}

// ── Trust bar ────────────────────────────────────────────────────────────────

const TRUST_ICONS = [Truck, RefreshCw, ShieldCheck, Phone] as const;

export function TrustBar({ ctx, title }: SectionProps) {
  const { trust } = ctx.config;
  if (!trust.enabled || trust.items.length === 0) return null;

  return (
    <section className="store-surface border-b" style={{ borderColor: "color-mix(in srgb, var(--store-primary) 12%, transparent)" }}>
      <div className="atlas-shell py-6">
        {title ? (
          <p className={`${HEADING} mb-4 text-center text-[18px] font-bold sm:text-[20px]`}>{title}</p>
        ) : null}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {trust.items.map((item, index) => {
            const Icon = TRUST_ICONS[index % TRUST_ICONS.length];
            return (
              <div key={item} className="flex items-center gap-3">
                <span
                  className="grid h-10 w-10 shrink-0 place-items-center rounded-full border"
                  style={{
                    borderColor: "color-mix(in srgb, var(--store-primary) 20%, transparent)",
                    color: primary,
                    background: background,
                  }}
                >
                  <Icon className="h-4 w-4" />
                </span>
                <span className={`${HEADING} text-[12.5px] font-semibold`}>{item}</span>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

// ── Testimonials + newsletter ────────────────────────────────────────────────

export function Testimonials({ ctx, title }: SectionProps) {
  const { testimonials } = ctx.config;
  const items = testimonials.items.slice(0, 3);
  const whatsapp = ctx.contact.whatsapp;

  return (
    <>
      {testimonials.enabled && items.length > 0 ? (
        <section className="store-surface py-12 sm:py-14">
          <div className="atlas-shell">
            <SectionHeading
              align="center"
              eyebrow="ক্রেতার মতামত"
              title={title || "ক্রেতাদের মতামত"}
              subtitle="ক্রেতাদের সাথে শেয়ার করা অভিজ্ঞতা।"
            />

            <div className="mt-7 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {items.map((item, index) => (
                <figure
                  key={`${item.name}-${index}`}
                  className="flex h-full flex-col rounded-xl border bg-white/70 p-5"
                  style={{ borderColor: "color-mix(in srgb, var(--store-primary) 12%, transparent)" }}
                >
                  <blockquote className={`${HEADING} flex-1 text-[12.5px] leading-6`}>
                    “{item.quote}”
                  </blockquote>
                  <figcaption className="mt-4 flex items-center justify-between gap-2 border-t pt-3" style={{ borderColor: "color-mix(in srgb, var(--store-primary) 10%, transparent)" }}>
                    <span>
                      <span className="block text-[11.5px] font-semibold">{item.name}</span>
                      {item.location ? <span className="muted block text-[10px]">{item.location}</span> : null}
                    </span>
                  </figcaption>
                </figure>
              ))}
            </div>
          </div>
        </section>
      ) : null}

      {/* Newsletter / channel band */}
      <section className="store-surface pb-12 sm:pb-16">
        <div className="atlas-shell">
          <div
            className="relative overflow-hidden rounded-2xl border px-6 py-9 text-center sm:px-10"
            style={{
              background: surface,
              borderColor: "color-mix(in srgb, var(--store-primary) 14%, transparent)",
            }}
          >
            <span
              className="mx-auto grid h-11 w-11 place-items-center rounded-full text-white"
              style={{ background: primary }}
            >
              <Mail className="h-5 w-5" />
            </span>
            <h2 className={`${HEADING} mt-3 text-[21px] font-bold sm:text-[25px]`}>
              দোকানের নতুন খবর ও আপডেট
            </h2>
            <p className="muted mx-auto mt-1.5 max-w-md text-[11.5px] leading-6">
              নতুন পণ্য বা অফার থাকলে প্রথমেই জানুন।
            </p>

            <div className="mx-auto mt-5 flex max-w-md flex-col gap-2 sm:flex-row">
              {whatsapp ? (
                <a
                  href={`https://wa.me/88${whatsapp.replace(/\D/g, "").slice(-11)}`}
                  target="_blank"
                  rel="noreferrer"
                  className="store-btn inline-flex flex-1 items-center justify-center gap-1.5 rounded-full px-5 py-2.5 text-[12px] font-semibold text-white transition hover:opacity-90"
                  style={{ background: primary }}
                >
                  <Phone className="h-3.5 w-3.5" /> হোয়াটসঅ্যাপে যোগ দিন
                </a>
              ) : null}
              <Link
                href={storePath(ctx.slug, "/page/contact")}
                className="store-btn inline-flex flex-1 items-center justify-center gap-1.5 rounded-full border bg-white px-5 py-2.5 text-[12px] font-semibold"
                style={{
                  borderColor: "color-mix(in srgb, var(--store-primary) 22%, transparent)",
                  color: primary,
                }}
              >
                যোগাযোগ করুন
              </Link>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}

// ── Footer ───────────────────────────────────────────────────────────────────

export function Footer({ ctx }: SectionProps) {
  const { footer } = ctx.config;
  const year = new Date().getFullYear();
  const footerAddress = [ctx.address.line1, ctx.address.area, ctx.address.city].filter(Boolean).join(", ");

  return (
    <footer className="mt-auto text-white" style={{ background: "color-mix(in srgb, var(--store-primary) 88%, #1a0509)" }}>
      <div className="atlas-shell grid gap-8 py-12 sm:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr_1.1fr]">
        <div>
          <p className={`${HEADING} text-[18px] font-bold text-white`}>{ctx.storeName}</p>
          <p className="mt-2 max-w-xs text-[11.5px] leading-6 text-white/75">
            {footer.about || ctx.tagline || "আপনার অনলাইন দোকান।"}
          </p>
        </div>

        {footer.columns.map((column) => (
          <div key={column.title}>
            <p className="text-[11.5px] font-bold tracking-wide text-white">{column.title}</p>
            <ul className="mt-3 space-y-2 text-[11.5px]">
              {column.links.map((link) => (
                <li key={`${column.title}-${link.href}`}>
                  <Link
                    href={storePath(ctx.slug, link.href)}
                    className="text-white/75 transition hover:text-white"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}

        <div>
          <p className="text-[11.5px] font-bold tracking-wide text-white">যোগাযোগ</p>
          <ul className="mt-3 space-y-2 text-[11.5px] text-white/75">
            {ctx.contact.phone ? (
              <li className="flex items-center gap-2">
                <Phone className="h-3.5 w-3.5" /> {ctx.contact.phone}
              </li>
            ) : null}
            {ctx.contact.email ? (
              <li className="flex items-center gap-2">
                <Mail className="h-3.5 w-3.5" /> {ctx.contact.email}
              </li>
            ) : null}
            {footerAddress ? (
              <li className="flex items-center gap-2">
                <MapPin className="h-3.5 w-3.5" /> {footerAddress}
              </li>
            ) : null}
          </ul>
        </div>
      </div>

      <div className="border-t border-white/15">
        <div className="atlas-shell flex flex-col gap-1.5 py-4 text-[10.5px] text-white/65 sm:flex-row sm:items-center sm:justify-between">
          <p>{footer.note || `© ${year} ${ctx.storeName}`}</p>
          <p>ATLaS দিয়ে তৈরি</p>
        </div>
      </div>
    </footer>
  );
}
