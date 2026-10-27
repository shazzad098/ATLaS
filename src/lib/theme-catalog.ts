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
        announcement: "",
        sticky: true,
      },
      hero: {
        enabled: true,
        title: "",
        subtitle: "",
        ctaLabel: "শপ দেখুন",
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
            ? "ক্যাটাগরি"
            : key === "ProductGrid"
              ? "নতুন পণ্য"
              : key === "Testimonials"
                ? "ক্রেতাদের রিভিউ"
                : "",
      })),
      promo: {
        enabled: false,
        title: "",
        body: "",
        ctaLabel: "",
        ctaHref: "/shop",
      },
      testimonials: { enabled: true, items: [] },
      trust: { enabled: true, items: [] },
      footer: {
        about: "",
        columns: [
          {
            title: "কেনাকাটা",
            links: [{ label: "সব পণ্য", href: "/shop" }],
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
        note: "",
      },
      navigation: [
        { label: "হোম", href: "/" },
        { label: "শপ", href: "/shop" },
        { label: "যোগাযোগ", href: "/page/contact" },
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
      swatches: ["#0E7A3F", "#65A30D", "#EAF7EF"],
    },
    defaultConfig: {
      colors: {
        primary: "#0E7A3F",
        accent: "#65A30D",
        background: "#FFFFFF",
        surface: "#EAF7EF",
        text: "#0B2018",
        muted: "#5B7568",
      },
      typography: { headingFont: "sans", bodyFont: "sans", scale: "compact" },
      buttons: { style: "rounded" },
      header: {
        style: "classic",
        showSearch: true,
        announcement: "",
        sticky: true,
      },
      hero: {
        enabled: true,
        title: "",
        subtitle: "",
        ctaLabel: "শপিং শুরু করুন",
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
            ? "ক্যাটাগরি"
            : key === "ProductGrid"
              ? "নতুন পণ্য"
              : key === "Testimonials"
                ? "ক্রেতাদের রিভিউ"
                : "",
      })),
      promo: {
        enabled: false,
        title: "",
        body: "",
        ctaLabel: "",
        ctaHref: "/shop",
      },
      testimonials: { enabled: true, items: [] },
      trust: { enabled: true, items: [] },
      footer: {
        about: "",
        columns: [
          {
            title: "কেনাকাটা",
            links: [{ label: "সব পণ্য", href: "/shop" }],
          },
          {
            title: "গ্রাহক সেবা",
            links: [
              { label: "ডেলিভারি তথ্য", href: "/page/delivery" },
              { label: "রিটার্ন পলিসি", href: "/page/returns" },
              { label: "প্রাইভেসি", href: "/page/privacy" },
              { label: "শর্তাবলী", href: "/page/terms" },
            ],
          },
        ],
        note: "",
      },
      navigation: [
        { label: "হোম", href: "/" },
        { label: "সব পণ্য", href: "/shop" },
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
        title: "",
        subtitle: "",
        ctaLabel: "শপ দেখুন",
        ctaHref: "/shop",
        align: "center",
      },
      sections: THEME_SECTION_KEYS.map((key) => ({
        key,
        enabled: true,
        title: key === "ProductGrid" ? "নতুন পণ্য" : key === "CategoryGrid" ? "ক্যাটাগরি" : "",
      })),
      promo: {
        enabled: false,
        title: "",
        body: "",
        ctaLabel: "",
        ctaHref: "/shop",
      },
      testimonials: { enabled: true, items: [] },
      trust: { enabled: true, items: [] },
      footer: {
        about: "",
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
            links: [{ label: "যোগাযোগ", href: "/page/contact" }],
          },
        ],
        note: "",
      },
      navigation: [
        { label: "হোম", href: "/" },
        { label: "শপ", href: "/shop" },
        { label: "যোগাযোগ", href: "/page/contact" },
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