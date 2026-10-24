import { z } from "zod";
import type { PlanCode } from "@/lib/plans";

/* ──────────────────────────────────────────────────────────────
 * Sections
 * ────────────────────────────────────────────────────────────── */

export const THEME_SECTION_KEYS = [
  "Header",
  "Hero",
  "CategoryGrid",
  "ProductGrid",
  "PromoBanner",
  "Testimonials",
  "TrustBar",
  "Footer",
] as const;

export type ThemeSectionKey = (typeof THEME_SECTION_KEYS)[number];

/* ──────────────────────────────────────────────────────────────
 * Schema primitives
 * ────────────────────────────────────────────────────────────── */

const hexColor = z
  .string()
  .regex(/^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/, "Hex colour expected, e.g. #0F766E");

const linkSchema = z.object({ label: z.string().min(1), href: z.string().min(1) });

/* ──────────────────────────────────────────────────────────────
 * Theme config schema
 * ────────────────────────────────────────────────────────────── */

export const themeConfigSchema = z.object({
  colors: z
    .object({
      primary: hexColor.default("#0F766E"),
      accent: hexColor.default("#F59E0B"),
      background: hexColor.default("#FFFFFF"),
      surface: hexColor.default("#F8FAFC"),
      text: hexColor.default("#0F172A"),
      muted: hexColor.default("#64748B"),
    })
    .prefault({}),
  typography: z
    .object({
      headingFont: z.enum(["sans", "serif"]).default("serif"),
      bodyFont: z.enum(["sans", "serif"]).default("sans"),
      scale: z.enum(["compact", "comfortable"]).default("comfortable"),
    })
    .prefault({}),
  buttons: z.object({ style: z.enum(["rounded", "pill", "square"]).default("rounded") }).prefault({}),
  header: z
    .object({
      style: z.enum(["classic", "centered", "minimal"]).default("classic"),
      showSearch: z.boolean().default(true),
      announcement: z.string().default(""),
      sticky: z.boolean().default(true),
    })
    .prefault({}),
  hero: z
    .object({
      enabled: z.boolean().default(true),
      title: z.string().default("আপনার নতুন সংগ্রহ"),
      subtitle: z.string().default("সরাসরি দোকান থেকে, ঘরে পৌঁছে যাবে।"),
      ctaLabel: z.string().default("এখনই কিনুন"),
      ctaHref: z.string().default("/shop"),
      align: z.enum(["left", "center"]).default("left"),
    })
    .prefault({}),
  sections: z
    .array(
      z.object({
        key: z.enum(THEME_SECTION_KEYS),
        enabled: z.boolean().default(true),
        title: z.string().default(""),
      }),
    )
    .default([]),
  promo: z
    .object({
      enabled: z.boolean().default(true),
      title: z.string().default(""),
      body: z.string().default(""),
      ctaLabel: z.string().default(""),
      ctaHref: z.string().default("/shop"),
    })
    .prefault({}),
  testimonials: z
    .object({
      enabled: z.boolean().default(true),
      items: z
        .array(z.object({ name: z.string(), quote: z.string(), location: z.string().default("") }))
        .default([]),
    })
    .prefault({}),
  trust: z
    .object({ enabled: z.boolean().default(true), items: z.array(z.string()).default([]) })
    .prefault({}),
  footer: z
    .object({
      about: z.string().default(""),
      columns: z
        .array(z.object({ title: z.string(), links: z.array(linkSchema).default([]) }))
        .default([]),
      note: z.string().default(""),
    })
    .prefault({}),
  navigation: z.array(linkSchema).default([]),
});

export type ThemeConfig = z.infer<typeof themeConfigSchema>;

/* ──────────────────────────────────────────────────────────────
 * Catalog types
 * ────────────────────────────────────────────────────────────── */

export type ThemeCatalogEntry = {
  code: string;
  name: string;
  description: string;
  industry: string;
  style: string;
  version: string;
  compatiblePlans: PlanCode[];
  /** Tailwind classes used by the marketing catalog preview card. */
  preview: { gradient: string; swatches: string[] };
  defaultConfig: ThemeConfig;
};

const ALL_PLANS: PlanCode[] = ["free", "basic", "standard", "pro"];

/* ──────────────────────────────────────────────────────────────
 * Catalog data
 * ────────────────────────────────────────────────────────────── */

