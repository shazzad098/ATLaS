"use client";

import type { EditableThemeConfig } from "@/app/admin/_components/theme-editor";

/**
 * Client-side theme preview.
 *
 * Renders the merchant's unsaved draft with the same tokens, copy and section
 * order the storefront uses, so every keystroke is visible before saving. The
 * real, server-rendered draft lives at `/design-preview`.
 */

const SECTION_FALLBACK_TITLE: Record<string, string> = {
  CategoryGrid: "ক্যাটাগরি",
  ProductGrid: "আজকের নির্বাচিত পণ্য",
  Testimonials: "ক্রেতারা যা বলছেন",
  TrustBar: "আমাদের নিশ্চয়তা",
};

function radiusOf(style: EditableThemeConfig["buttons"]["style"]): string {
  if (style === "pill") return "9999px";
  if (style === "square") return "0.15rem";
  return "0.6rem";
}

function headingFont(config: EditableThemeConfig): string {
  return config.typography.headingFont === "serif" ? "var(--font-serif)" : "var(--font-sans)";
}

function bodyFont(config: EditableThemeConfig): string {
  return config.typography.bodyFont === "serif" ? "var(--font-serif)" : "var(--font-sans)";
}

export function ThemePreview({
  config,
  themeCode,
  storeName,
  device = "mobile",
}: {
  config: EditableThemeConfig;
  themeCode: string;
  storeName: string;
  device?: "mobile" | "desktop";
}) {
  const big = device === "desktop";
  const { colors } = config;
  const primary = colors.primary;
  const deep = `color-mix(in srgb, ${primary} 78%, #06110b)`;
  const soft = `color-mix(in srgb, ${primary} 10%, #ffffff)`;
  const radius = radiusOf(config.buttons.style);
  const heading = headingFont(config);
  const body = bodyFont(config);
  const enabled = new Set(config.sections.filter((section) => section.enabled).map((section) => section.key));
  const showSearch = config.header.showSearch && config.header.style !== "minimal";
  const centered = config.header.style === "centered";

  const nav = config.navigation.slice(0, big ? 6 : 3);

  const logo = (
    <span className="flex min-w-0 items-center gap-1.5">
      <span
        className="grid shrink-0 place-items-center font-bold text-white"
        style={{
          background: primary,
          borderRadius: config.buttons.style === "square" ? "0.15rem" : "9999px",
          height: big ? 30 : 22,
          width: big ? 30 : 22,
          fontSize: big ? 13 : 10,
        }}
      >
        {storeName.trim().charAt(0) || "A"}
      </span>
      <span
        className="truncate font-bold"
        style={{ fontFamily: heading, fontSize: big ? 16 : 12, color: colors.text }}
      >
        {storeName}
      </span>
    </span>
  );

  const cart = (
    <span
      className="shrink-0 font-semibold text-white"
      style={{ background: primary, borderRadius: radius, padding: big ? "6px 12px" : "4px 8px", fontSize: big ? 11 : 9 }}
    >
      কার্ট
    </span>
  );

  return (
    <div
      className="w-full overflow-hidden border border-ink-200/80 shadow-sm"
      style={{ background: colors.background, color: colors.text, fontFamily: body }}
    >
      {config.header.announcement ? (
        <div
          className="truncate px-2 py-1 text-center font-medium text-white"
          style={{ background: deep, fontSize: big ? 10.5 : 8.5 }}
        >
          {config.header.announcement}
        </div>
      ) : null}

      <div
        className={`border-b px-2.5 ${centered ? "flex flex-col items-center gap-1.5 py-2" : "flex items-center gap-2 py-2"}`}
        style={{ borderColor: `color-mix(in srgb, ${primary} 14%, transparent)` }}
      >
        {logo}
        {!centered && nav.length ? (
          <span className="hidden min-w-0 flex-1 items-center gap-2 overflow-hidden sm:flex">
            {nav.map((link) => (
              <span
                key={`${link.label}-${link.href}`}
                className="truncate whitespace-nowrap"
                style={{ color: colors.muted, fontSize: big ? 11 : 8.5 }}
              >
                {link.label}
              </span>
            ))}
          </span>
        ) : null}
        {centered && nav.length ? (
          <span className="flex max-w-full flex-wrap items-center justify-center gap-x-2 gap-y-0.5">
            {nav.map((link) => (
              <span
                key={`${link.label}-${link.href}`}
                className="truncate"
                style={{ color: colors.muted, fontSize: big ? 11 : 8.5 }}
              >
                {link.label}
              </span>
            ))}
          </span>
        ) : null}
        {showSearch ? (
          <span
            className="hidden min-w-0 flex-1 items-center gap-1 border px-2 py-1 sm:flex"
            style={{
              borderColor: `color-mix(in srgb, ${primary} 16%, transparent)`,
              background: colors.surface,
              borderRadius: radius,
              color: colors.muted,
              fontSize: big ? 10.5 : 8,
            }}
          >
            <span className="truncate">পণ্য খুঁজুন…</span>
          </span>
        ) : null}
        <span className={centered ? "" : "ml-auto"}>{cart}</span>
      </div>

      {enabled.has("Hero") && config.hero.enabled ? (
        <div
          className="relative overflow-hidden px-3 py-5"
          style={{
            background: `linear-gradient(120deg, ${primary} 0%, ${deep} 100%)`,
            textAlign: config.hero.align,
          }}
        >
          <p
            className="font-bold leading-tight text-white"
            style={{ fontFamily: heading, fontSize: big ? 28 : 16 }}
          >
            {config.hero.title || "আপনার নতুন সংগ্রহ"}
          </p>
          <p
            className="mt-1.5 leading-relaxed text-white/85"
            style={{ fontSize: big ? 12 : 9, marginInline: config.hero.align === "center" ? "auto" : 0, maxWidth: big ? 460 : 240 }}
          >
            {config.hero.subtitle}
          </p>
          <span
            className="mt-3 inline-block font-bold"
            style={{
              background: colors.background,
              color: primary,
              borderRadius: radius,
              padding: big ? "7px 14px" : "4px 9px",
              fontSize: big ? 11.5 : 9,
            }}
          >
            {config.hero.ctaLabel || "এখনই কিনুন"}
          </span>
        </div>
      ) : null}

      {config.sections
        .filter((section) => section.enabled && !["Header", "Footer", "Hero"].includes(section.key))
        .map((section) => {
          const title = section.title || SECTION_FALLBACK_TITLE[section.key] || "";
          if (section.key === "CategoryGrid") {
            return (
              <div key={section.key} className="px-3 py-3" style={{ background: colors.surface }}>
                <p style={{ fontFamily: heading, fontSize: big ? 15 : 11, fontWeight: 700 }}>{title}</p>
                <div className="mt-2 grid grid-cols-4 gap-1.5">
                  {["শাড়ি", "কুর্তি", "থ্রি-পিস", "ওড়না"].map((name) => (
                    <div key={name} className="text-center">
                      <span
                        className="mx-auto block"
                        style={{ background: soft, borderRadius: 9999, height: big ? 34 : 22, width: big ? 34 : 22 }}
                      />
                      <span className="mt-1 block truncate" style={{ fontSize: big ? 9 : 7, color: colors.muted }}>
                        {name}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            );
          }
          if (section.key === "ProductGrid") {
            return (
              <div key={section.key} className="px-3 py-3" style={{ background: colors.background }}>
                <p style={{ fontFamily: heading, fontSize: big ? 15 : 11, fontWeight: 700 }}>{title}</p>
                <div className="mt-2 grid grid-cols-3 gap-1.5">
                  {[0, 1, 2].map((index) => (
                    <div key={index} className="overflow-hidden border" style={{ borderColor: "rgba(0,0,0,0.06)", borderRadius: radius }}>
                      <div style={{ background: colors.surface, height: big ? 90 : 52 }} />
                      <div className="p-1.5">
                        <p className="truncate" style={{ fontSize: big ? 9.5 : 7.5 }}>
                          পণ্যের নাম
                        </p>
                        <p className="font-bold" style={{ color: primary, fontSize: big ? 10.5 : 8 }}>
                          ৳ ১,২৫০
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          }
          if (section.key === "PromoBanner") {
            if (!config.promo.enabled || (!config.promo.title && !config.promo.body)) return null;
            return (
              <div key={section.key} className="px-3 py-2.5">
                <div
                  className="px-3 py-3 text-white"
                  style={{ background: `linear-gradient(110deg, ${primary}, ${deep})`, borderRadius: radius }}
                >
                  <p style={{ fontFamily: heading, fontSize: big ? 15 : 11, fontWeight: 700 }}>
                    {config.promo.title || "বিশেষ অফার"}
                  </p>
                  {config.promo.body ? (
                    <p className="mt-1 text-white/80" style={{ fontSize: big ? 10.5 : 8 }}>
                      {config.promo.body}
                    </p>
                  ) : null}
                  {config.promo.ctaLabel ? (
                    <span
                      className="mt-2 inline-block bg-white font-semibold"
                      style={{ color: primary, borderRadius: radius, padding: "2px 7px", fontSize: big ? 10 : 8 }}
                    >
                      {config.promo.ctaLabel}
                    </span>
                  ) : null}
                </div>
              </div>
            );
          }
          if (section.key === "TrustBar") {
            if (!config.trust.enabled || config.trust.items.length === 0) return null;
            return (
              <div key={section.key} className="px-3 py-3" style={{ background: colors.surface }}>
                {title ? (
                  <p className="mb-1.5 text-center" style={{ fontFamily: heading, fontSize: big ? 13 : 10, fontWeight: 700 }}>
                    {title}
                  </p>
                ) : null}
                <div className="grid grid-cols-2 gap-1.5">
                  {config.trust.items.slice(0, 4).map((item) => (
                    <span key={item} className="flex items-center gap-1" style={{ fontSize: big ? 9.5 : 7.5 }}>
                      <span
                        className="shrink-0"
                        style={{ background: primary, borderRadius: 9999, height: big ? 8 : 6, width: big ? 8 : 6 }}
                      />
                      <span className="truncate">{item}</span>
                    </span>
                  ))}
                </div>
              </div>
            );
          }
          if (section.key === "Testimonials") {
            if (!config.testimonials.enabled || config.testimonials.items.length === 0) return null;
            return (
              <div key={section.key} className="px-3 py-3" style={{ background: colors.background }}>
                <p style={{ fontFamily: heading, fontSize: big ? 15 : 11, fontWeight: 700 }}>{title}</p>
                <div className="mt-2 grid grid-cols-2 gap-1.5">
                  {config.testimonials.items.slice(0, 2).map((item, index) => (
                    <div
                      key={`${item.name}-${index}`}
                      className="border p-2"
                      style={{ borderColor: "rgba(0,0,0,0.06)", borderRadius: radius, background: colors.surface }}
                    >
                      <p style={{ color: colors.accent, fontSize: big ? 9 : 7 }}>★★★★★</p>
                      <p className="mt-1 line-clamp-3" style={{ fontSize: big ? 9.5 : 7.5 }}>
                        “{item.quote}”
                      </p>
                      <p className="mt-1 font-semibold" style={{ fontSize: big ? 8.5 : 7, color: colors.muted }}>
                        {item.name}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            );
          }
          return null;
        })}

      <div className="px-3 py-3 text-white" style={{ background: deep }}>
        <p style={{ fontFamily: heading, fontSize: big ? 14 : 10, fontWeight: 700 }}>{storeName}</p>
        <p className="mt-1 line-clamp-2 text-white/70" style={{ fontSize: big ? 9.5 : 7.5 }}>
          {config.footer.about || "আপনার দোকানের পরিচিতি এখানে দেখাবে।"}
        </p>
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
          {config.footer.columns.slice(0, 3).map((column) => (
            <div key={column.title}>
              <p className="font-semibold text-white/90" style={{ fontSize: big ? 9.5 : 7.5 }}>
                {column.title}
              </p>
              {column.links.slice(0, 3).map((link) => (
                <p key={`${column.title}-${link.href}`} className="text-white/60" style={{ fontSize: big ? 9 : 7 }}>
                  {link.label}
                </p>
              ))}
            </div>
          ))}
        </div>
        <p className="mt-2 border-t border-white/15 pt-1.5 text-white/55" style={{ fontSize: big ? 8.5 : 6.5 }}>
          {config.footer.note || `© ${new Date().getFullYear()} ${storeName}`}
        </p>
      </div>

      <div
        className="px-2 py-1 text-center font-semibold uppercase tracking-[0.16em]"
        style={{ background: colors.surface, color: colors.muted, fontSize: big ? 8 : 6.5 }}
      >
        {themeCode} theme
      </div>
    </div>
  );
}
