"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useActionState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowUpRight,
  Check,
  ChevronDown,
  ChevronUp,
  Eye,
  Image as ImageIcon,
  LayoutGrid,
  Link2,
  Megaphone,
  Menu,
  MessageSquareQuote,
  Monitor,
  Palette,
  PanelBottom,
  Plus,
  Rocket,
  RotateCcw,
  Save,
  ShieldCheck,
  Smartphone,
  Store,
  Trash2,
  X,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert, Card, CardBody, CardHeader } from "@/components/ui/shell";
import { Field, Input, Select, Textarea } from "@/components/ui/form";
import {
  publishThemeAction,
  resetThemeDraftAction,
  saveThemeDraftAction,
  selectThemeAction,
} from "@/app/admin/actions";
import { EMPTY_ADMIN_STATE } from "@/app/admin/state";
import { ThemePreview } from "@/app/admin/_components/theme-preview";

/**
 * Theme editor (FR-06).
 *
 * Merchants edit the draft config here; nothing reaches the storefront until
 * they press Publish. The editor is deliberately form-first: every collection
 * (navigation, footer columns, reviews, trust items) is a repeatable row with
 * add / remove / reorder controls — no JSON is ever shown.
 */

export type EditableThemeConfig = {
  colors: {
    primary: string;
    accent: string;
    background: string;
    surface: string;
    text: string;
    muted: string;
  };
  typography: {
    headingFont: "sans" | "serif";
    bodyFont: "sans" | "serif";
    scale: "compact" | "comfortable";
  };
  buttons: { style: "rounded" | "pill" | "square" };
  header: {
    style: "classic" | "centered" | "minimal";
    showSearch: boolean;
    announcement: string;
    sticky: boolean;
  };
  hero: {
    enabled: boolean;
    title: string;
    subtitle: string;
    ctaLabel: string;
    ctaHref: string;
    align: "left" | "center";
  };
  promo: { enabled: boolean; title: string; body: string; ctaLabel: string; ctaHref: string };
  testimonials: { enabled: boolean; items: Array<{ name: string; quote: string; location: string }> };
  trust: { enabled: boolean; items: string[] };
  footer: {
    about: string;
    columns: Array<{ title: string; links: Array<{ label: string; href: string }> }>;
    note: string;
  };
  navigation: Array<{ label: string; href: string }>;
  sections: Array<{ key: string; enabled: boolean; title: string }>;
};

const SECTION_KEYS = [
  "Header",
  "Hero",
  "CategoryGrid",
  "ProductGrid",
  "PromoBanner",
  "Testimonials",
  "TrustBar",
  "Footer",
] as const;

const MIDDLE_KEYS = SECTION_KEYS.filter((key) => key !== "Header" && key !== "Footer");

const SECTION_META: Record<
  string,
  { label: string; hint: string; icon: LucideIcon; titleField: boolean }
> = {
  Header: { label: "হেডার", hint: "মেনু, লোগো ও ঘোষণা — সবসময় উপরে", icon: Menu, titleField: false },
  Hero: { label: "হিরো", hint: "হোমপেজের প্রথম বড় অংশ", icon: ImageIcon, titleField: false },
  CategoryGrid: {
    label: "ক্যাটাগরি গ্রিড",
    hint: "ক্যাটাগরি আইকন/ছবির সারি",
    icon: LayoutGrid,
    titleField: true,
  },
  ProductGrid: {
    label: "প্রোডাক্ট গ্রিড",
    hint: "নির্বাচিত পণ্যের কার্ড",
    icon: Store,
    titleField: true,
  },
  PromoBanner: {
    label: "প্রোমো ব্যানার",
    hint: "অফার/ছাড়ের ব্যানার",
    icon: Megaphone,
    titleField: false,
  },
  Testimonials: {
    label: "রিভিউ",
    hint: "ক্রেতার মতামত",
    icon: MessageSquareQuote,
    titleField: true,
  },
  TrustBar: {
    label: "ট্রাস্ট বার",
    hint: "ডেলিভারি, রিটার্ন, পেমেন্টের নিশ্চয়তা",
    icon: ShieldCheck,
    titleField: true,
  },
  Footer: { label: "ফুটার", hint: "কলাম, ঠিকানা ও নোট — সবসময় নিচে", icon: PanelBottom, titleField: false },
};

const COLOR_FIELDS: Array<{
  key: keyof EditableThemeConfig["colors"];
  label: string;
  hint: string;
}> = [
  { key: "primary", label: "প্রাইমারি", hint: "বাটন, হেডার, লিংক" },
  { key: "accent", label: "অ্যাকসেন্ট", hint: "ছোট হাইলাইট, ব্যাজ" },
  { key: "background", label: "ব্যাকগ্রাউন্ড", hint: "পেজের মূল রঙ" },
  { key: "surface", label: "সারফেস", hint: "কার্ড ও সেকশনের হালকা রঙ" },
  { key: "text", label: "টেক্সট", hint: "মূল লেখার রঙ" },
  { key: "muted", label: "মিউটেড", hint: "সেকেন্ডারি লেখা" },
];

const TABS = [
  { id: "brand", label: "ব্র্যান্ড", icon: Palette },
  { id: "header", label: "হেডার", icon: Menu },
  { id: "hero", label: "হিরো", icon: ImageIcon },
  { id: "sections", label: "সেকশন", icon: LayoutGrid },
  { id: "promo", label: "প্রোমো ও ট্রাস্ট", icon: Megaphone },
  { id: "nav", label: "নেভিগেশন", icon: Link2 },
  { id: "footer", label: "ফুটার", icon: PanelBottom },
  { id: "reviews", label: "রিভিউ", icon: MessageSquareQuote },
] as const;

type TabID = (typeof TABS)[number]["id"];

const HEX = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

function legacyEnabled(config: EditableThemeConfig, key: string): boolean {
  if (key === "Hero") return config.hero.enabled;
  if (key === "PromoBanner") return config.promo.enabled;
  if (key === "Testimonials") return config.testimonials.enabled;
  if (key === "TrustBar") return config.trust.enabled;
  return true;
}

/** Every section is always present and Header/Footer stay at their ends. */
function normalize(config: EditableThemeConfig): EditableThemeConfig {
  const byKey = new Map(config.sections.map((section) => [section.key, section]));
  const sections: EditableThemeConfig["sections"] = [
    { key: "Header", enabled: true, title: "" },
    ...MIDDLE_KEYS.map((key) => {
      const existing = byKey.get(key);
      return {
        key,
        enabled: existing ? existing.enabled && legacyEnabled(config, key) : legacyEnabled(config, key),
        title: existing?.title ?? "",
      };
    }),
    { key: "Footer", enabled: true, title: "" },
  ];
  return syncLegacy({ ...config, sections });
}

