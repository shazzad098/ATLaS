import Link from "next/link";
import { ButtonLink } from "@/components/ui/button";
import { Table, Td, Th } from "@/components/ui/shell";
import { THEME_CATALOG, THEME_SECTION_KEYS } from "@/lib/theme-catalog";
import { getAvailableDemoStoreSlugs } from "@/lib/demo-stores";

/** Public theme gallery (PRD §7). */

export const metadata = {
  title: "থিম গ্যালারি",
  description: "Nokshi, Bazar ও Studio — তিনটি তৈরি theme, একই সেকশন কাঠামো।",
};

export const dynamic = "force-dynamic";

const SECTION_LABEL: Record<string, string> = {
  Header: "হেডার",
  Hero: "হিরো",
  CategoryGrid: "ক্যাটাগরি",
  ProductGrid: "প্রোডাক্ট গ্রিড",
  PromoBanner: "প্রোমো ব্যানার",
  Testimonials: "রিভিউ",
  TrustBar: "ট্রাস্ট বার",
  Footer: "ফুটার",
};

const SECTION_HELP: Record<string, string> = {
  Header: "লোগো, নেভিগেশন, সার্চ ও ঘোষণা বার",
  Hero: "বড় শিরোনাম, সাবটাইটেল ও একটি CTA বাটন",
  CategoryGrid: "ক্যাটাগরি কার্ডের গ্রিড",
  ProductGrid: "নির্বাচিত/সর্বশেষ প্রোডাক্ট",
  PromoBanner: "অফার বা ঘোষণার ব্যানার",
  Testimonials: "কাস্টমারের রিভিউ",
  TrustBar: "রিটার্ন, COD, অরিজিনালিটির মতো প্রতিশ্রুতি",
  Footer: "দোকান পরিচিতি, লিংক কলাম ও নোট",
};

const PLAN_LABEL: Record<string, string> = {
  free: "Free",
  basic: "Basic",
  standard: "Standard",
  pro: "Pro",
};

/** Seeded demo storefront for each theme (may be absent in a fresh install). */
const DEMO_SLUGS: Record<string, string> = {
  nokshi: "nokshi-demo",
  bazar: "dhaka-bazar",
  studio: "studio-demo",
};

const BN_DIGITS = ["০", "১", "২", "৩", "৪", "৫", "৬", "৭", "৮", "৯"];

function bn(value: number | string) {
  return String(value).replace(/\d/g, (digit) => BN_DIGITS[Number(digit)]);
}

function radiusFor(style: "rounded" | "pill" | "square") {
  if (style === "pill") return "9999px";
  if (style === "square") return "2px";
  return "8px";
}

const HERO_THEME = THEME_CATALOG[0];
const HERO_CONFIG = HERO_THEME.defaultConfig;

const MARQUEE_ITEMS = [
  `${bn(THEME_CATALOG.length)}টি তৈরি থিম`,
  `${bn(THEME_SECTION_KEYS.length)}টি সেকশন`,
  "একই ডেটা কাঠামো",
  "রঙ ও ফন্ট কাস্টমাইজ",
  "সব প্ল্যানে উপলব্ধ",
  "মোবাইল-ফার্স্ট ডিজাইন",
];

