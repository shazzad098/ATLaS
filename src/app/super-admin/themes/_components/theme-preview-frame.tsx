import type { ThemeCatalogEntry } from "@/lib/theme-catalog";

/**
 * Miniature storefront preview for a catalog theme.
 *
 * Server-rendered from the theme's real default config (colors, fonts, hero
 * copy), so the card never shows a screenshot that has drifted from the theme
 * the merchant actually gets.
 */

function ChromeDots() {
  return (
    <span className="flex items-center gap-1">
      <span className="h-1.5 w-1.5 rounded-full bg-rose-300" />
      <span className="h-1.5 w-1.5 rounded-full bg-amber-300" />
      <span className="h-1.5 w-1.5 rounded-full bg-emerald-300" />
    </span>
  );
}

export function ThemePreviewFrame({
  entry,
  className = "",
}: {
  entry: ThemeCatalogEntry;
  className?: string;
}) {
  const config = entry.defaultConfig;

  return (
    <div className={`rounded-xl bg-gradient-to-br ${entry.preview.gradient} p-2.5 ${className}`}>
      <div className="overflow-hidden rounded-lg bg-white/85 shadow-[0_12px_28px_-20px_rgba(15,23,42,0.45)] ring-1 ring-white/70 backdrop-blur-sm">
        <div className="flex items-center gap-2 border-b border-black/[0.04] bg-white/70 px-2.5 py-1.5">
          <ChromeDots />
          <span className="ml-0.5 min-w-0 flex-1 truncate rounded-full bg-white px-2 py-0.5 text-center font-mono text-[8px] text-slate-400 ring-1 ring-black/[0.04]">
            {entry.code}-preview.atlas
          </span>
          <span className="flex items-center gap-1">
            {entry.preview.swatches.slice(0, 2).map((swatch) => (
              <span
                key={swatch}
                className="h-2 w-2 rounded-full ring-1 ring-black/10"
                style={{ background: swatch }}
              />
            ))}
          </span>
        </div>

        <div className="p-2.5">
          {entry.code === "nokshi" ? <NokshiMock entry={entry} /> : null}
          {entry.code === "bazar" ? <BazarMock /> : null}
          {entry.code === "studio" ? <StudioMock /> : null}
          {!["nokshi", "bazar", "studio"].includes(entry.code) ? <GenericMock entry={entry} /> : null}
        </div>
      </div>
      <p className="mt-1.5 text-center text-[8px] font-medium tracking-wide text-slate-500/80">
        {config.trust.items[0] ?? entry.style}
      </p>
    </div>
  );
}

function NokshiMock({ entry }: { entry: ThemeCatalogEntry }) {
  return (
    <div className="grid grid-cols-3 gap-1.5">
      <div className="flex h-16 flex-col justify-end rounded-md bg-[#FEF1E5] px-2 py-1.5">
        <span className="text-[7px] font-medium text-rose-700/70">Editorial</span>
        <span className="text-[8px] font-semibold text-rose-900">Hero</span>
      </div>
      <div className="flex h-16 flex-col justify-end rounded-md bg-[#FBE3E8] px-2 py-1.5">
        <span className="text-[7px] font-medium text-rose-700/60">Grid Col</span>
      </div>
      <div className="flex h-16 flex-col justify-end rounded-md bg-[#FDF4E7] px-2 py-1.5">
        <span className="text-[7px] font-medium text-amber-700/60">Lookbook</span>
      </div>
      <span className="sr-only">{entry.name} preview</span>
    </div>
  );
}

function BazarMock() {
  const chips = ["মুদি", "প্যাকেজিং", "স্ন্যাকস", "বাজার"];
  return (
    <div className="space-y-1.5">
      <div className="h-1.5 w-20 rounded-full bg-emerald-900/10" />
      <div className="h-1 w-28 rounded-full bg-emerald-900/5" />
      <div className="flex gap-1.5 pt-0.5">
        {chips.map((chip) => (
          <div
            key={chip}
            className="flex-1 rounded-md border border-emerald-900/5 bg-emerald-100/70 px-1 py-2.5 text-center text-[7px] font-medium text-emerald-900"
          >
            {chip}
          </div>
        ))}
      </div>
    </div>
  );
}

function StudioMock() {
  return (
    <div className="flex items-center gap-2">
      <div className="flex h-12 flex-1 items-center rounded-md bg-slate-900 px-2.5">
        <span className="text-[8px] font-medium text-white">Clean Minimal Headline</span>
      </div>
      <div className="grid h-12 w-11 place-items-center rounded-md border border-sky-200 bg-white text-[7px] font-semibold text-sky-700">
        CTA
      </div>
    </div>
  );
}

function GenericMock({ entry }: { entry: ThemeCatalogEntry }) {
  const config = entry.defaultConfig;
  return (
    <div
      className="rounded-md px-2.5 py-3"
      style={{ backgroundColor: config.colors.surface, color: config.colors.text }}
    >
      <p className="line-clamp-1 text-[8px] font-semibold">{config.hero.title}</p>
      <span
        className="mt-1.5 inline-block px-2 py-0.5 text-[7px] font-medium text-white"
        style={{ backgroundColor: config.colors.primary }}
      >
        {config.hero.ctaLabel}
      </span>
    </div>
  );
}
