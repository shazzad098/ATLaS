import { IMG } from "./assets";

/** Shared theme component contract (PRD §8.2 / Appendix A). */
export const SECTION_TYPES = ["hero", "categoryGrid", "productGrid", "promoBanner", "testimonials", "trustBar"] as const;
export type SectionType = (typeof SECTION_TYPES)[number];

export const SECTION_LABELS: Record<SectionType, string> = {
  hero: "Hero banner",
  categoryGrid: "Category grid",
  productGrid: "Product grid",
  promoBanner: "Promo banner",
  testimonials: "Testimonials",
  trustBar: "Trust bar",
};

export const FONTS = {
  "hind-siliguri": { label: "Hind Siliguri", css: "'Hind Siliguri', 'Noto Sans Bengali', sans-serif", google: "Hind+Siliguri:wght@400;500;600;700" },
  "noto-bengali": { label: "Noto Sans Bengali", css: "'Noto Sans Bengali', sans-serif", google: "Noto+Sans+Bengali:wght@400;500;600;700" },
  "inter-tight": { label: "Inter Tight", css: "'Inter Tight', 'Noto Sans Bengali', sans-serif", google: "Inter+Tight:wght@400;500;600;700" },
  playfair: { label: "Playfair Display", css: "'Playfair Display', 'Noto Serif Bengali', serif", google: "Playfair+Display:wght@500;600;700" },
  "dm-serif": { label: "DM Serif Display", css: "'DM Serif Display', 'Noto Serif Bengali', serif", google: "DM+Serif+Display" },
  cormorant: { label: "Cormorant Garamond", css: "'Cormorant Garamond', 'Noto Serif Bengali', serif", google: "Cormorant+Garamond:wght@500;600;700" },
  "space-grotesk": { label: "Space Grotesk", css: "'Space Grotesk', 'Noto Sans Bengali', sans-serif", google: "Space+Grotesk:wght@400;500;600;700" },
  manrope: { label: "Manrope", css: "'Manrope', 'Noto Sans Bengali', sans-serif", google: "Manrope:wght@400;500;600;700;800" },
  poppins: { label: "Poppins", css: "'Poppins', 'Hind Siliguri', sans-serif", google: "Poppins:wght@400;500;600;700" },
  fraunces: { label: "Fraunces", css: "'Fraunces', 'Noto Serif Bengali', serif", google: "Fraunces:wght@500;600;700" },
} as const;
export type FontKey = keyof typeof FONTS;
export const FONT_KEYS = Object.keys(FONTS) as FontKey[];

export type ThemeSection = {
  id: string;
  type: SectionType;
  enabled: boolean;
  title?: string;
  subtitle?: string;
  settings: {
    source?: "featured" | "latest" | "category";
    categoryId?: number;
    limit?: number;
    image?: string;
    heading?: string;
    text?: string;
    ctaLabel?: string;
    ctaHref?: string;
    items?: { title: string; text?: string; name?: string; rating?: number; icon?: string }[];
  };
};

export type ThemeConfig = {
  brand: { logoUrl: string; faviconUrl: string; tagline: string };
  colors: { primary: string; secondary: string; accent: string; background: string; surface: string; text: string; muted: string };
  fonts: { heading: FontKey; body: FontKey };
  buttonStyle: "rounded" | "pill" | "square";
  header: { layout: "left" | "center" | "split"; sticky: boolean; announcement: string; showSearch: boolean };
  footer: { about: string; showNewsletter: boolean; social: { facebook: string; instagram: string; youtube: string; whatsapp: string } };
  navigation: { label: string; href: string }[];
  banners: { image: string; heading: string; subheading: string; ctaLabel: string; ctaHref: string }[];
  sections: ThemeSection[];
};

const color = { type: "string", pattern: "^#[0-9a-fA-F]{6}$" };
const shortText = (max = 160) => ({ type: "string", maxLength: max });

