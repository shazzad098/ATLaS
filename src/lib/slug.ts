/**
 * Slug helpers. Store slugs become subdomains (`store-slug.atlas.example`),
 * so they must satisfy DNS label rules, and product/category slugs must be
 * unique per store (PRD §10.7).
 */

const RESERVED_SLUGS = new Set([
  "www",
  "app",
  "admin",
  "api",
  "cdn",
  "assets",
  "static",
  "mail",
  "smtp",
  "ftp",
  "blog",
  "help",
  "support",
  "status",
  "docs",
  "dev",
  "staging",
  "test",
  "demo",
  "store",
  "stores",
  "shop",
  "account",
  "login",
  "signup",
  "logout",
  "super-admin",
  "system",
  "atlas",
]);

/** Map Bangla (or any non-ASCII) text to a Latin-friendly slug. */
const BANGLA_MAP: Record<string, string> = {
  অ: "o", আ: "a", ই: "i", ঈ: "i", উ: "u", ঊ: "u", ঋ: "ri", এ: "e", ঐ: "oi", ও: "o", ঔ: "ou",
  ক: "k", খ: "kh", গ: "g", ঘ: "gh", ঙ: "ng",
  চ: "ch", ছ: "chh", জ: "j", ঝ: "jh", ঞ: "n",
  ট: "t", ঠ: "th", ড: "d", ঢ: "dh", ণ: "n",
  ত: "t", থ: "th", দ: "d", ধ: "dh", ন: "n",
  প: "p", ফ: "ph", ব: "b", ভ: "bh", ম: "m",
  য: "j", র: "r", ল: "l", শ: "sh", ষ: "sh", স: "s", হ: "h",
  "ড়": "r", "ঢ়": "rh", "য়": "y", "ৎ": "t", "ং": "ng", "ঃ": "h", "ঁ": "",
  "া": "a", "ি": "i", "ী": "i", "ু": "u", "ূ": "u", "ৃ": "ri", "ে": "e", "ৈ": "oi", "ো": "o", "ৌ": "ou",
  "্": "", "০": "0", "১": "1", "২": "2", "৩": "3", "৪": "4", "৫": "5", "৬": "6", "৭": "7", "৮": "8", "৯": "9",
};

export function slugify(input: string, options: { maxLength?: number } = {}): string {
  const maxLength = options.maxLength ?? 60;
  const transliterated = Array.from(input)
    .map((char) => BANGLA_MAP[char] ?? char)
    .join("");

  return transliterated
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, maxLength)
    .replace(/-+$/g, "");
}

export const SLUG_PATTERN = /^[a-z0-9](?:[a-z0-9-]{1,58})[a-z0-9]$/;

export function isValidSlug(slug: string): boolean {
  if (slug.length < 3 || slug.length > 60) return false;
  if (!SLUG_PATTERN.test(slug)) return false;
  if (slug.includes("--")) return false;
  return !RESERVED_SLUGS.has(slug);
}

export function isReservedSlug(slug: string): boolean {
  return RESERVED_SLUGS.has(slug);
}

/** Ensure uniqueness by appending a short suffix; caller still re-checks the DB. */
export function withSuffix(slug: string, suffix: string): string {
  const trimmed = slug.slice(0, 60 - suffix.length - 1).replace(/-+$/g, "");
  return `${trimmed}-${suffix}`;
}

export function randomSuffix(length = 4): string {
  return Math.random()
    .toString(36)
    .slice(2, 2 + length)
    .padEnd(length, "0");
}
