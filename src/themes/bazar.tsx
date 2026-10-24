import Link from "next/link";
import {
  ArrowRight,
  Apple,
  BadgeCheck,
  BadgePercent,
  Beef,
  Carrot,
  ChevronDown,
  Clock,
  CreditCard,
  Drumstick,
  Egg,
  Fish,
  Flame,
  Heart,
  Leaf,
  Mail,
  MapPin,
  Menu,
  Milk,
  Percent,
  Phone,
  RotateCcw,
  Search,
  ShieldCheck,
  ShoppingBasket,
  ShoppingCart,
  Sparkles,
  Star,
  Store,
  Tag,
  Truck,
  Wheat,
} from "lucide-react";
import { formatBdt } from "@/lib/money";
import { storePath } from "@/lib/storefront";
import { DealCountdown } from "@/themes/bazar-countdown";
import type {
  CategoryGridProps,
  ProductCardProps,
  ProductGridProps,
  SectionProps,
  StorefrontCategory,
  StorefrontProduct,
  ThemeContext,
} from "@/themes/types";

/**
 * Bazar — dense grocery marketplace theme.
 *
 * A dedicated implementation rather than a `kit` variant: the reference layout
 * is a supermarket storefront with a two-row header (location + search, then a
 * green category bar), a green hero with a featured basket card, icon category
 * tiles, a live flash-deal strip, a filterable product grid, a free-delivery
 * promo with a coupon, guarantee cards, testimonials and a mint footer.
 *
 * Every colour comes from `--store-*` tokens, so a merchant's palette and copy
 * flow straight through.
 */

const primary = "var(--store-primary)";
const accent = "var(--store-accent)";
const surface = "var(--store-surface)";
const background = "var(--store-background)";
const deep = "color-mix(in srgb, var(--store-primary) 78%, #04160c)";
const soft = "color-mix(in srgb, var(--store-primary) 10%, #ffffff)";
const AMBER = "#F5A524";
const DEAL = "#D92D20";

const BN_DIGITS = ["০", "১", "২", "৩", "৪", "৫", "৬", "৭", "৮", "৯"];

/** Western digits → Bengali, so prices match the rest of the UI. */
function bn(value: string | number): string {
  return String(value).replace(/\d/g, (digit) => BN_DIGITS[Number(digit)]);
}

/** `৳1,250.00` → `৳১,২৫০.০০` */
function bdt(value: number): string {
  return bn(formatBdt(value));
}

function discountPercent(product: StorefrontProduct): number | null {
  const compare = product.comparePriceFrom;
  if (!compare || compare <= product.priceFrom) return null;
  return Math.round(((compare - product.priceFrom) / compare) * 100);
}

function initialOf(name: string): string {
  return name.trim().charAt(0) || "?";
}

/** Category tiles get an icon that matches the kind of goods. */
function categoryIcon(name: string, index: number) {
  const rules: Array<[RegExp, typeof Leaf]> = [
    [/সবজি|শাক|তরকারি/, Leaf],
    [/ফল/, Apple],
    [/মাছ/, Fish],
    [/মাংস|মুরগি/, Drumstick],
    [/মুদি|চাল|ডাল|তেল|চিনি/, Wheat],
    [/দুধ|ডিম/, Milk],
    [/স্ন্যাকস|বিস্কুট|চা|কফি/, Carrot],
  ];
  for (const [pattern, Icon] of rules) {
    if (pattern.test(name)) return Icon;
  }
  const fallback = [Leaf, Apple, Fish, Wheat, Milk, Beef, Egg, Store];
  return fallback[index % fallback.length];
}

/** A short supporting line that fits whatever trust item the merchant wrote. */
function trustNote(item: string): string {
  if (/রিটার্ন|ফেরত|বদল/.test(item)) return "পণ্যে সমস্যা হলে সহজে ফেরত";
  if (/ডেলিভারি|পৌঁছ/.test(item)) return "ঢাকায় ২৪ ঘণ্টায় পৌঁছে যাবে";
  if (/পেমেন্ট|ক্যাশ|bkash|nagad/i.test(item)) return "bKash, Nagad, কার্ড বা ক্যাশ";
  if (/দাম|মূল্য|সাশ্রয়/.test(item)) return "প্রতিদিন বাজারের সেরা দাম";
  if (/মান|টাটকা|তাজা/.test(item)) return "হাতে বাছাই করা টাটকা পণ্য";
  if (/ওজন/.test(item)) return "সঠিক ওজনে মাপা হয়";
  return "প্রতিটি অর্ডারে নিশ্চিন্ত সেবা";
}