/** JSON Schema used by the backend (Ajv) to validate every draft save and publish. */
export function buildThemeSchema(supportedSections: readonly SectionType[]) {
  return {
    $schema: "http://json-schema.org/draft-07/schema#",
    type: "object",
    additionalProperties: false,
    required: ["brand", "colors", "fonts", "buttonStyle", "header", "footer", "navigation", "banners", "sections"],
    properties: {
      brand: {
        type: "object",
        additionalProperties: false,
        required: ["logoUrl", "faviconUrl", "tagline"],
        properties: { logoUrl: shortText(600), faviconUrl: shortText(600), tagline: shortText(160) },
      },
      colors: {
        type: "object",
        additionalProperties: false,
        required: ["primary", "secondary", "accent", "background", "surface", "text", "muted"],
        properties: { primary: color, secondary: color, accent: color, background: color, surface: color, text: color, muted: color },
      },
      fonts: {
        type: "object",
        additionalProperties: false,
        required: ["heading", "body"],
        properties: { heading: { enum: FONT_KEYS }, body: { enum: FONT_KEYS } },
      },
      buttonStyle: { enum: ["rounded", "pill", "square"] },
      header: {
        type: "object",
        additionalProperties: false,
        required: ["layout", "sticky", "announcement", "showSearch"],
        properties: { layout: { enum: ["left", "center", "split"] }, sticky: { type: "boolean" }, announcement: shortText(200), showSearch: { type: "boolean" } },
      },
      footer: {
        type: "object",
        additionalProperties: false,
        required: ["about", "showNewsletter", "social"],
        properties: {
          about: shortText(500),
          showNewsletter: { type: "boolean" },
          social: {
            type: "object",
            additionalProperties: false,
            properties: { facebook: shortText(300), instagram: shortText(300), youtube: shortText(300), whatsapp: shortText(40) },
          },
        },
      },
      navigation: {
        type: "array",
        maxItems: 12,
        items: { type: "object", additionalProperties: false, required: ["label", "href"], properties: { label: shortText(40), href: shortText(300) } },
      },
      banners: {
        type: "array",
        maxItems: 5,
        items: {
          type: "object",
          additionalProperties: false,
          required: ["image", "heading"],
          properties: { image: shortText(600), heading: shortText(120), subheading: shortText(240), ctaLabel: shortText(40), ctaHref: shortText(300) },
        },
      },
      sections: {
        type: "array",
        maxItems: 20,
        items: {
          type: "object",
          additionalProperties: false,
          required: ["id", "type", "enabled", "settings"],
          properties: {
            id: shortText(40),
            type: { enum: [...supportedSections] },
            enabled: { type: "boolean" },
            title: shortText(120),
            subtitle: shortText(240),
            settings: {
              type: "object",
              additionalProperties: false,
              properties: {
                source: { enum: ["featured", "latest", "category"] },
                categoryId: { type: "integer" },
                limit: { type: "integer", minimum: 1, maximum: 24 },
                image: shortText(600),
                heading: shortText(120),
                text: shortText(400),
                ctaLabel: shortText(40),
                ctaHref: shortText(300),
                items: {
                  type: "array",
                  maxItems: 12,
                  items: {
                    type: "object",
                    additionalProperties: false,
                    required: ["title"],
                    properties: { title: shortText(120), text: shortText(400), name: shortText(80), rating: { type: "integer", minimum: 1, maximum: 5 }, icon: shortText(30) },
                  },
                },
              },
            },
          },
        },
      },
    },
  } as const;
}

export type ThemeTier = "starter" | "curated" | "standard" | "pro_exclusive";
export type ThemeCatalogEntry = {
  code: string;
  name: string;
  tier: ThemeTier;
  industry: string;
  styleTags: string[];
  description: string;
  heroImage: string;
  supportedSections: SectionType[];
  sortOrder: number;
  defaults: Pick<ThemeConfig, "colors" | "fonts" | "buttonStyle" | "header"> & { sectionOrder: SectionType[]; heroHeading: string; heroSub: string };
};