export const THEME_CATALOG: ThemeCatalogEntry[] = [
  {
    code: "nokshi",
    name: "Nokshi",
    description: "ফ্যাশন, বুটিক আর লাইফস্টাইলের জন্য উষ্ণ রঙের theme — বড় product ছবি আর editorial hero।",
    industry: "Fashion, boutique, lifestyle",
    style: "Warm editorial",
    version: "1.0.0",
    compatiblePlans: ALL_PLANS,
    preview: {
      gradient: "from-rose-200 via-amber-100 to-amber-50",
      swatches: ["#7A1E2B", "#C08A2E", "#FDF8F0"],
    },
    defaultConfig: {
      colors: {
        primary: "#7A1E2B",
        accent: "#C08A2E",
        background: "#FDF8F0",
        surface: "#F6ECDD",
        text: "#2E1712",
        muted: "#8B6F60",
      },
      typography: { headingFont: "serif", bodyFont: "sans", scale: "comfortable" },
      buttons: { style: "pill" },
      header: {
        style: "centered",
        showSearch: true,
        announcement: "সারাদেশে হোম ডেলিভারি · ১০০০৳+ অর্ডারে ফ্রি ডেলিভারি · নতুন সংগ্রহ এসেছে",
        sticky: true,
      },
      hero: {
        enabled: true,
        title: "নকশি হাতে বোনা, আপনার রুচিতে নতুন সাজ",
        subtitle:
          "সীমিত ব্যাচে হাতে বোনা শাড়ি, কুর্তি ও থ্রি-পিস — প্রতিটি পিস বাছাই করা, কারিগরের কাছ থেকে সোজা আপনার কাছে।",
        ctaLabel: "নতুন সংগ্রহ দেখুন",
        ctaHref: "/shop",
        align: "left",
      },
      sections: [
        "Header",
        "Hero",
        "CategoryGrid",
        "ProductGrid",
        "PromoBanner",
        "TrustBar",
        "Testimonials",
        "Footer",
      ].map((key) => ({
        key: key as (typeof THEME_SECTION_KEYS)[number],
        enabled: true,
        title:
          key === "CategoryGrid"
            ? "পছন্দের শাড়ি, কুর্তি ও থ্রি-পিস"
            : key === "ProductGrid"
              ? "আজকের নির্বাচিত পোশাক"
              : key === "Testimonials"
                ? "আমাদের ক্রেতারা যা বলছেন"
                : "",
      })),
      promo: {
        enabled: true,
        title: "ঈদ আয়োজনে বিশেষ ছাড়",
        body: "নির্বাচিত শাড়ি ও থ্রি-পিসে ২০% পর্যন্ত ছাড় — স্টক সীমিত, আগে এলে আগে পাবেন।",
        ctaLabel: "অফার দেখুন",
        ctaHref: "/shop",
      },
      testimonials: {
        enabled: true,
        items: [
          { name: "সাদিয়া রহমান", quote: "কাপড়ের মান আসলেই ভালো, প্যাকেজিংও যত্নসহকারে।", location: "ধানমন্ডি, ঢাকা" },
          { name: "তাশনিম আক্তার", quote: "ছবির সাথে ঠিক মিলে গেছে। আবার অর্ডার করব।", location: "চট্টগ্রাম" },
          { name: "নুসরাত জাহান", quote: "হাতে বোনা কাজটা এত নিখুঁত হবে ভাবিনি।", location: "উত্তরা, ঢাকা" },
        ],
      },
      trust: {
        enabled: true,
        items: ["সারাদেশে হোম ডেলিভারি", "৭ দিনে সহজ রিটার্ন", "১০০% হাতে বোনা", "২৪/৭ কাস্টমার সাপোর্ট"],
      },
      footer: {
        about:
          "নকশি বুটিক — হাতে বোনা শাড়ি, কুর্তি ও থ্রি-পিসের ছোট ব্যাচের সংগ্রহ, সোজা কারিগরের কাছ থেকে।",
        columns: [
          {
            title: "কেনাকাটা",
            links: [
              { label: "সব পণ্য", href: "/shop" },
              { label: "শাড়ি", href: "/shop?category=sharee" },
              { label: "কুর্তি", href: "/shop?category=kurti" },
              { label: "থ্রি-পিস", href: "/shop?category=three-piece" },
            ],
          },
          {
            title: "গ্রাহক সেবা",
            links: [
              { label: "রিটার্ন নীতি", href: "/page/returns" },
              { label: "ডেলিভারি তথ্য", href: "/page/delivery" },
              { label: "যোগাযোগ", href: "/page/contact" },
              { label: "প্রাইভেসি", href: "/page/privacy" },
            ],
          },
        ],
        note: "© নকশি বুটিক। সর্বস্বত্ব সংরক্ষিত।",
      },
      navigation: [
        { label: "হোম", href: "/" },
        { label: "শপ", href: "/shop" },
        { label: "শাড়ি", href: "/shop?category=sharee" },
        { label: "কুর্তি", href: "/shop?category=kurti" },
        { label: "থ্রি-পিস", href: "/shop?category=three-piece" },
        { label: "ওড়না", href: "/shop?category=orna" },
        { label: "আমাদের সম্পর্কে", href: "/page/contact" },
      ],
    },
  },
  {
    code: "bazar",
    name: "Bazar",
    description: "মুদি, খাবার আর প্রতিদিনের পণ্যের জন্য ঘন catalog — ক্যাটাগরি-ফার্স্ট নেভিগেশন।",
    industry: "Grocery, food, everyday goods",
    style: "Dense catalogue",
    version: "1.0.0",
    compatiblePlans: ALL_PLANS,
    preview: {
      gradient: "from-emerald-200 via-lime-100 to-emerald-50",
      swatches: ["#047857", "#65A30D", "#F7FEE7"],
    },
    defaultConfig: {
      colors: {
        primary: "#047857",
        accent: "#65A30D",
        background: "#FFFFFF",
        surface: "#F1F8F4",
        text: "#0B2018",
        muted: "#5B7568",
      },
      typography: { headingFont: "sans", bodyFont: "sans", scale: "compact" },
      buttons: { style: "rounded" },
      header: {
        style: "classic",
        showSearch: true,
        announcement: "ভোরের বাজার — প্রতিদিন সকাল ৭টায় নতুন স্টক",
        sticky: true,
      },
      hero: {
        enabled: true,
        title: "আজকের বাজার, আজই বাড়িতে",
        subtitle: "সকালের অর্ডার — সন্ধ্যার মধ্যে ডেলিভারি।",
        ctaLabel: "বাজার শুরু করুন",
        ctaHref: "/shop",
        align: "left",
      },
      sections: THEME_SECTION_KEYS.map((key) => ({
        key,
        enabled: true,
        title:
          key === "CategoryGrid"
            ? "ক্যাটাগরি"
            : key === "ProductGrid"
              ? "নতুন স্টক"
              : key === "Testimonials"
                ? "কাস্টমার রিভিউ"
                : "",
      })),
      promo: {
        enabled: true,
        title: "৫০০ টাকার উপরে ফ্রি ডেলিভারি",
        body: "নির্বাচিত এলাকায় প্রযোজ্য। অর্ডারের সময় ঠিকানা দেখে নিন।",
        ctaLabel: "শর্ত দেখুন",
        ctaHref: "/page/delivery",
      },
      testimonials: {
        enabled: true,
        items: [
          { name: "রফিকুল ইসলাম", quote: "সবজি টাটকা ছিল, দামও বাজারের মতোই।", location: "মিরপুর ১০" },
          { name: "নুসরাত জাহান", quote: "প্রতিদিনের বাজার এখন এখান থেকেই করি।", location: "উত্তরা" },
        ],
      },
      trust: {
        enabled: true,
        items: ["ডেলিভারি ট্র্যাকিং", "ক্যাশ অন ডেলিভারি", "ওজনে কারচুপি নেই"],
      },
      footer: {
        about: "ঢাকা বাজার — প্রতিদিনের টাটকা পণ্য, বাজারের দামে।",
        columns: [
          {
            title: "ক্যাটাগরি",
            links: [
              { label: "সব পণ্য", href: "/shop" },
              { label: "কার্ট", href: "/cart" },
            ],
          },
          {
            title: "সেবা",
            links: [
              { label: "ডেলিভারি এলাকা", href: "/page/delivery" },
              { label: "যোগাযোগ", href: "/page/contact" },
            ],
          },
        ],
        note: "© ঢাকা বাজার। সর্বস্বত্ব সংরক্ষিত।",
      },
      navigation: [
        { label: "হোম", href: "/" },
        { label: "সব পণ্য", href: "/shop" },
        { label: "ডেলিভারি", href: "/page/delivery" },
        { label: "যোগাযোগ", href: "/page/contact" },
      ],
    },
  },
  {
    code: "studio",
    name: "Studio",
    description: "গ্যাজেট, কসমেটিকস আর প্রিমিয়াম পণ্যের জন্য পরিষ্কার whitespace-ar design।",
    industry: "Gadgets, cosmetics, premium products",
    style: "Clean minimal",
    version: "1.0.0",
    compatiblePlans: ALL_PLANS,
    preview: {
      gradient: "from-slate-200 via-sky-100 to-slate-50",
      swatches: ["#1E293B", "#0284C7", "#F8FAFC"],
    },
    defaultConfig: {
      colors: {
        primary: "#1E293B",
        accent: "#0284C7",
        background: "#FFFFFF",
        surface: "#F8FAFC",
        text: "#0F172A",
        muted: "#64748B",
      },
      typography: { headingFont: "sans", bodyFont: "sans", scale: "comfortable" },
      buttons: { style: "square" },
      header: {
        style: "minimal",
        showSearch: true,
        announcement: "",
        sticky: true,
      },
      hero: {
        enabled: true,
        title: "যাচাই করা প্রোডাক্ট, বাড়তি দাম ছাড়া",
        subtitle: "প্রতিটি ইউনিট হাতে চেক করা — ৬ মাসের ওয়ারেন্টি সহ।",
        ctaLabel: "কালেকশন দেখুন",
        ctaHref: "/shop",
        align: "center",
      },
      sections: THEME_SECTION_KEYS.map((key) => ({
        key,
        enabled: true,
        title: key === "ProductGrid" ? "ফিচারড" : "",
      })),
      promo: {
        enabled: true,
        title: "প্রি-অর্ডার সুবিধা",
        body: "নতুন ব্যাচ আসার আগেই বুক করুন — দাম আগের মতোই থাকবে।",
        ctaLabel: "প্রি-অর্ডার",
        ctaHref: "/shop",
      },
      testimonials: {
        enabled: true,
        items: [
          { name: "আরিফ হোসেন", quote: "ওয়ারেন্টি ক্লেইম কোনো ঝামেলা ছাড়াই হয়ে গেছে।", location: "সিলেট" },
        ],
      },
      trust: {
        enabled: true,
        items: ["৬ মাসের ওয়ারেন্টি", "ক্যাশ অন ডেলিভারি", "অফিসিয়াল ইমপোর্ট"],
      },
      footer: {
        about: "স্টুডিও — গ্যাজেট ও পার্সোনাল কেয়ার পণ্যের নির্বাচিত সংগ্রহ।",
        columns: [
          {
            title: "কেনাকাটা",
            links: [
              { label: "সব পণ্য", href: "/shop" },
              { label: "কার্ট", href: "/cart" },
            ],
          },
          {
            title: "সাপোর্ট",
            links: [
              { label: "ওয়ারেন্টি", href: "/page/warranty" },
              { label: "যোগাযোগ", href: "/page/contact" },
            ],
          },
        ],
        note: "© স্টুডিও। সর্বস্বত্ব সংরক্ষিত।",
      },
      navigation: [
        { label: "হোম", href: "/" },
        { label: "কালেকশন", href: "/shop" },
        { label: "ওয়ারেন্টি", href: "/page/warranty" },
      ],
    },
  },
];