export default async function ThemesPage() {
  const demoSlugs = await getAvailableDemoStoreSlugs();
  return (
    <div className="overflow-hidden bg-white">
      {/* Hero */}
      <section className="relative overflow-hidden border-b border-ink-100 bg-gradient-to-b from-brand-50/90 via-white to-white">
        <div aria-hidden="true" className="pointer-events-none absolute inset-0">
          <div className="animate-drift absolute -top-56 left-1/3 h-[34rem] w-[34rem] rounded-full bg-brand-200/45 blur-3xl" />
          <div className="animate-float-slow absolute -left-28 top-28 h-72 w-72 rounded-full bg-rose-200/30 blur-3xl" />
          <div className="animate-float absolute -right-24 top-16 h-72 w-72 rounded-full bg-accent-400/15 blur-3xl" />
          <div className="absolute inset-0 bg-[radial-gradient(#d5d9e2_1px,transparent_1px)] [background-size:22px_22px] opacity-40 [mask-image:radial-gradient(ellipse_at_center,black,transparent_72%)]" />
        </div>

        <div className="relative mx-auto grid max-w-6xl items-center gap-12 px-4 pt-14 pb-16 sm:pt-20 lg:grid-cols-[1.02fr_0.98fr] lg:gap-14 lg:pb-24">
          <div>
            <div className="animate-fade-up">
              <span className="inline-flex items-center gap-2 rounded-full border border-brand-200 bg-white/85 px-3 py-1 text-[11px] font-semibold tracking-wide text-brand-800 shadow-xs backdrop-blur">
                <span className="h-1.5 w-1.5 rounded-full bg-brand-500" />
                ডিজাইন সিস্টেম
              </span>
            </div>

            <h1 className="animate-fade-up mt-5 text-3xl leading-[1.25] font-bold tracking-tight text-ink-900 sm:text-[44px] sm:leading-[1.18]" style={{ animationDelay: "80ms" }}>
              আপনার ব্র্যান্ডের জন্য{" "}
              <span className="relative inline-block bg-gradient-to-r from-brand-700 via-brand-600 to-brand-500 bg-clip-text text-transparent">
                সঠিক থিম
                <svg
                  viewBox="0 0 300 18"
                  preserveAspectRatio="none"
                  aria-hidden="true"
                  className="absolute -bottom-1.5 left-0 h-3 w-full text-brand-400 sm:h-4"
                >
                  <path
                    d="M3 12C48 4 96 15 147 9c51-6 99 4 150-3"
                    fill="none"
                    stroke="currentColor"
                    strokeLinecap="round"
                    strokeWidth="4"
                  />
                </svg>
              </span>
            </h1>

            <p className="animate-fade-up mt-7 max-w-xl text-sm leading-relaxed text-ink-600 sm:text-base" style={{ animationDelay: "160ms" }}>
              প্রতিটি থিমে একই সেকশন কাঠামো — রঙ, ফন্ট, হিরো আর সেকশনের ক্রম নিজের মতো সাজিয়ে নিন।
              থিম বদলালেও প্রোডাক্ট ও অর্ডার একই থাকে।
            </p>

            <div className="animate-fade-up mt-8 flex flex-wrap items-center gap-3" style={{ animationDelay: "240ms" }}>
              <ButtonLink href="/signup" size="lg">
                ফ্রি শুরু করুন
              </ButtonLink>
              {demoSlugs.has("nokshi-demo") ? (
                <ButtonLink href="/store/nokshi-demo" variant="outline" size="lg">
                  ডেমো দোকান দেখুন
                </ButtonLink>
              ) : null}
            </div>

            <div className="animate-fade-up mt-9 grid max-w-md grid-cols-3 gap-2.5" style={{ animationDelay: "320ms" }}>
              {[
                { value: bn(THEME_CATALOG.length), label: "তৈরি থিম" },
                { value: bn(THEME_SECTION_KEYS.length), label: "শেয়ারড সেকশন" },
                { value: "সব", label: "প্ল্যানে উপলব্ধ" },
              ].map((item) => (
                <div
                  key={item.label}
                  className="rounded-xl border border-white/70 bg-white/70 px-3 py-2.5 backdrop-blur transition duration-300 hover:-translate-y-0.5 hover:border-brand-200 hover:bg-white hover:shadow-sm"
                >
                  <p className="text-lg font-bold tracking-tight text-ink-900">{item.value}</p>
                  <p className="text-[10px] text-ink-500">{item.label}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Storefront preview */}
          <div className="animate-fade-up relative mx-auto w-full max-w-md lg:max-w-none" style={{ animationDelay: "200ms" }}>
            <div aria-hidden="true" className="absolute inset-x-8 top-8 h-full rotate-3 rounded-3xl border border-white/70 bg-gradient-to-br from-emerald-100/90 to-lime-50 shadow-lg" />
            <div aria-hidden="true" className="absolute inset-x-4 top-4 h-full rotate-1 rounded-3xl border border-white/70 bg-gradient-to-br from-slate-100 to-sky-50 shadow-lg" />

            <div className="relative rounded-3xl border border-white/80 bg-white/90 p-3 shadow-2xl shadow-brand-900/10 backdrop-blur">
              <div className="flex items-center gap-1.5 px-1 pb-2.5">
                <span className="h-2 w-2 rounded-full bg-rose-300" />
                <span className="h-2 w-2 rounded-full bg-amber-300" />
                <span className="h-2 w-2 rounded-full bg-emerald-300" />
                <span className="ml-2 flex-1 truncate rounded-md bg-ink-50 px-2 py-1 font-mono text-[9px] text-ink-500">
                  nokshi.atlas.app
                </span>
                <span className="inline-flex items-center gap-1 rounded-full bg-brand-50 px-2 py-0.5 text-[9px] font-medium text-brand-700">
                  <span className="animate-pulse-dot inline-block h-1.5 w-1.5 rounded-full bg-brand-500" />
                  লাইভ
                </span>
              </div>

              <div className="overflow-hidden rounded-2xl border border-ink-100 bg-white">
                <div className="flex items-center justify-between border-b border-ink-100 px-4 py-2.5">
                  <span
                    className="text-sm font-bold"
                    style={{
                      color: HERO_CONFIG.colors.primary,
                      fontFamily:
                        HERO_CONFIG.typography.headingFont === "serif" ? "var(--font-serif)" : "inherit",
                    }}
                  >
                    {HERO_THEME.name}
                  </span>
                  <div className="hidden items-center gap-3 text-[9px] text-ink-500 sm:flex">
                    {HERO_CONFIG.navigation.slice(0, 4).map((item) => (
                      <span key={item.href}>{item.label}</span>
                    ))}
                  </div>
                </div>

                <div className="px-4 pt-4 pb-3" style={{ backgroundColor: HERO_CONFIG.colors.surface }}>
                  <p
                    className="text-center text-sm leading-snug font-semibold"
                    style={{
                      color: HERO_CONFIG.colors.text,
                      fontFamily:
                        HERO_CONFIG.typography.headingFont === "serif" ? "var(--font-serif)" : "inherit",
                    }}
                  >
                    {HERO_CONFIG.hero.title}
                  </p>
                  <p className="mt-1.5 line-clamp-1 text-center text-[9px] text-ink-500">
                    {HERO_CONFIG.hero.subtitle}
                  </p>
                  <div className="mt-3 flex justify-center">
                    <span
                      className="px-3 py-1 text-[9px] font-medium text-white"
                      style={{
                        backgroundColor: HERO_CONFIG.colors.primary,
                        borderRadius: radiusFor(HERO_CONFIG.buttons.style),
                      }}
                    >
                      {HERO_CONFIG.hero.ctaLabel}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2 p-4">
                  {[0, 1, 2].map((index) => (
                    <div key={index} className="rounded-lg border border-ink-100 bg-white p-1.5">
                      <div
                        className="h-10 rounded"
                        style={{
                          background: `linear-gradient(135deg, ${HERO_THEME.preview.swatches[0]}22, ${HERO_THEME.preview.swatches[1]}44)`,
                        }}
                      />
                      <div className="mt-1.5 h-1.5 w-4/5 rounded-full bg-ink-100" />
                      <div className="mt-1 h-1.5 w-1/2 rounded-full bg-ink-100" />
                    </div>
                  ))}
                </div>

                <div className="flex flex-wrap items-center justify-center gap-1.5 border-t border-ink-100 px-3 py-2.5">
                  {HERO_CONFIG.trust.items.map((item) => (
                    <span
                      key={item}
                      className="rounded-full bg-ink-50 px-2 py-0.5 text-[8px] font-medium text-ink-500"
                    >
                      {item}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            <div className="animate-float absolute top-14 -left-3 hidden items-center gap-2 rounded-xl border border-ink-200/80 bg-white/95 px-3 py-2 shadow-lg shadow-ink-900/5 backdrop-blur sm:flex">
              <span className="grid h-6 w-6 place-items-center rounded-lg bg-brand-50 text-brand-700">
                <span className="text-[10px] font-bold">{bn(THEME_CATALOG.length)}</span>
              </span>
              <span className="text-[11px] font-semibold text-ink-800">তৈরি থিম</span>
            </div>

            <div
              className="animate-float-slow absolute top-4 -right-3 hidden items-center gap-2 rounded-xl border border-ink-200/80 bg-white/95 px-3 py-2 shadow-lg shadow-ink-900/5 backdrop-blur sm:flex"
              style={{ animationDelay: "1.1s" }}
            >
              <span className="grid h-6 w-6 place-items-center rounded-lg bg-brand-600 text-[10px] font-bold text-white">
                {bn(THEME_SECTION_KEYS.length)}
              </span>
              <span className="text-[11px] font-semibold text-ink-800">শেয়ারড সেকশন</span>
            </div>

            <div
              className="animate-float absolute -bottom-4 left-8 hidden items-center gap-2 rounded-xl border border-ink-200/80 bg-white/95 px-3 py-2 shadow-lg shadow-ink-900/5 backdrop-blur sm:flex"
              style={{ animationDelay: "0.6s" }}
            >
              <span className="grid h-6 w-6 place-items-center rounded-lg bg-brand-50 text-brand-700">
                <svg viewBox="0 0 24 24" aria-hidden="true" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
                  <path d="m5 12 5 5L20 7" />
                </svg>
              </span>
              <span className="text-[11px] font-semibold text-ink-800">একই ডেটা</span>
            </div>
          </div>
        </div>
      </section>

      {/* Capability marquee */}
      <section aria-label="থিম সিস্টেমের বৈশিষ্ট্য" className="border-b border-ink-100 bg-white py-4">
        <div className="marquee-mask pause-on-hover overflow-hidden">
          <div className="animate-marquee flex w-max items-center gap-2.5">
            {[...MARQUEE_ITEMS, ...MARQUEE_ITEMS].map((item, index) => (
              <span
                key={`${item}-${index}`}
                className="inline-flex items-center gap-2 rounded-full border border-ink-200 bg-ink-50/60 px-3 py-1.5 text-xs font-medium whitespace-nowrap text-ink-600"
              >
                <span className="h-1.5 w-1.5 rounded-full bg-brand-400" />
                {item}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* Theme collection */}
      <section className="relative mx-auto max-w-6xl px-4 py-16 sm:py-24">
        <div className="reveal mx-auto max-w-2xl text-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-brand-200 bg-white px-3 py-1 text-[11px] font-semibold tracking-wide text-brand-800 shadow-xs">
            <span className="h-1.5 w-1.5 rounded-full bg-brand-500" />
            কালেকশন
          </span>
          <h2 className="mt-4 text-2xl font-bold tracking-tight text-ink-900 sm:text-3xl">
            তিনটি থিম, তিন রকম প্রথম impression
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-ink-600">
            প্রতিটি কার্ডের ভেতরে থিমের আসল ডিফল্ট কনফিগ — রঙ, হিরো ও CTA সহ। পছন্দের থিম বেছে
            নিন, বাকিটা ডিজাইন স্ক্রিন থেকেই বদলে নিতে পারবেন।
          </p>
        </div>

        <div className="mt-10 grid gap-5 lg:grid-cols-3">
          {THEME_CATALOG.map((theme, index) => {
            const config = theme.defaultConfig;
            const headingFont =
              config.typography.headingFont === "serif" ? "var(--font-serif)" : "inherit";
            const demoSlug = DEMO_SLUGS[theme.code];
            const demoHref = demoSlug && demoSlugs.has(demoSlug) ? `/store/${demoSlug}` : undefined;

            return (
              <Link
                key={theme.code}
                href={demoHref ?? "/signup"}
                aria-label={`${theme.name} — ${demoHref ? "ডেমো দেখুন" : "এই থিমে শুরু করুন"}`}
                className="reveal group hover-shine relative flex h-full flex-col overflow-hidden rounded-2xl border border-ink-200 bg-white shadow-sm transition-all duration-300 hover:-translate-y-1.5 hover:border-brand-300 hover:shadow-2xl hover:shadow-brand-900/10"
                style={{ animationDelay: `${index * 90}ms` }}
              >
                <span
                  aria-hidden="true"
                  className={`absolute inset-x-0 top-0 z-10 h-1 origin-left scale-x-0 bg-gradient-to-r ${theme.preview.gradient} transition-transform duration-500 group-hover:scale-x-100`}
                />

                {/* Mini storefront preview */}
                <div className={`relative h-64 overflow-hidden bg-gradient-to-br ${theme.preview.gradient}`}>
                  <div className="absolute inset-x-3 top-3 bottom-0 overflow-hidden rounded-t-xl bg-white/90 shadow-sm ring-1 ring-white/70 backdrop-blur transition duration-500 group-hover:inset-x-2 group-hover:top-2">
                    <div className="flex items-center gap-1.5 border-b border-ink-100/80 px-3 py-2">
                      <span className="h-1.5 w-1.5 rounded-full bg-rose-300" />
                      <span className="h-1.5 w-1.5 rounded-full bg-amber-300" />
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-300" />
                      <span className="ml-1.5 truncate font-mono text-[9px] text-ink-500">
                        {theme.code}.atlas.app
                      </span>
                      <span className="ml-auto rounded-full bg-ink-100 px-1.5 py-0.5 text-[8px] font-medium text-ink-500">
                        v{theme.version}
                      </span>
                    </div>

                    <div className="p-3">
                      <div className="flex items-center justify-between gap-2">
                        <span
                          className="text-[11px] font-bold"
                          style={{ color: config.colors.primary, fontFamily: headingFont }}
                        >
                          {theme.name}
                        </span>
                        <div className="flex items-center gap-2 text-[7px] text-ink-400">
                          {config.navigation.slice(0, 3).map((item) => (
                            <span key={item.href}>{item.label}</span>
                          ))}
                        </div>
                      </div>

                      <div
                        className={`mt-2.5 rounded-lg px-3 py-3 ${
                          config.hero.align === "center" ? "text-center" : ""
                        }`}
                        style={{ backgroundColor: config.colors.surface }}
                      >
                        <p
                          className="line-clamp-2 text-[10px] leading-snug font-semibold"
                          style={{ color: config.colors.text, fontFamily: headingFont }}
                        >
                          {config.hero.title}
                        </p>
                        <p className="mt-1 line-clamp-1 text-[7px] text-ink-500">
                          {config.hero.subtitle}
                        </p>
                        <span
                          className="mt-2 inline-block px-2 py-0.5 text-[7px] font-medium text-white"
                          style={{
                            backgroundColor: config.colors.primary,
                            borderRadius: radiusFor(config.buttons.style),
                          }}
                        >
                          {config.hero.ctaLabel}
                        </span>
                      </div>

                      <div className="mt-2 grid grid-cols-3 gap-1.5">
                        {[0, 1, 2].map((slot) => (
                          <div key={slot} className="rounded-md border border-ink-100 bg-white p-1">
                            <div
                              className="h-7 rounded"
                              style={{
                                background: `linear-gradient(135deg, ${theme.preview.swatches[0]}26, ${theme.preview.swatches[1]}40)`,
                              }}
                            />
                            <div className="mt-1 h-1 w-4/5 rounded-full bg-ink-100" />
                            <div className="mt-1 h-1 w-1/2 rounded-full bg-ink-100" />
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Meta */}
                <div className="relative flex flex-1 flex-col p-5">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h3 className="text-base font-semibold text-ink-900">{theme.name}</h3>
                      <p className="mt-0.5 text-[11px] font-medium text-brand-700">{theme.style}</p>
                    </div>
                    <div className="flex shrink-0 gap-1">
                      {theme.preview.swatches.map((swatch) => (
                        <span
                          key={swatch}
                          className="h-4 w-4 rounded-full border border-white shadow-xs ring-1 ring-ink-200/70 transition duration-300 group-hover:scale-110"
                          style={{ background: swatch }}
                        />
                      ))}
                    </div>
                  </div>

                  <p className="mt-3 text-sm leading-relaxed text-ink-600">{theme.description}</p>

                  <dl className="mt-3 space-y-1.5 text-[11px] text-ink-500">
                    <div className="flex gap-1">
                      <dt className="shrink-0 font-medium text-ink-700">উপযোগী:</dt>
                      <dd>{theme.industry}</dd>
                    </div>
                    <div className="flex flex-wrap items-center gap-1">
                      <dt className="font-medium text-ink-700">প্ল্যান:</dt>
                      {theme.compatiblePlans.map((plan) => (
                        <dd
                          key={plan}
                          className="rounded-full border border-ink-200 bg-ink-50 px-1.5 py-px text-[10px] text-ink-600"
                        >
                          {PLAN_LABEL[plan] ?? plan}
                        </dd>
                      ))}
                    </div>
                  </dl>

                  <div className="mt-auto flex items-center justify-between gap-2 border-t border-ink-100 pt-3.5">
                    <span className="font-mono text-[10px] text-ink-400">v{theme.version}</span>
                    <span className="inline-flex items-center gap-1 text-xs font-semibold text-brand-700 transition group-hover:gap-2 group-hover:text-brand-800">
                      {demoHref ? "ডেমো দেখুন" : "এই থিমে শুরু করুন"}
                      <svg viewBox="0 0 24 24" aria-hidden="true" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                        <path d="M4 12h15M13 6l6 6-6 6" />
                      </svg>
                    </span>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </section>

      {/* Section contract */}
      <section className="relative border-y border-ink-100 bg-ink-50/50 py-16 sm:py-24">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(#d5d9e2_1px,transparent_1px)] [background-size:26px_26px] opacity-30 [mask-image:radial-gradient(ellipse_at_center,black,transparent_75%)]"
        />
        <div className="relative mx-auto max-w-4xl px-4">
          <div className="reveal mx-auto max-w-2xl text-center">
            <span className="inline-flex items-center gap-2 rounded-full border border-brand-200 bg-white px-3 py-1 text-[11px] font-semibold tracking-wide text-brand-800 shadow-xs">
              <span className="h-1.5 w-1.5 rounded-full bg-brand-500" />
              সেকশন কাঠামো
            </span>
            <h2 className="mt-4 text-2xl font-bold tracking-tight text-ink-900 sm:text-3xl">
              সব থিমে যে সেকশনগুলো আছে
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-ink-600">
              প্রতিটি সেকশন চালু/বন্ধ করা যায়, আর ক্রম (order) বদলানো যায় ডিজাইন স্ক্রিন থেকে।
            </p>
          </div>

          <div className="reveal mt-8 flex flex-wrap items-center justify-center gap-1.5">
            {THEME_SECTION_KEYS.map((key, index) => (
              <span key={key} className="flex items-center gap-1.5">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-ink-200 bg-white px-2.5 py-1 text-[11px] font-medium text-ink-600 transition duration-200 hover:-translate-y-0.5 hover:border-brand-300 hover:text-brand-800 hover:shadow-sm">
                  <span className="grid h-4 w-4 place-items-center rounded-full bg-brand-50 font-mono text-[8px] font-bold text-brand-700">
                    {bn(index + 1)}
                  </span>
                  {SECTION_LABEL[key] ?? key}
                </span>
                {index < THEME_SECTION_KEYS.length - 1 ? (
                  <span aria-hidden="true" className="text-ink-300">
                    ·
                  </span>
                ) : null}
              </span>
            ))}
          </div>

          <div className="reveal mt-8 overflow-hidden rounded-2xl border border-ink-200 bg-white shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-ink-100 px-5 py-4">
              <div>
                <p className="text-sm font-semibold text-ink-900">সেকশন রেফারেন্স</p>
                <p className="mt-0.5 text-xs text-ink-500">আটটি সেকশন — একই কনট্র্যাক্ট, তিনটি ভিন্ন চেহারা।</p>
              </div>
              <span className="rounded-full bg-brand-50 px-2.5 py-1 text-[10px] font-semibold text-brand-700">
                {bn(THEME_SECTION_KEYS.length)}টি সেকশন
              </span>
            </div>
            <Table>
              <thead>
                <tr className="bg-ink-50/60">
                  <Th>সেকশন</Th>
                  <Th>কী দেখায়</Th>
                </tr>
              </thead>
              <tbody>
                {THEME_SECTION_KEYS.map((key, index) => (
                  <tr key={key} className="transition-colors duration-200 hover:bg-brand-50/50">
                    <Td className="font-medium whitespace-nowrap text-ink-800">
                      <span className="flex items-center gap-2">
                        <span className="grid h-5 w-5 place-items-center rounded-md bg-ink-50 font-mono text-[9px] font-bold text-ink-400">
                          {bn(index + 1)}
                        </span>
                        {SECTION_LABEL[key] ?? key}
                      </span>
                    </Td>
                    <Td className="text-xs text-ink-500">{SECTION_HELP[key] ?? ""}</Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-5xl px-4 py-16 sm:py-24">
        <div className="reveal animate-gradient-pan relative overflow-hidden rounded-3xl bg-gradient-to-br from-brand-800 via-brand-600 to-brand-500 px-6 py-12 text-center shadow-2xl shadow-brand-900/20 sm:px-12 sm:py-16">
          <div aria-hidden="true" className="pointer-events-none absolute inset-0">
            <div className="animate-drift absolute -top-24 -right-16 h-64 w-64 rounded-full bg-white/10 blur-2xl" />
            <div className="animate-float-slow absolute -bottom-28 -left-12 h-64 w-64 rounded-full bg-white/10 blur-2xl" />
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_20%,rgba(0,0,0,0.12)_100%)]" />
          </div>

          <div className="relative">
            <span className="inline-flex items-center gap-2 rounded-full border border-white/25 bg-white/10 px-3 py-1 text-[11px] font-medium text-brand-50 backdrop-blur">
              <span className="h-1.5 w-1.5 rounded-full bg-accent-400" />
              লাইভ ডেমো
            </span>
            <h2 className="mt-4 text-2xl font-bold tracking-tight text-white sm:text-3xl">
              ডেমো দোকান ঘুরে দেখুন
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-brand-50">
              প্রতিটি থিম আসল প্রোডাক্ট ও অর্ডার দিয়ে চালু আছে।
            </p>
            <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
              {demoSlugs.has("nokshi-demo") ? (
                <ButtonLink href="/store/nokshi-demo" variant="inverse" size="lg">
                  নকশি (editorial)
                </ButtonLink>
              ) : null}
              {demoSlugs.has("dhaka-bazar") ? (
                <ButtonLink href="/store/dhaka-bazar" variant="inverse-outline" size="lg">
                  ঢাকা বাজার (dense)
                </ButtonLink>
              ) : null}
              {demoSlugs.size === 0 ? (
                <ButtonLink href="/signup" variant="inverse" size="lg">
                  নিজের দোকান শুরু করুন
                </ButtonLink>
              ) : null}
            </div>
            <p className="mt-4 text-[11px] text-brand-100">
              পছন্দ হয়েছে? ফ্রি অ্যাকাউন্ট খুলে নিজের থিম বেছে নিন।
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