export const THEME_CATALOG: ThemeCatalogEntry[] = [
  {
    code: "nokshi",
    name: "Nokshi",
    tier: "starter",
    industry: "fashion",
    styleTags: ["warm", "editorial", "large imagery"],
    description: "Fashion-first theme with warm tones, editorial typography and large lifestyle imagery.",
    heroImage: IMG.themeHero.nokshi,
    supportedSections: [...SECTION_TYPES],
    sortOrder: 1,
    defaults: {
      colors: { primary: "#9A3412", secondary: "#FBEFE3", accent: "#C2410C", background: "#FFFBF5", surface: "#FFFFFF", text: "#2B1B12", muted: "#8A6F5E" },
      fonts: { heading: "playfair", body: "hind-siliguri" },
      buttonStyle: "pill",
      header: { layout: "center", sticky: true, announcement: "Free delivery inside Dhaka on orders over ৳2,000", showSearch: true },
      sectionOrder: ["hero", "trustBar", "categoryGrid", "productGrid", "promoBanner", "productGrid", "testimonials"],
      heroHeading: "Woven stories for every occasion",
      heroSub: "Handpicked jamdani, panjabi and festive wear crafted in Bangladesh.",
    },
  },
  {
    code: "bazar",
    name: "Bazar",
    tier: "starter",
    industry: "grocery",
    styleTags: ["fresh", "dense catalog", "category-first"],
    description: "Grocery theme with a category-first layout, dense product grid and quick add-to-cart.",
    heroImage: IMG.themeHero.bazar,
    supportedSections: ["hero", "categoryGrid", "productGrid", "promoBanner", "trustBar"],
    sortOrder: 2,
    defaults: {
      colors: { primary: "#15803D", secondary: "#ECFDF3", accent: "#F59E0B", background: "#F7FBF4", surface: "#FFFFFF", text: "#14281A", muted: "#5B7363" },
      fonts: { heading: "poppins", body: "hind-siliguri" },
      buttonStyle: "rounded",
      header: { layout: "left", sticky: true, announcement: "Same-day delivery in Dhaka • Order before 2 PM", showSearch: true },
      sectionOrder: ["categoryGrid", "hero", "productGrid", "promoBanner", "productGrid", "trustBar"],
      heroHeading: "Fresh bazar, delivered today",
      heroSub: "Rice, dal, fish, vegetables and daily essentials at fair prices.",
    },
  },
  {
    code: "studio",
    name: "Studio",
    tier: "curated",
    industry: "electronics",
    styleTags: ["clean", "whitespace", "strong search"],
    description: "Clean whitespace theme for gadgets and cosmetics with a strong search experience.",
    heroImage: IMG.themeHero.studio,
    supportedSections: [...SECTION_TYPES],
    sortOrder: 3,
    defaults: {
      colors: { primary: "#111827", secondary: "#F3F4F6", accent: "#2563EB", background: "#FFFFFF", surface: "#F9FAFB", text: "#0B0F19", muted: "#6B7280" },
      fonts: { heading: "space-grotesk", body: "inter-tight" },
      buttonStyle: "square",
      header: { layout: "split", sticky: true, announcement: "Official warranty on every gadget • EMI available", showSearch: true },
      sectionOrder: ["hero", "productGrid", "categoryGrid", "promoBanner", "trustBar", "testimonials"],
      heroHeading: "Gear that keeps up with you",
      heroSub: "Audio, wearables and beauty tech — tested, genuine and fast to deliver.",
    },
  },
  {
    code: "kantha",
    name: "Kantha",
    tier: "curated",
    industry: "handicraft",
    styleTags: ["handmade", "earthy", "story-led"],
    description: "Story-led theme for handicraft, home decor and artisan brands.",
    heroImage: IMG.themeHero.kantha,
    supportedSections: [...SECTION_TYPES],
    sortOrder: 4,
    defaults: {
      colors: { primary: "#1E3A8A", secondary: "#F1ECE1", accent: "#B91C1C", background: "#F8F5EE", surface: "#FFFFFF", text: "#1C1917", muted: "#78716C" },
      fonts: { heading: "dm-serif", body: "hind-siliguri" },
      buttonStyle: "rounded",
      header: { layout: "center", sticky: false, announcement: "Every piece is handmade by rural artisans", showSearch: false },
      sectionOrder: ["hero", "promoBanner", "categoryGrid", "productGrid", "testimonials", "trustBar"],
      heroHeading: "Stitched by hand, made to last",
      heroSub: "Nakshi kantha, jute and terracotta from artisan villages.",
    },
  },
  {
    code: "dokan",
    name: "Dokan",
    tier: "curated",
    industry: "general",
    styleTags: ["friendly", "versatile", "bold"],
    description: "Versatile general-store theme with bold blocks and friendly colours.",
    heroImage: IMG.themeHero.dokan,
    supportedSections: [...SECTION_TYPES],
    sortOrder: 5,
    defaults: {
      colors: { primary: "#2563EB", secondary: "#EFF6FF", accent: "#F97316", background: "#FFFFFF", surface: "#F8FAFC", text: "#0F172A", muted: "#64748B" },
      fonts: { heading: "manrope", body: "hind-siliguri" },
      buttonStyle: "pill",
      header: { layout: "left", sticky: true, announcement: "Cash on delivery all over Bangladesh", showSearch: true },
      sectionOrder: ["hero", "categoryGrid", "productGrid", "trustBar", "promoBanner", "testimonials"],
      heroHeading: "Everything you need, one dokan",
      heroSub: "Daily essentials, lifestyle and home products with nationwide delivery.",
    },
  },
  {
    code: "rong",
    name: "Rong",
    tier: "standard",
    industry: "beauty",
    styleTags: ["soft", "pastel", "glossy"],
    description: "Soft pastel beauty theme with glossy product cards and routine-led merchandising.",
    heroImage: IMG.themeHero.rong,
    supportedSections: [...SECTION_TYPES],
    sortOrder: 6,
    defaults: {
      colors: { primary: "#BE185D", secondary: "#FDE7EF", accent: "#F59E9E", background: "#FFF7F9", surface: "#FFFFFF", text: "#3B0A1E", muted: "#9D6B7E" },
      fonts: { heading: "fraunces", body: "hind-siliguri" },
      buttonStyle: "pill",
      header: { layout: "center", sticky: true, announcement: "100% authentic beauty • Free gift on orders over ৳1,500", showSearch: true },
      sectionOrder: ["hero", "productGrid", "promoBanner", "categoryGrid", "testimonials", "trustBar"],
      heroHeading: "Glow, your way",
      heroSub: "Skincare and makeup curated for South Asian skin.",
    },
  },
  {
    code: "prestige",
    name: "Prestige",
    tier: "pro_exclusive",
    industry: "luxury",
    styleTags: ["dark", "gold", "premium"],
    description: "Pro-exclusive dark luxury theme with gold accents and cinematic imagery.",
    heroImage: IMG.themeHero.prestige,
    supportedSections: ["hero", "productGrid", "promoBanner", "testimonials", "trustBar"],
    sortOrder: 7,
    defaults: {
      colors: { primary: "#C9A227", secondary: "#1C1A16", accent: "#E8D48B", background: "#0B0B0C", surface: "#151517", text: "#F5F1E6", muted: "#A39E8F" },
      fonts: { heading: "cormorant", body: "manrope" },
      buttonStyle: "square",
      header: { layout: "center", sticky: true, announcement: "Complimentary gift wrapping on every order", showSearch: false },
      sectionOrder: ["hero", "productGrid", "promoBanner", "testimonials", "trustBar"],
      heroHeading: "Crafted for the extraordinary",
      heroSub: "Timepieces, fragrances and leather goods for those who notice details.",
    },
  },
];

