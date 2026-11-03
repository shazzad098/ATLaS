import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, ExternalLink, Eye, Settings2 } from "lucide-react";
import { readSession } from "@/lib/auth/session";
import { NotFoundError } from "@/lib/errors";
import { getThemeDetail } from "@/lib/services/theme-service";
import { DEFAULT_THEME_CODE, THEME_VARIANTS } from "@/themes";
import {
  CategoryGrid,
  Footer,
  Header,
  Hero,
  ProductGrid,
  PromoBanner,
  Testimonials,
  TrustBar,
} from "@/themes/kit";
import { themeStyle } from "@/themes/css";
import type { SectionVariant, StorefrontCategory, StorefrontProduct, ThemeContext } from "@/themes/types";
import type { ThemeCatalogEntry, ThemeConfig } from "@/lib/theme-catalog";

/**
 * Full-page theme preview for the Super Admin catalog.
 *
 * Opens in its own tab (the catalog card links with `target="_blank"`) and
 * renders the real section kit with the theme's default config plus demo
 * products/categories. The preview is intentionally non-interactive: links in
 * the theme point at a storefront that does not exist, so the surface is
 * `pointer-events-none` and the toolbar above it carries the real actions.
 */

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  try {
    const detail = await getThemeDetail(code);
    return { title: `${detail.entry.name} — থিম প্রিভিউ` };
  } catch {
    return { title: "থিম প্রিভিউ" };
  }
}

type DemoCopy = {
  categories: string[];
  products: Array<{ name: string; price: number; compare?: number }>;
};

/** Theme-appropriate demo copy so each preview feels like a real shop. */
const DEMO: Record<string, DemoCopy> = {
  nokshi: {
    categories: ["শাড়ি", "পাঞ্জাবি", "ওড়না", "গয়না"],
    products: [
      { name: "হাতে বোনা জামদানি শাড়ি", price: 4850, compare: 6200 },
      { name: "সুতি এমব্রয়ডারি পাঞ্জাবি", price: 2490, compare: 3100 },
      { name: "সিল্ক ওড়না — গোলাপি", price: 1490 },
      { name: "কাঠের হাতে গড়া গয়না", price: 890, compare: 1200 },
      { name: "ব্লক প্রিন্ট থ্রি-পিস", price: 3200 },
      { name: "চামড়ার হ্যান্ডব্যাগ", price: 3900, compare: 4600 },
      { name: "হ্যান্ড পেইন্টেড পট", price: 1250 },
      { name: "এমব্রয়ডারি কুশন কভার", price: 750 },
    ],
  },
  bazar: {
    categories: ["মুদি", "স্ন্যাকস", "পানীয়", "ঘরোয়া"],
    products: [
      { name: "মিনিকেট চাল — ৫ কেজি", price: 420, compare: 480 },
      { name: "খাঁটি সরিষার তেল — ১ লিটার", price: 310 },
      { name: "চিনি — ১ কেজি", price: 135 },
      { name: "মশলা কম্বো প্যাক", price: 540, compare: 650 },
      { name: "ড্রাই ফ্রুটস মিক্স", price: 690 },
      { name: "সাবান ও ডিটারজেন্ট কম্বো", price: 380, compare: 450 },
      { name: "বিস্কুট ফ্যামিলি প্যাক", price: 250 },
      { name: "কোল্ড ড্রিংক — ২ লিটার", price: 160 },
    ],
  },
  studio: {
    categories: ["অডিও", "গ্যাজেট", "হোম", "অফিস"],
    products: [
      { name: "ওয়্যারলেস হেডফোন", price: 3490, compare: 4200 },
      { name: "স্মার্ট ওয়াচ — সিরিজ ৫", price: 5990 },
      { name: "মেকানিক্যাল কীবোর্ড", price: 4250, compare: 4900 },
      { name: "পোর্টেবল স্পিকার", price: 2790 },
      { name: "ডেস্ক ল্যাম্প — মিনিমাল", price: 1890 },
      { name: "USB-C হাব", price: 1450, compare: 1750 },
      { name: "নয়েজ ক্যানসেলিং ইয়ারবাড", price: 3890 },
      { name: "কেবল অর্গানাইজার সেট", price: 590 },
    ],
  },
};