/* ──────────────────────────────────────────────────────────────
 * Lookup helpers
 * ────────────────────────────────────────────────────────────── */

export function getThemeEntry(code: string): ThemeCatalogEntry | undefined {
  return THEME_CATALOG.find((theme) => theme.code === code);
}

/* ──────────────────────────────────────────────────────────────
 * Config resolution
 * ────────────────────────────────────────────────────────────── */

/**
 * Merge a stored (possibly partial or stale) config over the theme defaults and
 * validate. FR-06 requires schema-validated configs; unknown keys are dropped
 * rather than persisted.
 */
export function resolveThemeConfig(
  code: string,
  stored: unknown,
): { config: ThemeConfig; issues: string[] } {
  const entry = getThemeEntry(code);
  const defaults = entry?.defaultConfig ?? THEME_CATALOG[0].defaultConfig;
  const merged = deepMerge(structuredClone(defaults), stored);
  const parsed = themeConfigSchema.safeParse(merged);
  if (parsed.success) {
    return { config: parsed.data, issues: [] };
  }
  const merged2 = deepMerge(structuredClone(defaults), null);
  return {
    config: themeConfigSchema.parse(merged2),
    issues: parsed.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`),
  };
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function deepMerge<T>(base: T, overlay: unknown): T {
  if (!isPlainObject(overlay)) return base;
  if (!isPlainObject(base)) return overlay as T;
  const result: Record<string, unknown> = { ...base };
  for (const [key, value] of Object.entries(overlay)) {
    if (value === undefined) continue;
    result[key] = isPlainObject(value) ? deepMerge(result[key], value) : value;
  }
  return result as T;
}

/* ──────────────────────────────────────────────────────────────
 * Theme switch warnings
 * ────────────────────────────────────────────────────────────── */

/**
 * Content mapping check used before a theme switch (FR-06): sections that exist
 * in the target theme but have no content yet, so the merchant is warned.
 */
export function themeSwitchWarnings(
  fromConfig: ThemeConfig,
  toEntry: ThemeCatalogEntry,
): string[] {
  const warnings: string[] = [];
  const enabledBefore = new Set(fromConfig.sections.filter((s) => s.enabled).map((s) => s.key));
  const enabledAfter = new Set(toEntry.defaultConfig.sections.filter((s) => s.enabled).map((s) => s.key));
  for (const key of enabledAfter) {
    if (!enabledBefore.has(key)) warnings.push(`${key} section-এ এখনো content নেই — draft-এ যাচাই করুন।`);
  }
  if (fromConfig.navigation.length && !toEntry.defaultConfig.navigation.length) {
    warnings.push("নতুন theme-এ navigation খালি — link যোগ করতে হবে।");
  }
  return warnings;
}