export const THEME_BY_CODE = Object.fromEntries(THEME_CATALOG.map(t => [t.code, t])) as Record<string, ThemeCatalogEntry>;

let sectionCounter = 0;
function sectionId(type: string) {
  sectionCounter += 1;
  return `${type}-${sectionCounter}`;
}

export function buildDefaultConfig(code: string, opts: { storeName?: string; primary?: string; secondary?: string; logoUrl?: string } = {}): ThemeConfig {
  const t = THEME_BY_CODE[code] ?? THEME_CATALOG[0];
  sectionCounter = 0;
  let productGridCount = 0;
  const sections: ThemeSection[] = t.defaults.sectionOrder.map(type => {
    switch (type) {
      case "hero":
        return { id: sectionId(type), type, enabled: true, settings: {} };
      case "categoryGrid":
        return { id: sectionId(type), type, enabled: true, title: "Shop by category", settings: { limit: 6 } };
      case "productGrid": {
        productGridCount += 1;
        return productGridCount === 1
          ? { id: sectionId(type), type, enabled: true, title: "Featured picks", subtitle: "Loved by our customers", settings: { source: "featured", limit: 8 } }
          : { id: sectionId(type), type, enabled: true, title: "New arrivals", settings: { source: "latest", limit: 8 } };
      }
      case "promoBanner":
        return {
          id: sectionId(type),
          type,
          enabled: true,
          settings: { image: t.heroImage, heading: "Festive collection is here", text: "Up to 20% off for a limited time. Use code WELCOME10 at checkout.", ctaLabel: "Shop now", ctaHref: "/shop" },
        };
      case "testimonials":
        return {
          id: sectionId(type),
          type,
          enabled: true,
          title: "What our customers say",
          settings: {
            items: [
              { title: "Quality exceeded expectations", text: "Delivery was quick and the packaging was beautiful.", name: "Nusrat J.", rating: 5 },
              { title: "Will order again", text: "Cash on delivery made it easy. Exactly as pictured.", name: "Tanvir A.", rating: 5 },
              { title: "Great support", text: "They called to confirm my order and helped me pick the right size.", name: "Mithila R.", rating: 4 },
            ],
          },
        };
      case "trustBar":
      default:
        return {
          id: sectionId(type),
          type: "trustBar",
          enabled: true,
          settings: {
            items: [
              { title: "Cash on delivery", text: "Pay when you receive", icon: "wallet" },
              { title: "Fast delivery", text: "24–72 hours nationwide", icon: "truck" },
              { title: "Easy returns", text: "7-day return policy", icon: "rotate" },
              { title: "Secure payment", text: "bKash • Nagad • Cards", icon: "shield" },
            ],
          },
        };
    }
  });
  const colors = { ...t.defaults.colors };
  if (opts.primary && /^#[0-9a-fA-F]{6}$/.test(opts.primary)) colors.primary = opts.primary;
  if (opts.secondary && /^#[0-9a-fA-F]{6}$/.test(opts.secondary)) colors.secondary = opts.secondary;
  return {
    brand: { logoUrl: opts.logoUrl ?? "", faviconUrl: "", tagline: opts.storeName ? `${opts.storeName} — shop online` : "" },
    colors,
    fonts: { ...t.defaults.fonts },
    buttonStyle: t.defaults.buttonStyle,
    header: { ...t.defaults.header },
    footer: {
      about: opts.storeName ? `${opts.storeName} is an online store powered by ATLaS. We deliver all over Bangladesh.` : "An online store powered by ATLaS.",
      showNewsletter: true,
      social: { facebook: "", instagram: "", youtube: "", whatsapp: "" },
    },
    navigation: [
      { label: "Home", href: "/" },
      { label: "Shop", href: "/shop" },
      { label: "About", href: "/about" },
      { label: "Contact", href: "/contact" },
    ],
    banners: [{ image: t.heroImage, heading: t.defaults.heroHeading, subheading: t.defaults.heroSub, ctaLabel: "Shop now", ctaHref: "/shop" }],
    sections,
  };
}