const FALLBACK_DEMO: DemoCopy = {
  categories: ["নতুন", "জনপ্রিয়", "অফার", "সব"],
  products: [
    { name: "প্রিমিয়াম প্রোডাক্ট", price: 1990, compare: 2490 },
    { name: "বেসিক কলেকশন", price: 1290 },
    { name: "লিমিটেড এডিশন", price: 3490, compare: 3990 },
    { name: "এভরিডে আইটেম", price: 890 },
    { name: "গিফট বক্স", price: 1590 },
    { name: "হ্যান্ডমেড আইটেম", price: 2190 },
    { name: "ফ্যামিলি প্যাক", price: 2790, compare: 3200 },
    { name: "ট্রাভেল কিট", price: 1150 },
  ],
};

/**
 * Abstract product photography generated from the theme's own palette, so a
 * preview never depends on a remote image or a seeded demo store.
 */
function productImage(entry: ThemeCatalogEntry, index: number): string {
  const swatches = entry.preview.swatches;
  const a = swatches[index % swatches.length] ?? "#475569";
  const b = swatches[(index + 1) % swatches.length] ?? "#94a3b8";
  const c = swatches[(index + 2) % swatches.length] ?? "#e2e8f0";
  const rotation = (index * 27) % 360;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="1000" viewBox="0 0 800 1000">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${a}" stop-opacity="0.20"/>
      <stop offset="0.55" stop-color="${b}" stop-opacity="0.26"/>
      <stop offset="1" stop-color="${c}" stop-opacity="0.42"/>
    </linearGradient>
    <radialGradient id="shine" cx="0.28" cy="0.22" r="0.85">
      <stop offset="0" stop-color="#ffffff" stop-opacity="0.9"/>
      <stop offset="1" stop-color="#ffffff" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="800" height="1000" fill="#f8f6f2"/>
  <rect width="800" height="1000" fill="url(#bg)"/>
  <g transform="rotate(${rotation} 400 500)" opacity="0.92">
    <rect x="215" y="315" width="370" height="400" rx="120" fill="${c}" opacity="0.34"/>
    <circle cx="400" cy="470" r="145" fill="#ffffff" opacity="0.5"/>
    <circle cx="468" cy="430" r="68" fill="${a}" opacity="0.28"/>
    <circle cx="338" cy="548" r="42" fill="${b}" opacity="0.35"/>
  </g>
  <rect width="800" height="1000" fill="url(#shine)"/>
</svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

function buildCategories(copy: DemoCopy): StorefrontCategory[] {
  return copy.categories.map((name, index) => ({
    id: `preview-category-${index}`,
    name,
    slug: `category-${index}`,
    productCount: copy.products.filter((_, productIndex) => productIndex % copy.categories.length === index)
      .length,
  }));
}

function buildProducts(entry: ThemeCatalogEntry, copy: DemoCopy): StorefrontProduct[] {
  return copy.products.map((product, index) => ({
    id: `preview-product-${index}`,
    name: product.name,
    slug: `product-${index}`,
    priceFrom: product.price,
    comparePriceFrom: product.compare ?? null,
    imageUrl: productImage(entry, index),
    inStock: index !== 6,
    categoryName: copy.categories[index % copy.categories.length] ?? null,
  }));
}

function sectionNode(
  section: ThemeConfig["sections"][number],
  variant: SectionVariant,
  ctx: ThemeContext,
  products: StorefrontProduct[],
  categories: StorefrontCategory[],
) {
  switch (section.key) {
    case "Header":
    case "Footer":
      return null;
    case "Hero":
      return <Hero key="Hero" ctx={ctx} variant={variant} featured={products} />;
    case "CategoryGrid":
      return (
        <CategoryGrid
          key="CategoryGrid"
          ctx={ctx}
          variant={variant}
          title={section.title}
          categories={categories}
        />
      );
    case "ProductGrid":
      return (
        <ProductGrid
          key="ProductGrid"
          ctx={ctx}
          variant={variant}
          title={section.title}
          products={products}
          columns={4}
        />
      );
    case "PromoBanner":
      return <PromoBanner key="PromoBanner" ctx={ctx} variant={variant} />;
    case "Testimonials":
      return <Testimonials key="Testimonials" ctx={ctx} variant={variant} />;
    case "TrustBar":
      return <TrustBar key="TrustBar" ctx={ctx} variant={variant} />;
    default:
      return null;
  }
}

export default async function ThemePreviewPage({ params }: { params: Promise<{ code: string }> }) {
  const session = await readSession();
  if (!session) redirect("/login");
  if (!session.user.isSuperAdmin) redirect("/admin");

  const { code } = await params;

  let detail;
  try {
    detail = await getThemeDetail(code);
  } catch (error) {
    if (error instanceof NotFoundError) notFound();
    throw error;
  }

  const { entry, theme, stores } = detail;
  const config = entry.defaultConfig;
  const variant = THEME_VARIANTS[code] ?? THEME_VARIANTS[DEFAULT_THEME_CODE];
  const copy = DEMO[code] ?? FALLBACK_DEMO;
  const products = buildProducts(entry, copy);
  const categories = buildCategories(copy);
  const liveStore = stores.find((store) => store.status === "PUBLISHED");
  const active = theme?.status !== "ARCHIVED";

  const ctx: ThemeContext = {
    slug: "_preview",
    storeName: `${entry.name} স্টোর`,
    tagline: entry.description,
    config,
    navigation: config.navigation.length
      ? config.navigation
      : [
          { label: "হোম", href: "/" },
          { label: "দোকান", href: "/shop" },
        ],
    contact: { phone: "+8801700000000", email: "hello@atlas.example", whatsapp: "" },
    announcement: config.header.announcement,
  };

  const sections = config.sections.filter((section) => section.enabled);

  return (
    <div className="min-h-screen bg-slate-950">
      {/* Preview toolbar — part of the platform UI, not the theme. */}
      <header className="border-b border-white/10 bg-slate-950 text-white">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
          <Link
            href="/super-admin/themes"
            className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-300 transition hover:text-white"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            থিম ক্যাটালগ
          </Link>

          <span className="hidden h-4 w-px bg-white/15 sm:block" />

          <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-2.5 py-1 text-[10px] font-semibold tracking-wide">
            <Eye className="h-3 w-3" />
            প্রিভিউ মোড
          </span>

          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">{entry.name}</p>
            <p className="truncate text-[10px] text-slate-400">
              {entry.style} · {entry.code} · v{entry.version}
            </p>
          </div>

          <div className="flex items-center gap-1.5">
            {entry.preview.swatches.map((swatch) => (
              <span
                key={swatch}
                className="h-4 w-4 rounded-full ring-1 ring-white/25"
                style={{ background: swatch }}
              />
            ))}
            <span
              className={`ml-1 rounded-full px-2 py-0.5 text-[9px] font-semibold ${
                active ? "bg-emerald-400/15 text-emerald-300" : "bg-amber-400/15 text-amber-300"
              }`}
            >
              {active ? "ACTIVE" : "INACTIVE"}
            </span>
          </div>

          <div className="ml-auto flex flex-wrap items-center gap-2">
            {liveStore ? (
              <Link
                href={`/store/${liveStore.slug}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 rounded-lg bg-white px-3 py-1.5 text-[11px] font-semibold text-slate-900 transition hover:bg-slate-100"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                লাইভ স্টোর
              </Link>
            ) : null}
            <Link
              href={`/super-admin/themes/${entry.code}`}
              className="inline-flex items-center gap-1.5 rounded-lg border border-white/20 px-3 py-1.5 text-[11px] font-medium text-slate-200 transition hover:border-white/40 hover:bg-white/5"
            >
              <Settings2 className="h-3.5 w-3.5" />
              কনফিগার
            </Link>
          </div>
        </div>
        <p className="mx-auto max-w-7xl px-4 pb-2 text-[10px] text-slate-500">
          ডেমো প্রোডাক্ট ও কনটেন্ট দিয়ে থিমের ডিফল্ট লেআউট দেখানো হচ্ছে — লিংকগুলো প্রিভিউতে নিষ্ক্রিয়।
        </p>
      </header>

      {/* The actual theme, rendered by the same section kit as the storefront. */}
      <div
        className="store-surface pointer-events-none flex min-h-[calc(100vh-4.5rem)] flex-col select-none"
        style={themeStyle(config)}
      >
        <Header ctx={ctx} variant={variant} />
        <main className="flex-1">
          {sections.map((section) => sectionNode(section, variant, ctx, products, categories))}
        </main>
        <Footer ctx={ctx} variant={variant} />
      </div>
    </div>
  );
}