/** The section list is the single source of truth; mirror it into legacy flags. */
function syncLegacy(config: EditableThemeConfig): EditableThemeConfig {
  const on = (key: string) => config.sections.find((section) => section.key === key)?.enabled ?? true;
  return {
    ...config,
    hero: { ...config.hero, enabled: on("Hero") },
    promo: { ...config.promo, enabled: on("PromoBanner") },
    testimonials: { ...config.testimonials, enabled: on("Testimonials") },
    trust: { ...config.trust, enabled: on("TrustBar") },
  };
}

export function ThemeEditor({
  storeId,
  themeVersionId,
  themeCode,
  themeName,
  storeName,
  draft,
  isPublished,
  canSwitch,
  switchBlockedReason,
  options,
}: {
  storeId: string;
  themeVersionId: string;
  themeCode: string;
  themeName: string;
  storeName: string;
  draft: EditableThemeConfig;
  isPublished: boolean;
  canSwitch: boolean;
  switchBlockedReason: string | null;
  options: Array<{
    code: string;
    name: string;
    style: string;
    gradient: string;
    swatches: string[];
    allowed: boolean;
    selected: boolean;
  }>;
}) {
  const router = useRouter();
  const [saveState, saveSubmit, savePending] = useActionState(saveThemeDraftAction, EMPTY_ADMIN_STATE);
  const [publishState, publishSubmit, publishPending] = useActionState(
    publishThemeAction,
    EMPTY_ADMIN_STATE,
  );
  const [selectState, selectSubmit, selectPending] = useActionState(
    selectThemeAction,
    EMPTY_ADMIN_STATE,
  );
  const [resetState, resetSubmit, resetPending] = useActionState(
    resetThemeDraftAction,
    EMPTY_ADMIN_STATE,
  );

  const [config, setConfig] = useState<EditableThemeConfig>(() => normalize(draft));
  const [baseline, setBaseline] = useState<string>(() => JSON.stringify(normalize(draft)));
  const [tab, setTab] = useState<TabID>("brand");
  const [previewOpen, setPreviewOpen] = useState(false);
  const [device, setDevice] = useState<"mobile" | "desktop">("mobile");

  const configRef = useRef(config);
  useEffect(() => {
    configRef.current = config;
  }, [config]);

  // A theme switch or reset replaces the whole draft, so reload the server data.
  useEffect(() => {
    if (selectState.ok) window.location.reload();
  }, [selectState]);
  useEffect(() => {
    if (resetState.ok) window.location.reload();
  }, [resetState]);
  useEffect(() => {
    if (saveState.ok) setBaseline(JSON.stringify(configRef.current));
  }, [saveState]);
  useEffect(() => {
    if (publishState.ok) {
      setBaseline(JSON.stringify(configRef.current));
      router.refresh();
    }
  }, [publishState, router]);

  // Lock the page behind the full-screen preview.
  useEffect(() => {
    if (!previewOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [previewOpen]);

  const configJson = JSON.stringify(config);
  const dirty = configJson !== baseline;

  const invalidColors = COLOR_FIELDS.filter(({ key }) => !HEX.test(config.colors[key]));
  const invalidLinks = [
    ...config.navigation,
    ...config.footer.columns.flatMap((column) => column.links),
  ].filter((link) => !link.label.trim() || !link.href.trim());
  const invalid = invalidColors.length > 0 || invalidLinks.length > 0;

  const messages = [saveState, publishState, selectState, resetState].filter((state) => state.message);

  function update(patch: Partial<EditableThemeConfig>) {
    setConfig((value) => ({ ...value, ...patch }));
  }

  function setSectionEnabled(key: string, enabled: boolean) {
    setConfig((value) =>
      syncLegacy({
        ...value,
        sections: value.sections.map((section) =>
          section.key === key ? { ...section, enabled } : section,
        ),
      }),
    );
  }

  function setSectionTitle(key: string, title: string) {
    setConfig((value) => ({
      ...value,
      sections: value.sections.map((section) =>
        section.key === key ? { ...section, title } : section,
      ),
    }));
  }

  function moveSection(key: string, dir: -1 | 1) {
    setConfig((value) => {
      const index = value.sections.findIndex((section) => section.key === key);
      const target = index + dir;
      if (index < 0 || target < 0 || target >= value.sections.length) return value;
      if (value.sections[target].key === "Header" || value.sections[target].key === "Footer") {
        return value;
      }
      const sections = [...value.sections];
      [sections[index], sections[target]] = [sections[target], sections[index]];
      return { ...value, sections };
    });
  }

  const enabled = (key: string) =>
    config.sections.find((section) => section.key === key)?.enabled ?? true;

  const sectionTitle = (key: string) =>
    config.sections.find((section) => section.key === key)?.title ?? "";

  return (
    <div className="space-y-4">
      {/* ── Sticky action bar ───────────────────────────────── */}
      <div className="sticky top-16 z-20 rounded-xl border border-ink-200 bg-white/95 px-3 py-2.5 shadow-sm backdrop-blur">
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10.5px] font-semibold ${
              isPublished
                ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                : "border-amber-200 bg-amber-50 text-amber-700"
            }`}
          >
            <span
              className={`h-1.5 w-1.5 rounded-full ${
                isPublished ? "bg-emerald-500" : "animate-pulse bg-amber-500"
              }`}
            />
            {isPublished ? "Live" : "Draft"}
          </span>

          <span className="hidden items-center gap-1 text-[11px] font-medium text-ink-500 sm:inline-flex">
            {themeName} থিম
            {dirty ? <span className="text-amber-600">· অসংরক্ষিত পরিবর্তন</span> : null}
          </span>

          <div className="ml-auto flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setPreviewOpen(true)}
              className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-ink-200 px-2.5 text-[11px] font-medium text-ink-700 hover:bg-ink-50"
            >
              <Eye className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">প্রিভিউ</span>
            </button>
            <Link
              href="/design-preview"
              target="_blank"
              className="hidden h-8 items-center gap-1.5 rounded-lg border border-ink-200 px-2.5 text-[11px] font-medium text-ink-700 hover:bg-ink-50 sm:inline-flex"
            >
              <ArrowUpRight className="h-3.5 w-3.5" />
              ড্রাফট সাইট
            </Link>

            <form action={saveSubmit}>
              <input type="hidden" name="storeId" value={storeId} />
              <input type="hidden" name="themeVersionId" value={themeVersionId} />
              <input type="hidden" name="config" value={configJson} />
              <Button type="submit" size="sm" variant="outline" disabled={savePending || invalid}>
                <Save className="h-3.5 w-3.5" />
                {savePending ? "সেভ হচ্ছে…" : "সেভ"}
              </Button>
            </form>

            <form
              action={publishSubmit}
              onSubmit={(event) => {
                if (
                  isPublished &&
                  !window.confirm("এই পরিবর্তনগুলো এখনই live দোকানে যাবে। publish করবেন?")
                ) {
                  event.preventDefault();
                }
              }}
            >
              <input type="hidden" name="storeId" value={storeId} />
              <input type="hidden" name="themeVersionId" value={themeVersionId} />
              <input type="hidden" name="config" value={configJson} />
              <Button type="submit" size="sm" disabled={publishPending || invalid}>
                <Rocket className="h-3.5 w-3.5" />
                {publishPending ? "Publish হচ্ছে…" : "Publish"}
              </Button>
            </form>
          </div>
        </div>
        {dirty ? (
          <p className="mt-1.5 text-[10.5px] text-amber-700">
            পরিবর্তনগুলো এখনো সেভ হয়নি। Publish চাপলে সেভ হয়ে সরাসরি live দোকানে যাবে।
          </p>
        ) : null}
      </div>

      {/* ── Messages ────────────────────────────────────────── */}
      {messages.length > 0 ? (
        <div className="space-y-2">
          {messages.map((state, index) => (
            <Alert key={`${state.message}-${index}`} tone={state.ok ? "success" : "danger"}>
              {state.message}
            </Alert>
          ))}
        </div>
      ) : null}

      {invalid ? (
        <Alert tone="warning" title="কিছু তথ্য ঠিক করতে হবে">
          {invalidColors.length > 0
            ? "রঙের কোড #RRGGBB ফরম্যাটে দিন। "
            : ""}
          {invalidLinks.length > 0 ? "নেভিগেশন/ফুটারের প্রতিটি লিংকে লেবেল ও ঠিকানা দুটোই লাগবে।" : ""}
        </Alert>
      ) : null}

      {/* ── Tabs ────────────────────────────────────────────── */}
      <div className="no-scrollbar -mx-1 flex gap-1 overflow-x-auto px-1 pb-1">
        {TABS.map(({ id, label, icon: Icon }) => {
          const active = tab === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              aria-current={active ? "page" : undefined}
              className={`inline-flex shrink-0 items-center gap-1.5 rounded-lg border px-3 py-2 text-[11.5px] font-medium transition ${
                active
                  ? "border-brand-300 bg-brand-50 text-brand-800 shadow-xs"
                  : "border-ink-200 bg-white text-ink-600 hover:bg-ink-50"
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              {label}
            </button>
          );
        })}
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0 space-y-4">
          {/* ═════════ BRAND ═════════ */}
          {tab === "brand" ? (
            <>
              <Panel
                title="থিম বাছুন"
                description="থিম বদলালে হিরো, প্রোমো ও অন্যান্য কনটেন্ট নতুন থিমের ডিফল্টে যাবে।"
              >
                <div className="grid gap-3 sm:grid-cols-3">
                  {options.map((option) => {
                    const current = option.code === themeCode;
                    const disabled = !option.allowed || current || selectPending;
                    return (
                      <form
                        key={option.code}
                        action={selectSubmit}
                        onSubmit={(event) => {
                          if (
                            dirty &&
                            !window.confirm(
                              "থিম বদলালে বর্তমান অসংরক্ষিত পরিবর্তন হারিয়ে যাবে। চালিয়ে যাবেন?",
                            )
                          ) {
                            event.preventDefault();
                          }
                        }}
                      >
                        <input type="hidden" name="storeId" value={storeId} />
                        <input type="hidden" name="themeCode" value={option.code} />
                        <button
                          type="submit"
                          disabled={disabled}
                          className={`w-full overflow-hidden rounded-xl border text-left transition ${
                            current
                              ? "border-brand-400 shadow-[0_0_0_3px_var(--color-brand-100)]"
                              : option.allowed
                                ? "border-ink-200 hover:-translate-y-0.5 hover:shadow-md"
                                : "cursor-not-allowed border-ink-200 opacity-60"
                          }`}
                        >
                          <span
                            className="relative block h-16"
                            style={{
                              background: `linear-gradient(135deg, ${option.swatches[0]} 0%, ${option.swatches[1]} 55%, ${option.swatches[2]} 100%)`,
                            }}
                          >
                            {current ? (
                              <span className="absolute top-1.5 right-1.5 grid h-5 w-5 place-items-center rounded-full bg-white text-brand-700 shadow">
                                <Check className="h-3 w-3" />
                              </span>
                            ) : null}
                            {!option.allowed ? (
                              <span className="absolute top-1.5 right-1.5 rounded-full bg-white/90 px-1.5 py-0.5 text-[9px] font-semibold text-ink-700">
                                🔒
                              </span>
                            ) : null}
                          </span>
                          <span className="block bg-white p-2.5">
                            <span className="block text-[12px] font-semibold text-ink-900">{option.name}</span>
                            <span className="mt-0.5 block text-[10px] text-ink-500">
                              {option.style}
                              {current ? " · বর্তমান" : ""}
                              {!option.allowed ? " · upgrade প্রয়োজন" : ""}
                            </span>
                          </span>
                        </button>
                      </form>
                    );
                  })}
                </div>
                {!canSwitch && isPublished ? (
                  <p className="text-[11px] text-amber-700">{switchBlockedReason}</p>
                ) : null}
              </Panel>

              <Panel
                title="রঙ"
                description="এই রঙগুলোই স্টোরফ্রন্ট, বাটন, হেডার ও ফুটারে ব্যবহার হবে।"
              >
                <div className="grid gap-3 sm:grid-cols-2">
                  {COLOR_FIELDS.map(({ key, label, hint }) => {
                    const value = config.colors[key];
                    const ok = HEX.test(value);
                    return (
                      <div key={key} className="rounded-xl border border-ink-200 p-2.5">
                        <div className="flex items-center gap-2.5">
                          <label className="relative h-10 w-10 shrink-0 cursor-pointer overflow-hidden rounded-lg border border-ink-200 shadow-sm">
                            <span className="absolute inset-0" style={{ background: ok ? value : "#fff" }} />
                            <input
                              type="color"
                              value={ok ? value : "#ffffff"}
                              onChange={(event) =>
                                update({ colors: { ...config.colors, [key]: event.target.value } })
                              }
                              className="absolute inset-0 cursor-pointer opacity-0"
                              aria-label={label}
                            />
                          </label>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-[11.5px] font-semibold text-ink-900">{label}</p>
                            <p className="truncate text-[9.5px] text-ink-500">{hint}</p>
                          </div>
                          <div className="w-[5.5rem] shrink-0">
                            <Input
                              value={value}
                              onChange={(event) =>
                                update({ colors: { ...config.colors, [key]: event.target.value } })
                              }
                              className={`px-2 font-mono text-[11px] uppercase ${ok ? "" : "border-red-400"}`}
                              aria-label={`${label} হেক্স কোড`}
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </Panel>

              <Panel title="টাইপোগ্রাফি ও বাটন" description="লেখার ধরন আর বাটনের কোণ ঠিক করুন।">
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="হেডিং ফন্ট">
                    <Select
                      value={config.typography.headingFont}
                      onChange={(event) =>
                        update({
                          typography: {
                            ...config.typography,
                            headingFont: event.target.value as "sans" | "serif",
                          },
                        })
                      }
                    >
                      <option value="serif">Serif — ক্লাসিক</option>
                      <option value="sans">Sans — আধুনিক</option>
                    </Select>
                  </Field>
                  <Field label="বডি ফন্ট">
                    <Select
                      value={config.typography.bodyFont}
                      onChange={(event) =>
                        update({
                          typography: {
                            ...config.typography,
                            bodyFont: event.target.value as "sans" | "serif",
                          },
                        })
                      }
                    >
                      <option value="sans">Sans — পড়তে সহজ</option>
                      <option value="serif">Serif — ক্লাসিক</option>
                    </Select>
                  </Field>
                </div>

                <div className="space-y-2">
                  <p className="text-[11px] font-medium text-ink-700">বাটনের কোণ</p>
                  <Segmented
                    value={config.buttons.style}
                    onChange={(value) => update({ buttons: { style: value } })}
                    options={[
                      { value: "rounded", label: "Rounded", hint: "নরম কোণ" },
                      { value: "pill", label: "Pill", hint: "সম্পূর্ণ গোল" },
                      { value: "square", label: "Square", hint: "সোজা কোণ" },
                    ]}
                  />
                </div>

                <div className="space-y-2">
                  <p className="text-[11px] font-medium text-ink-700">সেকশনের ফাঁক</p>
                  <Segmented
                    columns={2}
                    value={config.typography.scale}
                    onChange={(value) => update({ typography: { ...config.typography, scale: value } })}
                    options={[
                      { value: "comfortable", label: "Comfortable", hint: "খোলামেলা" },
                      { value: "compact", label: "Compact", hint: "কম ফাঁক, বেশি তথ্য" },
                    ]}
                  />
                </div>

                <div className="rounded-xl border border-dashed border-ink-200 bg-ink-50/60 p-3">
                  <p className="mb-1 text-[9.5px] font-semibold tracking-[0.16em] text-ink-500 uppercase">
                    প্রিভিউ
                  </p>
                  <p
                    className="text-lg font-semibold leading-snug text-ink-900"
                    style={{
                      fontFamily:
                        config.typography.headingFont === "serif" ? "var(--font-serif)" : "var(--font-sans)",
                    }}
                  >
                    {config.hero.title || "আপনার নতুন সংগ্রহ"}
                  </p>
                  <p
                    className="mt-1 text-[12px] leading-6 text-ink-600"
                    style={{
                      fontFamily:
                        config.typography.bodyFont === "serif" ? "var(--font-serif)" : "var(--font-sans)",
                    }}
                  >
                    {config.hero.subtitle || "সরাসরি দোকান থেকে, ঘরে পৌঁছে যাবে।"}
                  </p>
                </div>
              </Panel>
            </>
          ) : null}

          {/* ═════════ HEADER ═════════ */}
          {tab === "header" ? (
            <Panel title="হেডার" description="দোকানের উপরের অংশ — মেনু, ঘোষণা ও সার্চ।">
              <div className="space-y-2">
                <p className="text-[11px] font-medium text-ink-700">হেডারের ধরন</p>
                <Segmented
                  value={config.header.style}
                  onChange={(value) => update({ header: { ...config.header, style: value } })}
                  options={[
                    { value: "classic", label: "Classic", hint: "লোগো বামে, মেনু পাশে" },
                    { value: "centered", label: "Centered", hint: "লোগো ও মেনু মাঝে" },
                    { value: "minimal", label: "Minimal", hint: "শুধু লোগো, মেনু, কার্ট" },
                  ]}
                />
              </div>

              <Field
                label="ঘোষণা বার"
                hint="হেডারের একদম উপরে দেখাবে। খালি রাখলে লুকানো থাকবে।"
              >
                <Textarea
                  value={config.header.announcement}
                  onChange={(event) =>
                    update({ header: { ...config.header, announcement: event.target.value } })
                  }
                  rows={2}
                  placeholder="যেমন: সারাদেশে হোম ডেলিভারি · ১০০০৳+ অর্ডারে ফ্রি ডেলিভারি"
                />
              </Field>

              <ToggleRow
                label="সার্চ বক্স দেখান"
                hint="ক্রেতা যেন সরাসরি পণ্য খুঁজতে পারে"
                checked={config.header.showSearch}
                onChange={() =>
                  update({ header: { ...config.header, showSearch: !config.header.showSearch } })
                }
              />
              <ToggleRow
                label="হেডার আটকে রাখুন"
                hint="স্ক্রল করলেও হেডার উপরে দৃশ্যমান থাকবে"
                checked={config.header.sticky}
                onChange={() => update({ header: { ...config.header, sticky: !config.header.sticky } })}
              />
            </Panel>
          ) : null}

          {/* ═════════ HERO ═════════ */}
          {tab === "hero" ? (
            <Panel
              title="হিরো"
              description="হোমপেজের প্রথম বড় অংশ — শিরোনাম, বর্ণনা ও মূল বাটন।"
              action={
                <Toggle
                  checked={enabled("Hero")}
                  onChange={() => setSectionEnabled("Hero", !enabled("Hero"))}
                  label="হিরো দেখান"
                />
              }
            >
              <Field label="শিরোনাম" hint="বড় করে দেখানো হবে">
                <Input
                  value={config.hero.title}
                  onChange={(event) => update({ hero: { ...config.hero, title: event.target.value } })}
                  placeholder="যেমন: আজকের বাজার, আজই বাড়িতে!"
                />
              </Field>
              <Field label="বর্ণনা" hint="শিরোনামের নিচে ১–২ লাইনের পরিচিতি">
                <Textarea
                  value={config.hero.subtitle}
                  onChange={(event) => update({ hero: { ...config.hero, subtitle: event.target.value } })}
                  rows={3}
                  placeholder="আপনার দোকানের বিশেষত্ব সংক্ষেপে লিখুন"
                />
              </Field>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="বাটনের লেখা">
                  <Input
                    value={config.hero.ctaLabel}
                    onChange={(event) =>
                      update({ hero: { ...config.hero, ctaLabel: event.target.value } })
                    }
                    placeholder="এখনই কিনুন"
                  />
                </Field>
                <Field label="বাটনের লিংক" hint="যেমন: /shop বা /page/contact">
                  <Input
                    value={config.hero.ctaHref}
                    onChange={(event) => update({ hero: { ...config.hero, ctaHref: event.target.value } })}
                    placeholder="/shop"
                  />
                </Field>
              </div>
              <div className="space-y-2">
                <p className="text-[11px] font-medium text-ink-700">লেখার অবস্থান</p>
                <Segmented
                  columns={2}
                  value={config.hero.align}
                  onChange={(value) => update({ hero: { ...config.hero, align: value } })}
                  options={[
                    { value: "left", label: "বাম দিকে", hint: "ছবির পাশে" },
                    { value: "center", label: "মাঝখানে", hint: "কেন্দ্রীভূত" },
                  ]}
                />
              </div>
            </Panel>
          ) : null}

          {/* ═════════ SECTIONS ═════════ */}
          {tab === "sections" ? (
            <Panel
              title="সেকশনের ক্রম"
              description="উপর-নিচ বাটন দিয়ে সাজান। যে সেকশন বন্ধ করবেন, হোমপেজে সেটি দেখাবে না।"
            >
              <ul className="space-y-2">
                <li>
                  <FixedSectionRow sectionKey="Header" />
                </li>
                {config.sections
                  .filter((section) => section.key !== "Header" && section.key !== "Footer")
                  .map((section, index, list) => {
                    const meta = SECTION_META[section.key] ?? {
                      label: section.key,
                      hint: "",
                      icon: LayoutGrid,
                      titleField: false,
                    };
                    const Icon = meta.icon;
                    return (
                      <li
                        key={section.key}
                        className={`rounded-xl border px-3 py-2.5 transition ${
                          section.enabled
                            ? "border-ink-200 bg-white"
                            : "border-dashed border-ink-200 bg-ink-50/50"
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-ink-100 text-ink-600">
                            <Icon className="h-3.5 w-3.5" />
                          </span>
                          <div className="min-w-0 flex-1">
                            <p
                              className={`truncate text-[12.5px] font-semibold ${
                                section.enabled ? "text-ink-900" : "text-ink-400"
                              }`}
                            >
                              {meta.label}
                            </p>
                            <p className="truncate text-[10px] text-ink-500">{meta.hint}</p>
                          </div>
                          <div className="flex items-center gap-0.5">
                            <IconButton
                              label="উপরে সরান"
                              disabled={index === 0}
                              onClick={() => moveSection(section.key, -1)}
                            >
                              <ChevronUp className="h-3.5 w-3.5" />
                            </IconButton>
                            <IconButton
                              label="নিচে সরান"
                              disabled={index === list.length - 1}
                              onClick={() => moveSection(section.key, 1)}
                            >
                              <ChevronDown className="h-3.5 w-3.5" />
                            </IconButton>
                          </div>
                          <Toggle
                            checked={section.enabled}
                            onChange={() => setSectionEnabled(section.key, !section.enabled)}
                            label={meta.label}
                          />
                        </div>
                        {meta.titleField && section.enabled ? (
                          <div className="mt-2 pl-9">
                            <Input
                              value={section.title}
                              onChange={(event) => setSectionTitle(section.key, event.target.value)}
                              placeholder={`${meta.label} শিরোনাম (খালি রাখলে ডিফল্ট)`}
                              className="text-[11.5px]"
                              aria-label={`${meta.label} শিরোনাম`}
                            />
                          </div>
                        ) : null}
                      </li>
                    );
                  })}
                <li>
                  <FixedSectionRow sectionKey="Footer" />
                </li>
              </ul>
              <p className="text-[10.5px] text-ink-500">
                হেডার সবসময় উপরে আর ফুটার সবসময় নিচে থাকে। বাকি সেকশনগুলোর ক্রম আপনি বদলাতে পারবেন।
              </p>
            </Panel>
          ) : null}

          {/* ═════════ PROMO + TRUST ═════════ */}
          {tab === "promo" ? (
            <>
              <Panel
                title="প্রোমো ব্যানার"
                description="বড় অফার, ছাড় বা ঘোষণার জন্য আলাদা ব্যানার।"
                action={
                  <Toggle
                    checked={enabled("PromoBanner")}
                    onChange={() => setSectionEnabled("PromoBanner", !enabled("PromoBanner"))}
                    label="প্রোমো ব্যানার দেখান"
                  />
                }
              >
                <Field label="শিরোনাম">
                  <Input
                    value={config.promo.title}
                    onChange={(event) => update({ promo: { ...config.promo, title: event.target.value } })}
                    placeholder="যেমন: ৫০০ টাকার উপরে ফ্রি ডেলিভারি!"
                  />
                </Field>
                <Field label="বর্ণনা">
                  <Textarea
                    value={config.promo.body}
                    onChange={(event) => update({ promo: { ...config.promo, body: event.target.value } })}
                    rows={3}
                    placeholder="অফারের শর্ত বা বিস্তারিত লিখুন"
                  />
                </Field>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="বাটনের লেখা">
                    <Input
                      value={config.promo.ctaLabel}
                      onChange={(event) =>
                        update({ promo: { ...config.promo, ctaLabel: event.target.value } })
                      }
                      placeholder="অফার দেখুন"
                    />
                  </Field>
                  <Field label="বাটনের লিংক">
                    <Input
                      value={config.promo.ctaHref}
                      onChange={(event) =>
                        update({ promo: { ...config.promo, ctaHref: event.target.value } })
                      }
                      placeholder="/shop"
                    />
                  </Field>
                </div>
              </Panel>

              <Panel
                title="ট্রাস্ট বার"
                description="ডেলিভারি, রিটার্ন বা পেমেন্টের নিশ্চয়তা — ক্রেতার আস্থা বাড়ায়।"
                action={
                  <Toggle
                    checked={enabled("TrustBar")}
                    onChange={() => setSectionEnabled("TrustBar", !enabled("TrustBar"))}
                    label="ট্রাস্ট বার দেখান"
                  />
                }
              >
                <Field label="শিরোনাম" hint="খালি রাখলে থিমের ডিফল্ট শিরোনাম দেখাবে">
                  <Input
                    value={sectionTitle("TrustBar")}
                    onChange={(event) => setSectionTitle("TrustBar", event.target.value)}
                    placeholder="আমাদের নিশ্চয়তা"
                  />
                </Field>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-[11px] font-medium text-ink-700">নিশ্চয়তার তালিকা</p>
                    <span className="text-[10px] text-ink-500">{config.trust.items.length}টি</span>
                  </div>
                  {config.trust.items.map((item, index) => (
                    <div key={`${item}-${index}`} className="flex items-center gap-1.5">
                      <Input
                        value={item}
                        onChange={(event) => {
                          const items = [...config.trust.items];
                          items[index] = event.target.value;
                          update({ trust: { ...config.trust, items } });
                        }}
                        className="text-[11.5px]"
                        aria-label={`নিশ্চয়তা ${index + 1}`}
                      />
                      <IconButton
                        label="উপরে সরান"
                        disabled={index === 0}
                        onClick={() => {
                          const items = [...config.trust.items];
                          [items[index], items[index - 1]] = [items[index - 1], items[index]];
                          update({ trust: { ...config.trust, items } });
                        }}
                      >
                        <ChevronUp className="h-3.5 w-3.5" />
                      </IconButton>
                      <IconButton
                        label="মুছুন"
                        tone="danger"
                        onClick={() =>
                          update({
                            trust: {
                              ...config.trust,
                              items: config.trust.items.filter((_, i) => i !== index),
                            },
                          })
                        }
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </IconButton>
                    </div>
                  ))}
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      update({ trust: { ...config.trust, items: [...config.trust.items, "নতুন নিশ্চয়তা"] } })
                    }
                  >
                    <Plus className="h-3.5 w-3.5" /> নিশ্চয়তা যোগ করুন
                  </Button>
                </div>
              </Panel>
            </>
          ) : null}

          {/* ═════════ NAVIGATION ═════════ */}
          {tab === "nav" ? (
            <Panel
              title="নেভিগেশন মেনু"
              description="এই লিংকগুলো আপনার হেডারে দেখাবে। ভেতরের পেজের জন্য /shop, /cart, /page/contact — বাইরের লিংকের জন্য পূর্ণ https:// ঠিকানা দিন।"
            >
              <div className="flex flex-wrap gap-1.5">
                {[
                  { label: "হোম", href: "/" },
                  { label: "শপ", href: "/shop" },
                  { label: "কার্ট", href: "/cart" },
                  { label: "যোগাযোগ", href: "/page/contact" },
                ].map((quick) => (
                  <button
                    key={quick.href}
                    type="button"
                    onClick={() => {
                      if (config.navigation.some((link) => link.href === quick.href)) return;
                      update({ navigation: [...config.navigation, quick] });
                    }}
                    className="rounded-full border border-ink-200 bg-white px-2.5 py-1 text-[10.5px] font-medium text-ink-600 hover:border-brand-300 hover:bg-brand-50"
                  >
                    + {quick.label}
                  </button>
                ))}
              </div>

              <div className="space-y-2">
                {config.navigation.map((link, index) => (
                  <div key={`${link.href}-${index}`} className="rounded-xl border border-ink-200 p-2">
                    <div className="flex items-center gap-1.5">
                      <span className="grid h-6 w-6 shrink-0 place-items-center rounded-md bg-ink-100 text-[10px] font-semibold text-ink-600 tabular-nums">
                        {index + 1}
                      </span>
                      <Input
                        value={link.label}
                        onChange={(event) => {
                          const navigation = [...config.navigation];
                          navigation[index] = { ...link, label: event.target.value };
                          update({ navigation });
                        }}
                        placeholder="লেবেল"
                        className="text-[11.5px]"
                        aria-label={`লিংক ${index + 1} লেবেল`}
                      />
                      <Input
                        value={link.href}
                        onChange={(event) => {
                          const navigation = [...config.navigation];
                          navigation[index] = { ...link, href: event.target.value };
                          update({ navigation });
                        }}
                        placeholder="/shop"
                        className="font-mono text-[11px]"
                        aria-label={`লিংক ${index + 1} ঠিকানা`}
                      />
                      <IconButton
                        label="উপরে সরান"
                        disabled={index === 0}
                        onClick={() => {
                          const navigation = [...config.navigation];
                          [navigation[index], navigation[index - 1]] = [
                            navigation[index - 1],
                            navigation[index],
                          ];
                          update({ navigation });
                        }}
                      >
                        <ChevronUp className="h-3.5 w-3.5" />
                      </IconButton>
                      <IconButton
                        label="মুছুন"
                        tone="danger"
                        onClick={() =>
                          update({ navigation: config.navigation.filter((_, i) => i !== index) })
                        }
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </IconButton>
                    </div>
                  </div>
                ))}
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    update({ navigation: [...config.navigation, { label: "নতুন লিংক", href: "/" }] })
                  }
                >
                  <Plus className="h-3.5 w-3.5" /> লিংক যোগ করুন
                </Button>
              </div>
            </Panel>
          ) : null}

          {/* ═════════ FOOTER ═════════ */}
          {tab === "footer" ? (
            <Panel title="ফুটার" description="দোকানের নিচের অংশ — পরিচিতি, লিংক কলাম ও কপিরাইট।">
              <Field label="দোকান পরিচিতি" hint="ফুটারের বাঁ দিকে দেখানো হবে">
                <Textarea
                  value={config.footer.about}
                  onChange={(event) => update({ footer: { ...config.footer, about: event.target.value } })}
                  rows={3}
                  placeholder="আপনার দোকান সম্পর্কে ২–৩ লাইন"
                />
              </Field>
              <Field label="কপিরাইট নোট" hint="খালি রাখলে স্বয়ংক্রিয় © লেখা দেখাবে">
                <Input
                  value={config.footer.note}
                  onChange={(event) => update({ footer: { ...config.footer, note: event.target.value } })}
                  placeholder="© আপনার দোকান। সর্বস্বত্ব সংরক্ষিত।"
                />
              </Field>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-[11px] font-medium text-ink-700">লিংক কলাম</p>
                  <span className="text-[10px] text-ink-500">{config.footer.columns.length}টি কলাম</span>
                </div>

                {config.footer.columns.map((column, columnIndex) => (
                  <div key={`${column.title}-${columnIndex}`} className="rounded-xl border border-ink-200 p-3">
                    <div className="flex items-center gap-1.5">
                      <Input
                        value={column.title}
                        onChange={(event) => {
                          const columns = [...config.footer.columns];
                          columns[columnIndex] = { ...column, title: event.target.value };
                          update({ footer: { ...config.footer, columns } });
                        }}
                        placeholder="কলামের নাম (যেমন: গ্রাহক সেবা)"
                        className="text-[11.5px] font-semibold"
                        aria-label={`কলাম ${columnIndex + 1} নাম`}
                      />
                      <IconButton
                        label="কলাম উপরে সরান"
                        disabled={columnIndex === 0}
                        onClick={() => {
                          const columns = [...config.footer.columns];
                          [columns[columnIndex], columns[columnIndex - 1]] = [
                            columns[columnIndex - 1],
                            columns[columnIndex],
                          ];
                          update({ footer: { ...config.footer, columns } });
                        }}
                      >
                        <ChevronUp className="h-3.5 w-3.5" />
                      </IconButton>
                      <IconButton
                        label="কলাম মুছুন"
                        tone="danger"
                        onClick={() =>
                          update({
                            footer: {
                              ...config.footer,
                              columns: config.footer.columns.filter((_, i) => i !== columnIndex),
                            },
                          })
                        }
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </IconButton>
                    </div>

                    <div className="mt-2 space-y-1.5">
                      {column.links.map((link, linkIndex) => (
                        <div key={`${link.href}-${linkIndex}`} className="flex items-center gap-1.5">
                          <Input
                            value={link.label}
                            onChange={(event) => {
                              const columns = [...config.footer.columns];
                              const links = [...column.links];
                              links[linkIndex] = { ...link, label: event.target.value };
                              columns[columnIndex] = { ...column, links };
                              update({ footer: { ...config.footer, columns } });
                            }}
                            placeholder="লেবেল"
                            className="text-[11.5px]"
                            aria-label={`${column.title} লিংক ${linkIndex + 1} লেবেল`}
                          />
                          <Input
                            value={link.href}
                            onChange={(event) => {
                              const columns = [...config.footer.columns];
                              const links = [...column.links];
                              links[linkIndex] = { ...link, href: event.target.value };
                              columns[columnIndex] = { ...column, links };
                              update({ footer: { ...config.footer, columns } });
                            }}
                            placeholder="/page/contact"
                            className="font-mono text-[11px]"
                            aria-label={`${column.title} লিংক ${linkIndex + 1} ঠিকানা`}
                          />
                          <IconButton
                            label="লিংক মুছুন"
                            tone="danger"
                            onClick={() => {
                              const columns = [...config.footer.columns];
                              columns[columnIndex] = {
                                ...column,
                                links: column.links.filter((_, i) => i !== linkIndex),
                              };
                              update({ footer: { ...config.footer, columns } });
                            }}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </IconButton>
                        </div>
                      ))}
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          const columns = [...config.footer.columns];
                          columns[columnIndex] = {
                            ...column,
                            links: [...column.links, { label: "নতুন লিংক", href: "/" }],
                          };
                          update({ footer: { ...config.footer, columns } });
                        }}
                      >
                        <Plus className="h-3.5 w-3.5" /> লিংক
                      </Button>
                    </div>
                  </div>
                ))}

                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    update({
                      footer: {
                        ...config.footer,
                        columns: [
                          ...config.footer.columns,
                          { title: "নতুন কলাম", links: [{ label: "নতুন লিংক", href: "/" }] },
                        ],
                      },
                    })
                  }
                >
                  <Plus className="h-3.5 w-3.5" /> কলাম যোগ করুন
                </Button>
              </div>
            </Panel>
          ) : null}

          {/* ═════════ REVIEWS ═════════ */}
          {tab === "reviews" ? (
            <Panel
              title="ক্রেতার রিভিউ"
              description="স্টোরফ্রন্টে প্রথম ৩টি রিভিউ দেখানো হয়। যাচাই করা রিভিউ যোগ করলে ক্রেতার আস্থা বাড়ে।"
              action={
                <Toggle
                  checked={enabled("Testimonials")}
                  onChange={() => setSectionEnabled("Testimonials", !enabled("Testimonials"))}
                  label="রিভিউ দেখান"
                />
              }
            >
              <Field label="সেকশনের শিরোনাম" hint="খালি রাখলে থিমের ডিফল্ট শিরোনাম দেখাবে">
                <Input
                  value={sectionTitle("Testimonials")}
                  onChange={(event) => setSectionTitle("Testimonials", event.target.value)}
                  placeholder="আমাদের ক্রেতারা যা বলছেন"
                />
              </Field>

              <div className="space-y-2.5">
                {config.testimonials.items.map((item, index) => (
                  <div key={`${item.name}-${index}`} className="rounded-xl border border-ink-200 p-3">
                    <div className="flex items-center gap-1.5">
                      <span className="grid h-6 w-6 shrink-0 place-items-center rounded-md bg-ink-100 text-[10px] font-semibold text-ink-600 tabular-nums">
                        {index + 1}
                      </span>
                      <Input
                        value={item.name}
                        onChange={(event) => {
                          const items = [...config.testimonials.items];
                          items[index] = { ...item, name: event.target.value };
                          update({ testimonials: { ...config.testimonials, items } });
                        }}
                        placeholder="ক্রেতার নাম"
                        className="text-[11.5px] font-semibold"
                        aria-label={`রিভিউ ${index + 1} নাম`}
                      />
                      <Input
                        value={item.location}
                        onChange={(event) => {
                          const items = [...config.testimonials.items];
                          items[index] = { ...item, location: event.target.value };
                          update({ testimonials: { ...config.testimonials, items } });
                        }}
                        placeholder="এলাকা (ঐচ্ছিক)"
                        className="text-[11px]"
                        aria-label={`রিভিউ ${index + 1} এলাকা`}
                      />
                      <IconButton
                        label="উপরে সরান"
                        disabled={index === 0}
                        onClick={() => {
                          const items = [...config.testimonials.items];
                          [items[index], items[index - 1]] = [items[index - 1], items[index]];
                          update({ testimonials: { ...config.testimonials, items } });
                        }}
                      >
                        <ChevronUp className="h-3.5 w-3.5" />
                      </IconButton>
                      <IconButton
                        label="মুছুন"
                        tone="danger"
                        onClick={() =>
                          update({
                            testimonials: {
                              ...config.testimonials,
                              items: config.testimonials.items.filter((_, i) => i !== index),
                            },
                          })
                        }
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </IconButton>
                    </div>
                    <Textarea
                      value={item.quote}
                      onChange={(event) => {
                        const items = [...config.testimonials.items];
                        items[index] = { ...item, quote: event.target.value };
                        update({ testimonials: { ...config.testimonials, items } });
                      }}
                      rows={2}
                      placeholder="ক্রেতা কী বলেছেন…"
                      className="mt-1.5 min-h-16 text-[11.5px]"
                      aria-label={`রিভিউ ${index + 1} বক্তব্য`}
                    />
                  </div>
                ))}
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    update({
                      testimonials: {
                        ...config.testimonials,
                        items: [
                          ...config.testimonials.items,
                          { name: "নতুন ক্রেতা", quote: "খুব ভালো সেবা পেয়েছি।", location: "" },
                        ],
                      },
                    })
                  }
                >
                  <Plus className="h-3.5 w-3.5" /> রিভিউ যোগ করুন
                </Button>
              </div>
            </Panel>
          ) : null}
        </div>

        {/* ═════════ SIDEBAR ═════════ */}
        <aside className="hidden h-fit space-y-3 xl:sticky xl:top-36 xl:block">
          <Card>
            <CardHeader title="লাইভ প্রিভিউ" description="টাইপ করার সাথে সাথে দেখুন" />
            <CardBody className="space-y-3">
              <div className="mx-auto max-w-[300px]">
                <ThemePreview
                  config={config}
                  themeCode={themeCode}
                  storeName={storeName}
                  device="mobile"
                />
              </div>
              <Button type="button" variant="outline" className="w-full" onClick={() => setPreviewOpen(true)}>
                <Eye className="h-4 w-4" /> বড় প্রিভিউ
              </Button>
              <Link
                href="/design-preview"
                target="_blank"
                className="flex items-center justify-center gap-1.5 text-[11px] font-medium text-brand-700 hover:underline"
              >
                <ArrowUpRight className="h-3.5 w-3.5" />
                সেভ করা ড্রাফট আসল থিমে দেখুন
              </Link>
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="প্রকাশ" description="Draft সংরক্ষণ ও live করা" />
            <CardBody className="space-y-2">
              <form action={resetSubmit}>
                <input type="hidden" name="storeId" value={storeId} />
                <input type="hidden" name="themeVersionId" value={themeVersionId} />
                <Button
                  type="submit"
                  variant="outline"
                  className="w-full"
                  disabled={resetPending}
                  onClick={(event) => {
                    if (!window.confirm("ড্রাফট পরিবর্তন মুছে থিমের ডিফল্টে ফিরে যাবেন?")) {
                      event.preventDefault();
                    }
                  }}
                >
                  <RotateCcw className="h-4 w-4" />
                  {resetPending ? "রিসেট হচ্ছে…" : "ডিফল্টে রিসেট"}
                </Button>
              </form>
              <p className="text-[10px] leading-4 text-ink-500">
                রিসেট করলে শুধু draft বদলাবে — live দোকানে কিছুই যাবে না, যতক্ষণ না Publish করছেন।
              </p>
            </CardBody>
          </Card>
        </aside>
      </div>

      {/* ── Full-screen preview ─────────────────────────────── */}
      {previewOpen ? (
        <div className="fixed inset-0 z-50 flex flex-col bg-ink-950/70 backdrop-blur-sm">
          <div className="flex items-center gap-2 border-b border-ink-200 bg-white px-3 py-2">
            <p className="text-[12px] font-semibold text-ink-900">লাইভ প্রিভিউ</p>
            <span className="hidden text-[10.5px] text-ink-500 sm:inline">
              অসংরক্ষিত পরিবর্তনসহ
            </span>
            <div className="ml-auto flex items-center gap-1">
              <button
                type="button"
                onClick={() => setDevice("mobile")}
                aria-pressed={device === "mobile"}
                className={`grid h-8 w-8 place-items-center rounded-lg ${
                  device === "mobile" ? "bg-brand-50 text-brand-700" : "text-ink-500 hover:bg-ink-100"
                }`}
                aria-label="মোবাইল প্রিভিউ"
              >
                <Smartphone className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => setDevice("desktop")}
                aria-pressed={device === "desktop"}
                className={`grid h-8 w-8 place-items-center rounded-lg ${
                  device === "desktop" ? "bg-brand-50 text-brand-700" : "text-ink-500 hover:bg-ink-100"
                }`}
                aria-label="ডেস্কটপ প্রিভিউ"
              >
                <Monitor className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => setPreviewOpen(false)}
                className="ml-1 grid h-8 w-8 place-items-center rounded-lg text-ink-500 hover:bg-ink-100"
                aria-label="প্রিভিউ বন্ধ করুন"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-3 sm:p-6">
            <div
              className={
                device === "mobile" ? "mx-auto w-full max-w-[390px]" : "mx-auto w-full max-w-5xl"
              }
            >
              <ThemePreview
                config={config}
                themeCode={themeCode}
                storeName={storeName}
                device={device}
              />
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────
 * Layout helpers
 * ────────────────────────────────────────────────────────────── */

function Panel({
  title,
  description,
  action,
  children,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader title={title} description={description} action={action} />
      <CardBody className="space-y-4">{children}</CardBody>
    </Card>
  );
}

function FixedSectionRow({ sectionKey }: { sectionKey: string }) {
  const meta = SECTION_META[sectionKey];
  const Icon = meta.icon;
  return (
    <div className="flex items-center gap-2 rounded-xl border border-dashed border-ink-200 bg-ink-50/60 px-3 py-2.5">
      <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-ink-100 text-ink-600">
        <Icon className="h-3.5 w-3.5" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[12.5px] font-semibold text-ink-700">{meta.label}</p>
        <p className="truncate text-[10px] text-ink-500">{meta.hint}</p>
      </div>
      <span className="rounded-full bg-ink-100 px-2 py-0.5 text-[9.5px] font-semibold text-ink-500">
        সবসময় দেখানো
      </span>
    </div>
  );
}

function Segmented<T extends string>({
  value,
  options,
  onChange,
  columns,
}: {
  value: T;
  options: Array<{ value: T; label: string; hint?: string }>;
  onChange: (value: T) => void;
  columns?: 2 | 3;
}) {
  return (
    <div className={`grid gap-2 ${columns === 2 ? "sm:grid-cols-2" : "sm:grid-cols-3"}`}>
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(option.value)}
            className={`rounded-xl border px-3 py-2 text-left transition ${
              active
                ? "border-brand-400 bg-brand-50 shadow-[0_0_0_2px_var(--color-brand-100)]"
                : "border-ink-200 bg-white hover:border-ink-300 hover:bg-ink-50"
            }`}
          >
            <span
              className={`block text-[11.5px] font-semibold ${active ? "text-brand-800" : "text-ink-800"}`}
            >
              {option.label}
            </span>
            {option.hint ? (
              <span className="mt-0.5 block text-[9.5px] text-ink-500">{option.hint}</span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

function IconButton({
  children,
  label,
  onClick,
  disabled,
  tone = "neutral",
}: {
  children: React.ReactNode;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  tone?: "neutral" | "danger";
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className={`grid h-7 w-7 shrink-0 place-items-center rounded-md transition disabled:pointer-events-none disabled:opacity-30 ${
        tone === "danger"
          ? "text-ink-400 hover:bg-red-50 hover:text-red-600"
          : "text-ink-400 hover:bg-ink-100 hover:text-ink-700"
      }`}
    >
      {children}
    </button>
  );
}

function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: () => void;
  label?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={onChange}
      className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full transition-colors ${
        checked ? "bg-brand-600" : "bg-ink-300"
      }`}
    >
      <span
        className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
          checked ? "translate-x-4" : "translate-x-0.5"
        }`}
      />
    </button>
  );
}

function ToggleRow({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string;
  hint?: string;
  checked: boolean;
  onChange: () => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-ink-200 bg-white px-3 py-2.5">
      <div className="min-w-0">
        <p className="text-[12px] font-medium text-ink-900">{label}</p>
        {hint ? <p className="text-[10.5px] text-ink-500">{hint}</p> : null}
      </div>
      <Toggle checked={checked} onChange={onChange} label={label} />
    </div>
  );
}