function Stars({ className = "h-3 w-3" }: { className?: string }) {
  return (
    <span className="inline-flex gap-0.5" style={{ color: AMBER }} aria-hidden>
      {Array.from({ length: 5 }).map((_, index) => (
        <Star key={index} className={`${className} fill-current`} />
      ))}
    </span>
  );
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
            className="mb-1.5 inline-flex items-center gap-1.5 text-[10px] font-bold tracking-[0.16em] uppercase"
            style={{ color: primary }}
          >
            <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ background: accent }} />
            {eyebrow}
          </p>
        ) : null}
        <h2 className="text-[21px] leading-tight font-extrabold tracking-tight sm:text-[26px]">{title}</h2>
        {subtitle ? <p className="muted mt-1.5 max-w-xl text-[12px] leading-6">{subtitle}</p> : null}
      </div>
      {href && linkLabel ? (
        <Link
          href={href}
          className="inline-flex items-center gap-1 text-[11.5px] font-bold whitespace-nowrap hover:underline"
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
  const contact = storePath(ctx.slug, "/page/contact");
  const phone = ctx.contact.phone;
  const centered = header.style === "centered";
  const minimal = header.style === "minimal";
  const showSearch = header.showSearch && !minimal;

  const logo = (
    <Link href={home} className="flex shrink-0 items-center gap-2" aria-label={ctx.storeName}>
      <span
        className="grid h-9 w-9 place-items-center rounded-xl text-white shadow-sm sm:h-10 sm:w-10"
        style={{ background: primary }}
      >
        <ShoppingBasket className="h-5 w-5" />
      </span>
      <span className="leading-none">
        <span className="block text-[15.5px] font-extrabold tracking-tight sm:text-[18px]">
          {ctx.storeName}
        </span>
        {!minimal ? (
          <span className="muted mt-1 block text-[8.5px] font-semibold tracking-[0.14em]">
            টাটকা বাজার, প্রতিদিন
          </span>
        ) : null}
      </span>
    </Link>
  );

  const location = !minimal && !centered ? (
    <div
      className="hidden items-center gap-1.5 rounded-lg border px-2.5 py-1.5 lg:flex"
      style={{ borderColor: "color-mix(in srgb, var(--store-primary) 16%, transparent)" }}
    >
      <MapPin className="h-4 w-4 shrink-0" style={{ color: primary }} />
      <span className="leading-tight">
        <span className="muted block text-[8.5px] font-medium">ডেলিভারি এরিয়া</span>
        <span className="block text-[11.5px] font-bold whitespace-nowrap">মিরপুর, ঢাকা</span>
      </span>
      <ChevronDown className="h-3.5 w-3.5 opacity-50" />
    </div>
  ) : null;

  const searchBox = (inCenteredRow: boolean) => (
    <form
      action={shop}
      className={`${inCenteredRow ? "flex w-full max-w-md flex-1" : "hidden flex-1 md:flex"} items-center gap-2 rounded-lg border px-3 py-2`}
      style={{
        borderColor: "color-mix(in srgb, var(--store-primary) 16%, transparent)",
        background: surface,
      }}
    >
      <Search className="h-4 w-4 shrink-0 opacity-50" />
      <input
        type="search"
        name="q"
        placeholder="সবজি, মাছ, মুদি — যা খুঁজছেন লিখুন…"
        className="min-w-0 flex-1 bg-transparent text-[12.5px] outline-none placeholder:opacity-60"
      />
      <button
        type="submit"
        className="store-btn shrink-0 rounded-md px-3 py-1.5 text-[11.5px] font-bold text-white"
        style={{ background: primary }}
      >
        খুঁজুন
      </button>
    </form>
  );

  const actions = (
    <div className="ml-auto flex items-center gap-2">
      {phone ? (
        <a href={`tel:${phone}`} className="hidden items-center gap-2 xl:flex">
          <span
            className="grid h-8 w-8 place-items-center rounded-lg"
            style={{ background: soft, color: primary }}
          >
            <Phone className="h-3.5 w-3.5" />
          </span>
          <span className="leading-tight">
            <span className="muted block text-[8.5px] font-medium">হটলাইন</span>
            <span className="block text-[11.5px] font-bold whitespace-nowrap">{bn(phone)}</span>
          </span>
        </a>
      ) : null}

      <Link
        href={contact}
        className="hidden items-center gap-1.5 rounded-lg border px-2.5 py-2 text-[11.5px] font-semibold sm:inline-flex"
        style={{
          borderColor: "color-mix(in srgb, var(--store-primary) 16%, transparent)",
          color: primary,
        }}
      >
        <Tag className="h-3.5 w-3.5" />
        অর্ডার ট্র্যাক
      </Link>

      {showSearch && !centered ? (
        <Link
          href={shop}
          aria-label="পণ্য খুঁজুন"
          className="grid h-9 w-9 place-items-center rounded-lg border md:hidden"
          style={{
            borderColor: "color-mix(in srgb, var(--store-primary) 16%, transparent)",
          }}
        >
          <Search className="h-4 w-4" />
        </Link>
      ) : null}

      <Link
        href={cart}
        className="store-btn inline-flex h-9 items-center gap-1.5 rounded-lg px-3 text-white transition hover:opacity-90"
        style={{ background: primary }}
        aria-label="কার্ট"
      >
        <ShoppingCart className="h-4 w-4" />
        <span className="hidden text-[12px] font-bold sm:inline">কার্ট</span>
      </Link>
    </div>
  );

  return (
    <header className={`${header.sticky ? "sticky top-0" : "relative"} z-40 border-b border-black/5 bg-white`}>
      {ctx.announcement ? (
        <div className="text-white" style={{ background: deep }}>
          <div className="atlas-shell flex items-center justify-center gap-2 py-1.5 text-center text-[10.5px] font-medium sm:text-[11.5px]">
            <Sparkles className="hidden h-3 w-3 shrink-0 sm:block" />
            <span className="truncate">{ctx.announcement}</span>
          </div>
        </div>
      ) : null}

      {centered ? (
        <div className="atlas-shell flex flex-col items-center gap-2 py-2.5">
          {logo}
          <div className="flex w-full flex-wrap items-center justify-center gap-2">
            {showSearch ? searchBox(true) : null}
            {actions}
          </div>
        </div>
      ) : (
        <div className="atlas-shell flex items-center gap-3 py-2.5">
          {logo}
          {location}
          {showSearch ? searchBox(false) : null}
          {actions}
        </div>
      )}

      {showSearch ? (
        <div className="atlas-shell pb-2.5 md:hidden">
          <form
            action={shop}
            className="flex items-center gap-2 rounded-lg border px-3 py-2"
            style={{
              borderColor: "color-mix(in srgb, var(--store-primary) 16%, transparent)",
              background: surface,
            }}
          >
            <Search className="h-4 w-4 shrink-0 opacity-50" />
            <input
              type="search"
              name="q"
              placeholder="পণ্য খুঁজুন…"
              className="min-w-0 flex-1 bg-transparent text-[12px] outline-none placeholder:opacity-60"
            />
            <button
              type="submit"
              className="store-btn shrink-0 rounded-md px-2.5 py-1 text-[11px] font-bold text-white"
              style={{ background: primary }}
            >
              খুঁজুন
            </button>
          </form>
        </div>
      ) : null}

      <div style={{ background: primary }}>
        <div className="atlas-shell flex items-center gap-1">
          <span className="hidden shrink-0 items-center gap-1.5 rounded-md bg-white/15 px-3 py-2 text-[11.5px] font-bold text-white lg:inline-flex">
            <Menu className="h-3.5 w-3.5" />
            সব ক্যাটাগরি
          </span>
          <nav className="no-scrollbar flex flex-1 gap-0.5 overflow-x-auto py-1">
            {ctx.navigation.map((link) => (
              <Link
                key={`${link.label}-${link.href}`}
                href={storePath(ctx.slug, link.href)}
                className="rounded-md px-2.5 py-2 text-[11.5px] font-medium whitespace-nowrap text-white/90 transition hover:bg-white/10 hover:text-white"
              >
                {link.label}
              </Link>
            ))}
          </nav>
          <span className="hidden shrink-0 items-center gap-1.5 pr-1 text-[10.5px] font-medium text-white/85 lg:flex">
            <Truck className="h-3.5 w-3.5" />
            ঢাকায় ২৪ ঘণ্টায় ডেলিভারি
          </span>
        </div>
      </div>
    </header>
  );
}

// ── Hero ─────────────────────────────────────────────────────────────────────

export function Hero({ ctx, products = [] }: SectionProps) {
  const { hero } = ctx.config;
  if (!hero.enabled) return null;

  const featured = products[0] ?? null;
  const points = ctx.config.trust.items.slice(0, 3);
  const pointIcons = [Truck, ShieldCheck, Clock];
  const shop = storePath(ctx.slug, "/shop");
  const centered = hero.align === "center";

  const tiles: StorefrontCategory[] = [];
  for (const product of products) {
    if (!product.categoryName) continue;
    if (tiles.some((tile) => tile.name === product.categoryName)) continue;
    tiles.push({
      id: product.categoryName,
      name: product.categoryName,
      slug: product.slug,
      productCount: 0,
    });
    if (tiles.length === 3) break;
  }

  return (
    <section className="relative overflow-hidden text-white" style={{ background: primary }}>
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.13]"
        style={{
          backgroundImage: "radial-gradient(circle at 1px 1px, #ffffff 1px, transparent 0)",
          backgroundSize: "18px 18px",
        }}
      />
      <div className="pointer-events-none absolute -top-24 -right-24 h-72 w-72 rounded-full bg-white/10 blur-2xl" />
      <div className="pointer-events-none absolute -bottom-28 -left-16 h-64 w-64 rounded-full bg-black/10 blur-2xl" />

      <div className="atlas-shell relative grid gap-8 py-8 lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:py-11">
        <div className={centered ? "text-center" : ""}>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-[10px] font-semibold ring-1 ring-white/25">
            <Sparkles className="h-3 w-3" />
            ১০০% টাটকা ও মানসম্মত
          </span>

          <h1 className="mt-3 text-[29px] leading-[1.18] font-extrabold tracking-tight sm:text-[40px]">
            {hero.title}
          </h1>

          <p className={`mt-3 max-w-xl text-[12.5px] leading-6 text-white/85 sm:text-[13px] ${centered ? "mx-auto" : ""}`}>
            {hero.subtitle}
          </p>

          <div className={`mt-5 flex flex-wrap items-center gap-2.5 ${centered ? "justify-center" : ""}`}>
            <Link
              href={storePath(ctx.slug, hero.ctaHref)}
              className="store-btn inline-flex items-center gap-1.5 rounded-lg bg-white px-5 py-2.5 text-[12.5px] font-bold shadow-[0_12px_24px_-14px_rgba(0,0,0,0.6)] transition hover:bg-white/95"
              style={{ color: primary }}
            >
              {hero.ctaLabel} <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href={shop}
              className="store-btn inline-flex items-center gap-1.5 rounded-lg border border-white/45 px-5 py-2.5 text-[12.5px] font-semibold text-white transition hover:bg-white/10"
            >
              সব ক্যাটাগরি
            </Link>
          </div>

          {points.length ? (
            <ul className={`mt-6 flex flex-wrap gap-x-5 gap-y-2 text-[11px] font-medium text-white/85 ${centered ? "justify-center" : ""}`}>
              {points.map((point, index) => {
                const Icon = pointIcons[index % pointIcons.length];
                return (
                  <li key={point} className="inline-flex items-center gap-1.5">
                    <Icon className="h-3.5 w-3.5" />
                    {point}
                  </li>
                );
              })}
            </ul>
          ) : null}
        </div>

        <div>
          <div className="rounded-2xl bg-white p-2.5 shadow-[0_26px_60px_-30px_rgba(0,0,0,0.6)]">
            <Link
              href={featured ? storePath(ctx.slug, `/product/${featured.slug}`) : shop}
              className="relative block overflow-hidden rounded-xl"
            >
              <div className="aspect-16/10 w-full overflow-hidden" style={{ background: surface }}>
                {featured?.imageUrl ? (
                  <img
                    src={featured.imageUrl}
                    alt={featured.name}
                    className="h-full w-full object-cover transition duration-500 hover:scale-[1.03]"
                  />
                ) : (
                  <div className="grid h-full place-items-center text-[13px] font-bold opacity-40">
                    {ctx.storeName}
                  </div>
                )}
              </div>
              <span
                className="absolute top-2.5 left-2.5 rounded-full px-2.5 py-1 text-[9.5px] font-bold text-white shadow"
                style={{ background: accent }}
              >
                প্রিমিয়াম মানের
              </span>
            </Link>

            <div className="px-1.5 pt-2.5 pb-1" style={{ color: "var(--store-text)" }}>
              <p className="text-[9px] font-bold tracking-[0.16em] uppercase" style={{ color: primary }}>
                {featured?.categoryName ?? "নির্বাচিত প্যাক"}
              </p>
              <p className="mt-0.5 truncate text-[13.5px] font-bold">
                {featured?.name ?? `${ctx.storeName} ফ্যামিলি প্যাক`}
              </p>
              <div className="mt-1 flex items-baseline gap-2">
                <span className="text-[17px] font-extrabold" style={{ color: primary }}>
                  {bdt(featured?.priceFrom ?? 0)}
                </span>
                {featured?.comparePriceFrom && featured.comparePriceFrom > featured.priceFrom ? (
                  <span className="muted text-[11px] line-through">{bdt(featured.comparePriceFrom)}</span>
                ) : null}
                <span className="ml-auto text-[10px] font-bold" style={{ color: primary }}>
                  সব দেখুন →
                </span>
              </div>
            </div>

            {tiles.length ? (
              <div className="mt-1 grid grid-cols-3 gap-1.5 border-t border-black/5 p-1.5">
                {tiles.map((tile, index) => {
                  const Icon = categoryIcon(tile.name, index);
                  return (
                    <Link
                      key={tile.name}
                      href={storePath(ctx.slug, `/shop?category=${tile.slug}`)}
                      className="flex items-center gap-1.5 rounded-lg px-2 py-2 transition hover:bg-white"
                      style={{ background: surface }}
                    >
                      <span
                        className="grid h-6 w-6 shrink-0 place-items-center rounded-md bg-white"
                        style={{ color: primary }}
                      >
                        <Icon className="h-3.5 w-3.5" />
                      </span>
                      <span
                        className="truncate text-[9.5px] font-semibold"
                        style={{ color: "var(--store-text)" }}
                      >
                        {tile.name}
                      </span>
                    </Link>
                  );
                })}
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}

// ── Categories ───────────────────────────────────────────────────────────────

export function CategoryGrid({ ctx, title, categories }: CategoryGridProps) {
  if (categories.length === 0) return null;

  return (
    <section className="py-8 sm:py-9" style={{ background: surface }}>
      <div className="atlas-shell">
        <SectionHeading
          eyebrow="ক্যাটাগরি"
          title={title || "জনপ্রিয় ক্যাটাগরি"}
          href={storePath(ctx.slug, "/shop")}
          linkLabel="সব ক্যাটাগরি"
        />

        <div
          className={`mt-5 grid grid-cols-3 gap-2.5 sm:grid-cols-4 ${
            categories.length >= 6
              ? "lg:grid-cols-6"
              : categories.length === 5
                ? "lg:grid-cols-5"
                : categories.length === 4
                  ? "lg:grid-cols-4"
                  : "lg:grid-cols-3"
          }`}
        >
          {categories.map((category, index) => {
            const Icon = categoryIcon(category.name, index);
            return (
              <Link
                key={category.id}
                href={storePath(ctx.slug, `/shop?category=${category.slug}`)}
                className="group flex flex-col items-center gap-2 rounded-xl border border-black/5 bg-white px-2 py-4 text-center transition hover:-translate-y-0.5 hover:shadow-[0_14px_28px_-20px_rgba(0,0,0,0.5)]"
              >
                <span
                  className="grid h-11 w-11 place-items-center rounded-full transition group-hover:scale-105"
                  style={{ background: soft, color: primary }}
                >
                  <Icon className="h-5 w-5" />
                </span>
                <span className="text-[11.5px] font-bold">{category.name}</span>
                <span className="muted -mt-1 text-[9.5px]">{bn(category.productCount)}টি পণ্য</span>
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}

// ── Product cards ────────────────────────────────────────────────────────────

function DealCard({ ctx, product }: { ctx: ThemeContext; product: StorefrontProduct }) {
  const off = discountPercent(product);
  const href = storePath(ctx.slug, `/product/${product.slug}`);

  return (
    <div className="group flex flex-col overflow-hidden rounded-xl border border-black/5 bg-white">
      <Link href={href} className="relative block">
        <div className="aspect-square overflow-hidden" style={{ background: surface }}>
          {product.imageUrl ? (
            <img
              src={product.imageUrl}
              alt={product.name}
              loading="lazy"
              className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.04]"
            />
          ) : (
            <div className="muted grid h-full place-items-center text-[10px]">ছবি নেই</div>
          )}
        </div>
        {off ? (
          <span
            className="absolute top-2 left-2 rounded-md px-1.5 py-0.5 text-[9px] font-bold text-white shadow"
            style={{ background: DEAL }}
          >
            {bn(off)}% ছাড়
          </span>
        ) : null}
      </Link>

      <div className="flex flex-1 flex-col p-2.5">
        {product.categoryName ? (
          <span className="muted text-[9px] font-semibold tracking-wide uppercase">
            {product.categoryName}
          </span>
        ) : null}
        <Link href={href} className="mt-0.5 line-clamp-2 text-[11.5px] leading-5 font-semibold">
          {product.name}
        </Link>
        <div className="mt-1.5 flex flex-wrap items-baseline gap-1.5">
          <span className="text-[13px] font-extrabold" style={{ color: primary }}>
            {bdt(product.priceFrom)}
          </span>
          {product.comparePriceFrom && product.comparePriceFrom > product.priceFrom ? (
            <span className="muted text-[10px] line-through">{bdt(product.comparePriceFrom)}</span>
          ) : null}
        </div>

        <div className="mt-auto flex items-center gap-1.5 pt-2">
          <Link
            href={href}
            className="store-btn inline-flex flex-1 items-center justify-center gap-1 rounded-lg px-2 py-1.5 text-[10.5px] font-bold text-white transition hover:opacity-90"
            style={{ background: primary }}
          >
            <ShoppingCart className="h-3 w-3" />
            কার্টে যোগ করুন
          </Link>
          <span
            aria-hidden
            className="grid h-7 w-7 shrink-0 place-items-center rounded-lg border border-black/10"
          >
            <Heart className="h-3.5 w-3.5" />
          </span>
        </div>
      </div>
    </div>
  );
}

export function ProductCard({ ctx, product }: ProductCardProps) {
  const off = discountPercent(product);
  const href = storePath(ctx.slug, `/product/${product.slug}`);
  const badge = !product.inStock ? "স্টক নেই" : off ? `${bn(off)}% ছাড়` : "নতুন";

  return (
    <div className="group relative flex flex-col overflow-hidden rounded-xl border border-black/5 bg-white transition hover:shadow-[0_18px_36px_-24px_rgba(0,0,0,0.55)]">
      <Link href={href} className="relative block">
        <div className="aspect-square overflow-hidden" style={{ background: surface }}>
          {product.imageUrl ? (
            <img
              src={product.imageUrl}
              alt={product.name}
              loading="lazy"
              className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.04]"
            />
          ) : (
            <div className="muted grid h-full place-items-center text-[10px]">ছবি নেই</div>
          )}
        </div>
        <span
          className="absolute top-2 left-2 rounded-md px-1.5 py-0.5 text-[9px] font-bold text-white shadow"
          style={{ background: off && product.inStock ? DEAL : "color-mix(in srgb, var(--store-text) 68%, transparent)" }}
        >
          {badge}
        </span>
        <span
          aria-hidden
          className="absolute top-2 right-2 grid h-7 w-7 place-items-center rounded-full bg-white/95 shadow-sm"
        >
          <Heart className="h-3.5 w-3.5" />
        </span>
      </Link>

      <div className="flex flex-1 flex-col p-2.5">
        {product.categoryName ? (
          <span className="muted text-[9px] font-semibold tracking-wide uppercase">
            {product.categoryName}
          </span>
        ) : null}
        <Link href={href} className="mt-0.5 line-clamp-2 text-[12px] leading-5 font-semibold">
          {product.name}
        </Link>

        <div className="mt-1.5 flex flex-wrap items-baseline gap-1.5">
          <span className="text-[13.5px] font-extrabold" style={{ color: primary }}>
            {bdt(product.priceFrom)}
          </span>
          {product.comparePriceFrom && product.comparePriceFrom > product.priceFrom ? (
            <span className="muted text-[10.5px] line-through">{bdt(product.comparePriceFrom)}</span>
          ) : null}
        </div>

        <p
          className="mt-1 inline-flex items-center gap-1 text-[9.5px] font-semibold"
          style={{ color: primary }}
        >
          <Truck className="h-3 w-3" />
          ফ্রি ডেলিভারি
        </p>

        <div className="mt-auto pt-2">
          <Link
            href={href}
            className="store-btn flex items-center justify-center gap-1 rounded-lg px-2 py-2 text-[11px] font-bold text-white transition hover:opacity-90"
            style={{ background: primary }}
          >
            <ShoppingCart className="h-3.5 w-3.5" />
            কার্টে যোগ করুন
          </Link>
        </div>
      </div>
    </div>
  );
}

// ── Product grid + flash deals ───────────────────────────────────────────────

export function ProductGrid({
  ctx,
  title,
  products,
  categories = [],
  columns = 4,
}: ProductGridProps) {
  if (products.length === 0) return null;

  const deals = products.slice(0, 4);
  const shop = storePath(ctx.slug, "/shop");

  const chips: Array<{ label: string; href: string }> = [
    { label: "সবগুলো", href: shop },
    { label: "সবচেয়ে বেশি বিক্রি", href: `${shop}?sort=newest` },
    { label: "দাম কম", href: `${shop}?sort=price-asc` },
    { label: "দাম বেশি", href: `${shop}?sort=price-desc` },
    ...categories.slice(0, 2).map((category) => ({
      label: category.name,
      href: `${shop}?category=${category.slug}`,
    })),
  ];

  return (
    <section className="py-8 sm:py-9" style={{ background: background }}>
      <div className="atlas-shell">
        {/* Flash deals */}
        <div className="overflow-hidden rounded-2xl border border-black/5 bg-white shadow-[0_18px_40px_-32px_rgba(0,0,0,0.5)]">
          <div
            className="flex flex-wrap items-center justify-between gap-3 border-b border-black/5 px-3 py-2.5 sm:px-4"
            style={{ background: surface }}
          >
            <div className="flex flex-wrap items-center gap-2">
              <span
                className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-bold text-white"
                style={{ background: DEAL }}
              >
                <Flame className="h-3 w-3" />
                আজকের ধামাকা অফার
              </span>
              <span className="inline-flex items-center gap-1 text-[9.5px] font-bold" style={{ color: DEAL }}>
                <span className="h-1.5 w-1.5 animate-pulse rounded-full" style={{ background: DEAL }} />
                LIVE
              </span>
              <p className="muted hidden text-[10.5px] sm:block">সীমিত সময়ের জন্য বিশেষ ছাড়</p>
            </div>
            <div className="flex items-center gap-2 text-[10.5px] font-semibold">
              <span className="muted">শেষ হবে</span>
              <DealCountdown />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2.5 p-2.5 sm:grid-cols-3 lg:grid-cols-4">
            {deals.map((product) => (
              <DealCard key={product.id} ctx={ctx} product={product} />
            ))}
          </div>
        </div>

        {/* Main grid */}
        <div className="mt-8 flex flex-wrap items-end justify-between gap-3">
          <div className="max-w-2xl">
            <p
              className="mb-1.5 inline-flex items-center gap-1.5 text-[10px] font-bold tracking-[0.16em] uppercase"
              style={{ color: primary }}
            >
              <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ background: accent }} />
              আজকের সেরা
            </p>
            <h2 className="text-[21px] leading-tight font-extrabold tracking-tight sm:text-[26px]">
              {title || "সবচেয়ে সেরা প্রোডাক্টের বাজার"}
            </h2>
            <p className="muted mt-1.5 text-[12px]">
              প্রতিদিন সকালে বাছাই করা টাটকা পণ্য — বাজারের সেরা দামে।
            </p>
          </div>

          <div className="no-scrollbar -mx-4 flex gap-1.5 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0">
            {chips.map((chip, index) => (
              <Link
                key={chip.href}
                href={chip.href}
                className="rounded-full border px-3 py-1.5 text-[11px] font-semibold whitespace-nowrap transition"
                style={
                  index === 0
                    ? { background: primary, borderColor: primary, color: "#fff" }
                    : {
                        borderColor: "color-mix(in srgb, var(--store-primary) 18%, transparent)",
                        color: "var(--store-text)",
                      }
                }
              >
                {chip.label}
              </Link>
            ))}
          </div>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4">
          {products.slice(0, columns === 3 ? 6 : 8).map((product) => (
            <ProductCard key={product.id} ctx={ctx} product={product} />
          ))}
        </div>

        <div className="mt-7 text-center">
          <Link
            href={shop}
            className="store-btn inline-flex items-center gap-1.5 rounded-full border px-5 py-2.5 text-[11.5px] font-bold transition hover:bg-[var(--store-surface)]"
            style={{
              borderColor: "color-mix(in srgb, var(--store-primary) 28%, transparent)",
              color: primary,
            }}
          >
            সবগুলো পণ্য দেখুন
            <ChevronDown className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>
    </section>
  );
}

// ── Promo + coupon ───────────────────────────────────────────────────────────

export function PromoBanner({ ctx }: SectionProps) {
  const { promo } = ctx.config;
  const shop = storePath(ctx.slug, "/shop");

  return (
    <>
      {promo.enabled && (promo.title || promo.body) ? (
        <section className="atlas-shell py-4">
          <div
            className="relative overflow-hidden rounded-2xl px-6 py-7 text-white sm:px-9 sm:py-8"
            style={{
              background: `linear-gradient(100deg, ${primary} 0%, color-mix(in srgb, var(--store-primary) 72%, #062b16) 100%)`,
            }}
          >
            <div className="pointer-events-none absolute -top-16 -right-10 h-52 w-52 rounded-full border border-white/15" />
            <div className="pointer-events-none absolute -right-8 -bottom-20 h-52 w-52 rounded-full border border-white/10" />
            <Truck className="pointer-events-none absolute right-6 bottom-4 h-20 w-20 opacity-10" />

            <div className="relative flex flex-wrap items-center justify-between gap-5">
              <div className="max-w-xl">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-2.5 py-1 text-[9.5px] font-bold tracking-[0.14em] uppercase ring-1 ring-white/25">
                  <Truck className="h-3 w-3" />
                  ফ্রি ডেলিভারি অফার
                </span>
                <h3 className="mt-2.5 text-[21px] leading-tight font-extrabold sm:text-[26px]">
                  {promo.title || "৫০০ টাকার উপরে ফ্রি ডেলিভারি!"}
                </h3>
                {promo.body ? (
                  <p className="mt-1.5 text-[12px] leading-6 text-white/85">{promo.body}</p>
                ) : null}
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <Link
                  href={storePath(ctx.slug, promo.ctaHref)}
                  className="store-btn rounded-lg border border-white/45 px-4 py-2.5 text-[11.5px] font-semibold text-white transition hover:bg-white/10"
                >
                  {promo.ctaLabel || "শর্ত দেখুন"}
                </Link>
                <Link
                  href={shop}
                  className="store-btn rounded-lg bg-white px-4 py-2.5 text-[11.5px] font-bold"
                  style={{ color: primary }}
                >
                  অফার দেখুন
                </Link>
              </div>
            </div>
          </div>
        </section>
      ) : null}

      <section className="atlas-shell pb-6">
        <div
          className="flex flex-wrap items-center gap-3 rounded-xl border border-black/5 px-3.5 py-3"
          style={{ background: surface }}
        >
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-white" style={{ color: primary }}>
            <Percent className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <p className="text-[11.5px] font-bold">নগদ পেমেন্টে ১০% ছাড়</p>
            <p className="muted text-[10px]">সর্বোচ্চ ২০০ টাকা পর্যন্ত — প্রথম অর্ডারে</p>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <span
              className="rounded-md border border-dashed px-2.5 py-1 text-[11px] font-bold tracking-wider"
              style={{ borderColor: primary, color: primary }}
            >
              DHK010
            </span>
            <Link
              href={shop}
              className="store-btn rounded-md px-3 py-1.5 text-[10.5px] font-bold text-white transition hover:opacity-90"
              style={{ background: primary }}
            >
              অফার নিন
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}

// ── Guarantees ───────────────────────────────────────────────────────────────

const TRUST_ICONS = [RotateCcw, BadgePercent, Truck, ShieldCheck] as const;

export function TrustBar({ ctx, title }: SectionProps) {
  const { trust } = ctx.config;
  if (!trust.enabled || trust.items.length === 0) return null;

  return (
    <section className="pb-8 sm:pb-9" style={{ background: background }}>
      <div className="atlas-shell">
        <div className="rounded-2xl px-4 py-6 sm:px-7 sm:py-7" style={{ background: surface }}>
          <div className="text-center">
            <h2 className="text-[18px] font-extrabold tracking-tight sm:text-[22px]">
              {title || "নির্ভর অনলাইন বাজারের নিশ্চয়তা"}
            </h2>
            <p className="muted mt-1 text-[11.5px]">প্রতিটি অর্ডারে মান, দাম আর সময়ের নিশ্চয়তা।</p>
          </div>

          <div className="mt-5 grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
            {trust.items.map((item, index) => {
              const Icon = TRUST_ICONS[index % TRUST_ICONS.length];
              return (
                <div
                  key={item}
                  className="flex items-start gap-2.5 rounded-xl bg-white px-3.5 py-3.5 shadow-[0_10px_24px_-22px_rgba(0,0,0,0.6)]"
                >
                  <span
                    className="grid h-9 w-9 shrink-0 place-items-center rounded-lg"
                    style={{ background: soft, color: primary }}
                  >
                    <Icon className="h-4 w-4" />
                  </span>
                  <div className="min-w-0">
                    <p className="text-[11.5px] font-bold">{item}</p>
                    <p className="muted mt-0.5 text-[10px] leading-4">{trustNote(item)}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}

// ── Testimonials ─────────────────────────────────────────────────────────────

export function Testimonials({ ctx, title }: SectionProps) {
  const { testimonials } = ctx.config;
  const items = testimonials.items.slice(0, 3);
  if (!testimonials.enabled || items.length === 0) return null;

  return (
    <section className="py-8 sm:py-9" style={{ background: background }}>
      <div className="atlas-shell">
        <SectionHeading
          align="center"
          eyebrow="ক্রেতার মতামত"
          title={title || "ক্রেতাদের অভিজ্ঞতা ও মতামত"}
          subtitle="প্রতিদিনের বাজারের অভিজ্ঞতা, সরাসরি ক্রেতাদের কাছ থেকে।"
        />

        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((item, index) => (
            <figure
              key={`${item.name}-${index}`}
              className="flex h-full flex-col rounded-xl border border-black/5 bg-white p-4 shadow-[0_14px_30px_-28px_rgba(0,0,0,0.6)]"
            >
              <Stars />
              <blockquote className="mt-2.5 flex-1 text-[11.5px] leading-6">“{item.quote}”</blockquote>
              <figcaption className="mt-3 flex items-center gap-2.5 border-t border-black/5 pt-3">
                <span
                  className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-[11px] font-bold text-white"
                  style={{ background: primary }}
                >
                  {initialOf(item.name)}
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-[11px] font-bold">{item.name}</span>
                  {item.location ? (
                    <span className="muted block text-[9.5px]">{item.location}</span>
                  ) : null}
                </span>
                <span
                  className="ml-auto inline-flex shrink-0 items-center gap-0.5 text-[9px] font-bold"
                  style={{ color: "#1F7A4D" }}
                >
                  <BadgeCheck className="h-3 w-3" />
                  যাচাইকৃত
                </span>
              </figcaption>
            </figure>
          ))}
        </div>
      </div>
    </section>
  );
}

// ── Footer ───────────────────────────────────────────────────────────────────

export function Footer({ ctx }: SectionProps) {
  const { footer } = ctx.config;
  const year = new Date().getFullYear();
  const payments = ["bKash", "Nagad", "Rocket", "Visa", "Mastercard"];

  return (
    <footer className="mt-auto border-t border-black/5" style={{ background: surface }}>
      <div className="atlas-shell grid gap-7 py-9 sm:grid-cols-2 lg:grid-cols-[1.35fr_1fr_1fr_1.15fr]">
        <div>
          <div className="flex items-center gap-2">
            <span
              className="grid h-8 w-8 place-items-center rounded-lg text-white"
              style={{ background: primary }}
            >
              <ShoppingBasket className="h-4 w-4" />
            </span>
            <p className="text-[15px] font-extrabold tracking-tight">{ctx.storeName}</p>
          </div>
          <p className="muted mt-2 max-w-xs text-[11px] leading-6">
            {footer.about || ctx.tagline || "প্রতিদিনের টাটকা বাজার, বাজারের দামে।"}
          </p>
          <ul className="muted mt-3 space-y-1.5 text-[11px]">
            {ctx.contact.phone ? (
              <li className="flex items-center gap-2">
                <Phone className="h-3.5 w-3.5 shrink-0" style={{ color: primary }} />
                {ctx.contact.phone}
              </li>
            ) : null}
            {ctx.contact.email ? (
              <li className="flex items-center gap-2">
                <Mail className="h-3.5 w-3.5 shrink-0" style={{ color: primary }} />
                {ctx.contact.email}
              </li>
            ) : null}
            <li className="flex items-center gap-2">
              <MapPin className="h-3.5 w-3.5 shrink-0" style={{ color: primary }} />
              মিরপুর, ঢাকা
            </li>
          </ul>
        </div>

        {footer.columns.map((column) => (
          <div key={column.title}>
            <p className="text-[11.5px] font-extrabold">{column.title}</p>
            <ul className="mt-2.5 space-y-2 text-[11px]">
              {column.links.map((link) => (
                <li key={`${column.title}-${link.href}`}>
                  <Link
                    href={storePath(ctx.slug, link.href)}
                    className="muted transition hover:opacity-80"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}

        <div>
          <p className="text-[11.5px] font-extrabold">যোগাযোগ ও পেমেন্ট</p>
          <ul className="muted mt-2.5 space-y-2 text-[11px]">
            <li className="flex items-center gap-2">
              <Clock className="h-3.5 w-3.5 shrink-0" style={{ color: primary }} />
              প্রতিদিন সকাল ৮টা — রাত ১০টা
            </li>
            <li className="flex items-center gap-2">
              <CreditCard className="h-3.5 w-3.5 shrink-0" style={{ color: primary }} />
              ক্যাশ অন ডেলিভারি চালু
            </li>
          </ul>

          <div className="mt-3 flex flex-wrap gap-1.5">
            {payments.map((method) => (
              <span
                key={method}
                className="rounded-md border border-black/10 bg-white px-2 py-0.5 text-[9px] font-semibold"
              >
                {method}
              </span>
            ))}
          </div>
        </div>
      </div>

      <div className="border-t border-black/5">
        <div className="atlas-shell flex flex-col gap-1.5 py-3.5 text-[10.5px] sm:flex-row sm:items-center sm:justify-between">
          <p className="muted">{footer.note || `© ${year} ${ctx.storeName}`}</p>
          <div className="muted flex flex-wrap gap-3">
            <Link href={storePath(ctx.slug, "/page/privacy")} className="hover:opacity-80">
              প্রাইভেসি
            </Link>
            <Link href={storePath(ctx.slug, "/page/terms")} className="hover:opacity-80">
              শর্তাবলী
            </Link>
            <Link href={storePath(ctx.slug, "/page/contact")} className="hover:opacity-80">
              যোগাযোগ
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
