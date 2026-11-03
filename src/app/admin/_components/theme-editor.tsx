"use client";

import { useActionState, useMemo, useState } from "react";
import {
  Check,
  ChevronDown,
  Lock,
  Monitor,
  MousePointerClick,
  RefreshCw,
  Smartphone,
  Sparkles,
  Tablet,
  UploadCloud,
} from "lucide-react";
import {
  publishThemeAction,
  resetThemeDraftAction,
  saveThemeDraftAction,
  selectThemeAction,
} from "@/app/admin/actions";
import { EMPTY_ADMIN_STATE } from "@/app/admin/state";
import type { StorefrontCategory, StorefrontProduct } from "@/themes/types";
import { ThemePreview } from "./theme-preview";

/**
 * Theme customizer (FR-06) — "Luminous Commerce & Customizer".
 *
 * A two-column studio: on the left a theme library rail plus an accordion
 * inspector that edits the *draft* config; on the right a live preview canvas
 * with device viewports. Every change reflects in the preview immediately;
 * `publish` promotes the draft to the live storefront. Nested collections
 * (sections, testimonials, footer columns, navigation) are edited as JSON so
 * the schema stays authoritative.
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
  promo: {
    enabled: boolean;
    title: string;
    body: string;
    ctaLabel: string;
    ctaHref: string;
  };
  testimonials: {
    enabled: boolean;
    items: Array<{ name: string; quote: string; location: string }>;
  };
  trust: { enabled: boolean; items: string[] };
  footer: {
    about: string;
    columns: Array<{
      title: string;
      links: Array<{ label: string; href: string }>;
    }>;
    note: string;
  };
  navigation: Array<{ label: string; href: string }>;
  sections: Array<{ key: string; enabled: boolean; title: string }>;
};

const SECTION_LABELS: Record<string, string> = {
  Header: "হেডার",
  Hero: "হিরো",
  CategoryGrid: "ক্যাটাগরি গ্রিড",
  ProductGrid: "প্রোডাক্ট গ্রিড",
  PromoBanner: "প্রোমো ব্যানার",
  Testimonials: "রিভিউ",
  TrustBar: "ট্রাস্ট বার",
  Footer: "ফুটার",
};

type ThemeOption = {
  code: string;
  name: string;
  style: string;
  gradient: string;
  swatches: string[];
  allowed: boolean;
  selected: boolean;
};

// ── Design-system primitives (Luminous Commerce palette) ──────────────────────

const input =
  "h-10 w-full rounded-xl border border-ink-200 bg-ink-50/70 px-3 text-sm text-ink-900 outline-none transition placeholder:text-ink-400 hover:border-ink-300 focus:border-emerald-600 focus:bg-white focus:ring-[0_0_0_1px_#059669]";

const textArea =
  "w-full resize-y rounded-xl border border-ink-200 bg-ink-50/70 px-3 py-2 text-sm text-ink-900 outline-none transition placeholder:text-ink-400 hover:border-ink-300 focus:border-emerald-600 focus:bg-white focus:ring-[0_0_0_1px_#059669]";

const jsonArea =
  "w-full resize-y rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 font-mono text-xs leading-relaxed text-slate-100 outline-none transition focus:border-emerald-600";

function StudioLabel({
  children,
  hint,
}: {
  children: React.ReactNode;
  hint?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 flex items-center justify-between gap-2 text-[11px] font-semibold text-ink-500">
        {children}
        {hint ? (
          <span className="text-[11px] font-normal text-ink-400">{hint}</span>
        ) : null}
      </span>
    </label>
  );
}

function Switch({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="group flex w-full items-center justify-between gap-3 py-1 text-left"
    >
      <span className="text-sm text-ink-700">{label}</span>
      <span
        className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors duration-150 ${
          checked ? "bg-emerald-600" : "bg-ink-300"
        }`}
      >
        <span
          className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform duration-150 ease-out ${
            checked ? "translate-x-[18px]" : "translate-x-[2px]"
          }`}
        />
      </span>
    </button>
  );
}

function Segmented<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (value: T) => void;
  options: Array<{ value: T; label: string }>;
}) {
  return (
    <div className="inline-flex w-full rounded-md bg-ink-100 p-0.5">
      {options.map(option => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            className={`flex-1 rounded-[5px] px-2 py-1.5 text-xs font-medium transition ${
              active
                ? "bg-white text-ink-900 shadow-[0_1px_2px_rgba(15,23,42,0.06)] ring-1 ring-black/5"
                : "text-ink-500 hover:text-ink-800"
            }`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

function ColorField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div>
      <StudioLabel>{label}</StudioLabel>
      <div className="flex items-center gap-2">
        <label className="relative h-9 w-9 shrink-0 cursor-pointer overflow-hidden rounded-md border border-ink-200 shadow-inner">
          <input
            type="color"
            value={value}
            onChange={event => onChange(event.target.value)}
            className="absolute -inset-2 h-12 w-12 cursor-pointer border-0 p-0"
          />
        </label>
        <input
          value={value}
          onChange={event => onChange(event.target.value)}
          spellCheck={false}
          className={`${input} font-mono text-xs uppercase`}
        />
      </div>
    </div>
  );
}

function Accordion({
  title,
  icon,
  defaultOpen = false,
  children,
}: {
  title: string;
  icon?: React.ReactNode;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="overflow-hidden rounded-xl border border-ink-200 bg-white">
      <button
        type="button"
        onClick={() => setOpen(value => !value)}
        className="flex w-full items-center gap-2.5 bg-white px-4 py-3 text-left transition hover:bg-ink-50"
      >
        <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-ink-100 text-ink-600">
          {icon}
        </span>
        <span className="flex-1 text-[13px] font-bold tracking-[-0.01em] text-ink-900">
          {title}
        </span>
        <ChevronDown
          className={`h-4 w-4 text-ink-400 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
        />
      </button>
      {open ? (
        <div className="space-y-4 border-t border-ink-100 px-4 py-4">
          {children}
        </div>
      ) : null}
    </div>
  );
}

// ── Theme library card ────────────────────────────────────────────────────────

function ThemeCard({
  option,
  storeId,
  current,
  pending,
  switchLocked,
  action,
}: {
  option: ThemeOption;
  storeId: string;
  current: boolean;
  pending: boolean;
  /** Plan policy: the current selection cannot be replaced from this screen. */
  switchLocked: boolean;
  action: (formData: FormData) => void;
}) {
  const locked = switchLocked && !current;
  const disabled = !option.allowed || current || pending || locked;
  return (
    <form action={action} className="min-w-0">
      <input type="hidden" name="storeId" value={storeId} />
      <input type="hidden" name="themeCode" value={option.code} />
      <button
        type="submit"
        disabled={disabled}
        className={`flex h-full w-full flex-col overflow-hidden rounded-lg border text-left transition ${
          current
            ? "border-emerald-500 bg-emerald-50/40 ring-1 ring-emerald-500/20"
            : option.allowed && !locked
              ? "border-ink-200 bg-white hover:border-ink-400 hover:bg-ink-50"
              : "cursor-not-allowed border-ink-200 bg-white opacity-55 hover:border-ink-200 hover:bg-white"
        }`}
      >
        <span
          className={`relative block h-16 w-full shrink-0 bg-gradient-to-br ${option.gradient}`}
        >
          <span className="absolute inset-x-2 bottom-1.5 flex items-center gap-1">
            {option.swatches.map(swatch => (
              <span
                key={swatch}
                className="h-3.5 w-3.5 rounded-full border border-white/70 shadow-sm"
                style={{ background: swatch }}
              />
            ))}
          </span>
          {current ? (
            <span className="absolute top-1.5 right-1.5 inline-flex items-center gap-0.5 rounded-full bg-white/95 px-1.5 py-0.5 text-[10.5px] font-semibold text-emerald-700 shadow-sm">
              <Check className="h-2.5 w-2.5" /> বর্তমান
            </span>
          ) : locked && option.allowed ? (
            <span className="absolute top-1.5 right-1.5 inline-flex items-center gap-0.5 rounded-full bg-slate-900/80 px-1.5 py-0.5 text-[10.5px] font-semibold text-white shadow-sm">
              <Lock className="h-2.5 w-2.5" /> লক
            </span>
          ) : null}
        </span>
        <span className="block min-w-0 px-3 py-2.5">
          <span className="block truncate text-[13px] leading-tight font-semibold text-ink-900">
            {option.name}
          </span>
          <span className="mt-0.5 block truncate text-[11.5px] leading-snug text-ink-500">
            {option.style}
            {!option.allowed ? " · upgrade" : ""}
          </span>
        </span>
      </button>
    </form>
  );
}

// ── The studio ────────────────────────────────────────────────────────────────

export function ThemeEditor({
  storeId,
  storeName,
  storeSlug,
  themeVersionId,
  themeCode,
  draft,
  isPublished,
  canSwitch,
  switchBlockedReason,
  options,
  products,
  categories,
}: {
  storeId: string;
  storeName: string;
  storeSlug: string;
  themeVersionId: string;
  themeCode: string;
  draft: EditableThemeConfig;
  isPublished: boolean;
  canSwitch: boolean;
  switchBlockedReason: string | null;
  options: ThemeOption[];
  products: StorefrontProduct[];
  categories: StorefrontCategory[];
}) {
  const [saveState, saveSubmit, savePending] = useActionState(
    saveThemeDraftAction,
    EMPTY_ADMIN_STATE
  );
  const [publishState, publishSubmit, publishPending] = useActionState(
    publishThemeAction,
    EMPTY_ADMIN_STATE
  );
  const [selectState, selectSubmit, selectPending] = useActionState(
    selectThemeAction,
    EMPTY_ADMIN_STATE
  );
  const [resetState, resetSubmit, resetPending] = useActionState(
    resetThemeDraftAction,
    EMPTY_ADMIN_STATE
  );

  const [config, setConfig] = useState<EditableThemeConfig>(draft);
  const [navigationJson, setNavigationJson] = useState(
    JSON.stringify(draft.navigation, null, 2)
  );
  const [testimonialsJson, setTestimonialsJson] = useState(
    JSON.stringify(draft.testimonials.items, null, 2)
  );
  const [footerColumnsJson, setFooterColumnsJson] = useState(
    JSON.stringify(draft.footer.columns, null, 2)
  );
  const [sectionsJson, setSectionsJson] = useState(
    JSON.stringify(draft.sections, null, 2)
  );
  const [device, setDevice] = useState<"desktop" | "tablet" | "mobile">(
    "desktop"
  );

  // Selecting another theme re-renders this component with a new draft while
  // React keeps the local editor state. Reset it (derive state from props) so
  // the cards and the colour/hero fields move to the new theme together.
  const identity = `${themeVersionId}:${themeCode}`;
  const [loadedIdentity, setLoadedIdentity] = useState(identity);
  if (identity !== loadedIdentity) {
    setLoadedIdentity(identity);
    setConfig(draft);
    setNavigationJson(JSON.stringify(draft.navigation, null, 2));
    setTestimonialsJson(JSON.stringify(draft.testimonials.items, null, 2));
    setFooterColumnsJson(JSON.stringify(draft.footer.columns, null, 2));
    setSectionsJson(JSON.stringify(draft.sections, null, 2));
  }

  const configJson = useMemo(() => {
    try {
      return {
        value: JSON.stringify({
          ...config,
          navigation: JSON.parse(navigationJson),
          testimonials: {
            ...config.testimonials,
            items: JSON.parse(testimonialsJson),
          },
          footer: { ...config.footer, columns: JSON.parse(footerColumnsJson) },
          sections: JSON.parse(sectionsJson),
        }),
        error: null as string | null,
      };
    } catch {
      return {
        value: "",
        error: "JSON ফরম্যাট ঠিক নেই — কমা ও ব্র্যাকেট যাচাই করুন।",
      };
    }
  }, [
    config,
    navigationJson,
    testimonialsJson,
    footerColumnsJson,
    sectionsJson,
  ]);

  const messages = [saveState, publishState, selectState, resetState].filter(
    state => state.message
  );

  const previewWidth =
    device === "tablet"
      ? "w-full max-w-[768px]"
      : device === "mobile"
        ? "w-full max-w-[390px]"
        : "w-full";

  return (
    <div className="design-studio min-w-0 bg-ink-50/40 font-sans pb-8">
      {/* ── Page header ──────────────────────────────────────────────────── */}
      <header className="mb-6 flex min-w-0 flex-wrap items-center justify-between gap-4 rounded-xl border border-ink-200 bg-white px-4 py-3.5 sm:px-5">
        <div className="min-w-0">
          <div className="mb-2 flex items-center gap-2 text-[11px] font-semibold text-ink-400">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            দোকান কাস্টমাইজার
          </div>
          <div className="flex flex-wrap items-center gap-2.5">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-slate-900 text-white">
              <Sparkles className="h-4 w-4" />
            </span>
            <h1 className="font-display text-xl font-bold text-ink-900 sm:text-2xl">
              থিম কাস্টমাইজার
            </h1>
            <span
              className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold ${
                isPublished
                  ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                  : "border-ink-200 bg-ink-100 text-ink-600"
              }`}
            >
              <span
                className={`h-1.5 w-1.5 rounded-full ${isPublished ? "bg-emerald-500" : "bg-ink-400"}`}
              />
              {isPublished ? "Live" : "Draft"}
            </span>
          </div>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-ink-500">
            লাইভ প্রিভিউতে পরিবর্তন দেখুন — save করলে draft-এ থাকবে, publish
            করলে দোকানে যাবে।
          </p>
        </div>

        <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
          <button
            type="submit"
            form="theme-draft-form"
            disabled={savePending || Boolean(configJson.error)}
            className="inline-flex h-10 flex-1 items-center justify-center gap-1.5 rounded-lg border border-emerald-700 bg-emerald-600 px-3.5 text-sm font-semibold text-white transition hover:bg-emerald-700 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60 sm:flex-none"
          >
            <UploadCloud className="h-4 w-4" />
            {savePending ? "সংরক্ষণ হচ্ছে…" : "ড্রাফট সংরক্ষণ"}
          </button>

          <form action={publishSubmit}>
            <input type="hidden" name="storeId" value={storeId} />
            <input type="hidden" name="themeVersionId" value={themeVersionId} />
            <button
              type="submit"
              disabled={publishPending}
              className="inline-flex h-10 items-center justify-center gap-1.5 rounded-lg border border-transparent bg-slate-900 px-3.5 text-sm font-semibold text-white transition hover:bg-slate-800 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {publishPending ? "Publish হচ্ছে…" : "Publish"}
            </button>
          </form>

          <form
            action={resetSubmit}
            onSubmit={event => {
              if (
                !window.confirm(
                  "ড্রাফট পরিবর্তন মুছে থিমের ডিফল্টে ফিরে যাবেন?"
                )
              )
                event.preventDefault();
            }}
          >
            <input type="hidden" name="storeId" value={storeId} />
            <input type="hidden" name="themeVersionId" value={themeVersionId} />
            <button
              type="submit"
              disabled={resetPending}
              title="ড্রাফট রিসেট"
              aria-label="ড্রাফট রিসেট"
              className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-ink-200 bg-white text-ink-700 transition hover:bg-ink-50 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
            >
              <RefreshCw className="h-4 w-4" />
            </button>
          </form>
        </div>
      </header>

      {messages.length ? (
        <div className="mb-4 space-y-2">
          {messages.map((state, index) => (
            <div
              key={index}
              className={`rounded-lg border px-4 py-3 text-sm ${
                state.ok
                  ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                  : "border-rose-200 bg-rose-50 text-rose-700"
              }`}
            >
              {state.message}
            </div>
          ))}
        </div>
      ) : null}

      {configJson.error ? (
        <div className="mb-4 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {configJson.error}
        </div>
      ) : null}

      {/* ── Workspace: inspector (left) + preview (right) ────────────────── */}
      <div className="grid min-w-0 items-start gap-6 xl:grid-cols-[minmax(340px,400px)_minmax(0,1fr)]">
        {/* Left — theme library and draft inspector */}
        <aside className="min-w-0">
          <div className="overflow-hidden rounded-xl border border-ink-200 bg-white">
            <div className="flex items-start justify-between gap-3 border-b border-ink-200 bg-gradient-to-br from-ink-50 to-ink-50/80 px-4 py-4">
              <div className="min-w-0">
                <h2 className="font-display text-[15px] font-bold text-ink-900">
                  কাস্টমাইজ
                </h2>
                <p className="mt-1 text-[11px] leading-5 text-ink-500">
                  ড্রাফট কনফিগারেশন — পরিবর্তন সাথে সাথে প্রিভিউতে দেখুন
                </p>
              </div>
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100">
                <Sparkles className="h-4 w-4" />
              </span>
            </div>

            <div className="border-b border-ink-200 p-3">
              <div className="mb-2.5 flex items-center justify-between gap-2">
                <div>
                  <h3 className="text-[13px] font-bold tracking-[-0.01em] text-ink-900">
                    থিম লাইব্রেরি
                  </h3>
                  <p className="mt-0.5 text-[11px] text-ink-500">
                    একটি mood বেছে নিন
                  </p>
                </div>
                <span className="rounded-full bg-ink-100 px-2 py-1 text-[11px] font-semibold text-ink-500">
                  {options.length}টি
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {options.map(option => (
                  <ThemeCard
                    key={option.code}
                    option={option}
                    storeId={storeId}
                    current={option.code === themeCode}
                    pending={selectPending}
                    switchLocked={isPublished && !canSwitch}
                    action={selectSubmit}
                  />
                ))}
              </div>
              {isPublished && !canSwitch ? (
                <p className="mt-2.5 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] leading-relaxed text-amber-800">
                  {switchBlockedReason}
                </p>
              ) : (
                <p className="mt-2.5 text-[11px] leading-relaxed text-ink-500">
                  {isPublished
                    ? "নতুন থিম বাছলে সেটি draft-এ যাবে — publish করলে live হবে।"
                    : "এখনো publish করা হয়নি — থিম বদলানো যাবে।"}
                </p>
              )}
            </div>

            <form
              id="theme-draft-form"
              action={saveSubmit}
              className="space-y-3 bg-ink-50/45 p-3 sm:p-4"
            >
              <input type="hidden" name="storeId" value={storeId} />
              <input
                type="hidden"
                name="themeVersionId"
                value={themeVersionId}
              />
              <input type="hidden" name="config" value={configJson.value} />

              <Accordion
                title="রঙ"
                icon={<Sparkles className="h-3.5 w-3.5" />}
                defaultOpen
              >
                <div className="grid grid-cols-2 gap-3">
                  <ColorField
                    label="প্রাইমারি"
                    value={config.colors.primary}
                    onChange={value =>
                      setConfig(c => ({
                        ...c,
                        colors: { ...c.colors, primary: value },
                      }))
                    }
                  />
                  <ColorField
                    label="অ্যাকসেন্ট"
                    value={config.colors.accent}
                    onChange={value =>
                      setConfig(c => ({
                        ...c,
                        colors: { ...c.colors, accent: value },
                      }))
                    }
                  />
                  <ColorField
                    label="ব্যাকগ্রাউন্ড"
                    value={config.colors.background}
                    onChange={value =>
                      setConfig(c => ({
                        ...c,
                        colors: { ...c.colors, background: value },
                      }))
                    }
                  />
                  <ColorField
                    label="সারফেস"
                    value={config.colors.surface}
                    onChange={value =>
                      setConfig(c => ({
                        ...c,
                        colors: { ...c.colors, surface: value },
                      }))
                    }
                  />
                  <ColorField
                    label="টেক্সট"
                    value={config.colors.text}
                    onChange={value =>
                      setConfig(c => ({
                        ...c,
                        colors: { ...c.colors, text: value },
                      }))
                    }
                  />
                  <ColorField
                    label="মিউটেড"
                    value={config.colors.muted}
                    onChange={value =>
                      setConfig(c => ({
                        ...c,
                        colors: { ...c.colors, muted: value },
                      }))
                    }
                  />
                </div>
              </Accordion>

              <Accordion title="টাইপোগ্রাফি ও বাটন">
                <div className="space-y-4">
                  <div>
                    <StudioLabel>হেডিং ফন্ট</StudioLabel>
                    <Segmented
                      value={config.typography.headingFont}
                      onChange={value =>
                        setConfig(c => ({
                          ...c,
                          typography: { ...c.typography, headingFont: value },
                        }))
                      }
                      options={[
                        { value: "serif", label: "Serif" },
                        { value: "sans", label: "Sans" },
                      ]}
                    />
                  </div>
                  <div>
                    <StudioLabel>বডি ফন্ট</StudioLabel>
                    <Segmented
                      value={config.typography.bodyFont}
                      onChange={value =>
                        setConfig(c => ({
                          ...c,
                          typography: { ...c.typography, bodyFont: value },
                        }))
                      }
                      options={[
                        { value: "sans", label: "Sans" },
                        { value: "serif", label: "Serif" },
                      ]}
                    />
                  </div>
                  <div>
                    <StudioLabel>বাটন স্টাইল</StudioLabel>
                    <Segmented
                      value={config.buttons.style}
                      onChange={value =>
                        setConfig(c => ({ ...c, buttons: { style: value } }))
                      }
                      options={[
                        { value: "rounded", label: "Rounded" },
                        { value: "pill", label: "Pill" },
                        { value: "square", label: "Square" },
                      ]}
                    />
                  </div>
                  <div>
                    <StudioLabel>স্কেল</StudioLabel>
                    <Segmented
                      value={config.typography.scale}
                      onChange={value =>
                        setConfig(c => ({
                          ...c,
                          typography: { ...c.typography, scale: value },
                        }))
                      }
                      options={[
                        { value: "comfortable", label: "Comfortable" },
                        { value: "compact", label: "Compact" },
                      ]}
                    />
                  </div>
                </div>
              </Accordion>

              <Accordion title="হেডার">
                <div className="space-y-4">
                  <div>
                    <StudioLabel>স্টাইল</StudioLabel>
                    <Segmented
                      value={config.header.style}
                      onChange={value =>
                        setConfig(c => ({
                          ...c,
                          header: { ...c.header, style: value },
                        }))
                      }
                      options={[
                        { value: "classic", label: "Classic" },
                        { value: "centered", label: "Centered" },
                        { value: "minimal", label: "Minimal" },
                      ]}
                    />
                  </div>
                  <div>
                    <StudioLabel hint="খালি রাখলে দেখাবে না">
                      ঘোষণা টেক্সট
                    </StudioLabel>
                    <input
                      className={input}
                      value={config.header.announcement}
                      onChange={event =>
                        setConfig(c => ({
                          ...c,
                          header: {
                            ...c.header,
                            announcement: event.target.value,
                          },
                        }))
                      }
                    />
                  </div>
                  <div className="divide-y divide-ink-100 rounded-lg border border-ink-200 bg-white px-3.5">
                    <Switch
                      checked={config.header.showSearch}
                      onChange={value =>
                        setConfig(c => ({
                          ...c,
                          header: { ...c.header, showSearch: value },
                        }))
                      }
                      label="সার্চ দেখান"
                    />
                    <Switch
                      checked={config.header.sticky}
                      onChange={value =>
                        setConfig(c => ({
                          ...c,
                          header: { ...c.header, sticky: value },
                        }))
                      }
                      label="Sticky হেডার"
                    />
                  </div>
                </div>
              </Accordion>

              <Accordion title="হিরো">
                <div className="space-y-4">
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div>
                      <StudioLabel>শিরোনাম</StudioLabel>
                      <input
                        className={input}
                        value={config.hero.title}
                        onChange={event =>
                          setConfig(c => ({
                            ...c,
                            hero: { ...c.hero, title: event.target.value },
                          }))
                        }
                      />
                    </div>
                    <div>
                      <StudioLabel>সাবটাইটেল</StudioLabel>
                      <input
                        className={input}
                        value={config.hero.subtitle}
                        onChange={event =>
                          setConfig(c => ({
                            ...c,
                            hero: { ...c.hero, subtitle: event.target.value },
                          }))
                        }
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div>
                      <StudioLabel>বাটন লেবেল</StudioLabel>
                      <input
                        className={input}
                        value={config.hero.ctaLabel}
                        onChange={event =>
                          setConfig(c => ({
                            ...c,
                            hero: { ...c.hero, ctaLabel: event.target.value },
                          }))
                        }
                      />
                    </div>
                    <div>
                      <StudioLabel hint="যেমন /shop">বাটন লিংক</StudioLabel>
                      <input
                        className={input}
                        value={config.hero.ctaHref}
                        onChange={event =>
                          setConfig(c => ({
                            ...c,
                            hero: { ...c.hero, ctaHref: event.target.value },
                          }))
                        }
                      />
                    </div>
                  </div>
                  <div>
                    <StudioLabel>অ্যালাইনমেন্ট</StudioLabel>
                    <Segmented
                      value={config.hero.align}
                      onChange={value =>
                        setConfig(c => ({
                          ...c,
                          hero: { ...c.hero, align: value },
                        }))
                      }
                      options={[
                        { value: "left", label: "বাম" },
                        { value: "center", label: "কেন্দ্রে" },
                      ]}
                    />
                  </div>
                  <div className="rounded-lg border border-ink-200 bg-white px-3.5">
                    <Switch
                      checked={config.hero.enabled}
                      onChange={value =>
                        setConfig(c => ({
                          ...c,
                          hero: { ...c.hero, enabled: value },
                        }))
                      }
                      label="হিরো দেখান"
                    />
                  </div>
                </div>
              </Accordion>

              <Accordion title="প্রোমো ও ট্রাস্ট">
                <div className="space-y-4">
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div>
                      <StudioLabel>প্রোমো শিরোনাম</StudioLabel>
                      <input
                        className={input}
                        value={config.promo.title}
                        onChange={event =>
                          setConfig(c => ({
                            ...c,
                            promo: { ...c.promo, title: event.target.value },
                          }))
                        }
                      />
                    </div>
                    <div>
                      <StudioLabel>প্রোমো বাটন</StudioLabel>
                      <input
                        className={input}
                        value={config.promo.ctaLabel}
                        onChange={event =>
                          setConfig(c => ({
                            ...c,
                            promo: { ...c.promo, ctaLabel: event.target.value },
                          }))
                        }
                      />
                    </div>
                  </div>
                  <div>
                    <StudioLabel>প্রোমো বর্ণনা</StudioLabel>
                    <textarea
                      className={`${textArea} h-20`}
                      value={config.promo.body}
                      onChange={event =>
                        setConfig(c => ({
                          ...c,
                          promo: { ...c.promo, body: event.target.value },
                        }))
                      }
                    />
                  </div>
                  <div>
                    <StudioLabel hint="একটি লাইনে একটি">
                      ট্রাস্ট আইটেম
                    </StudioLabel>
                    <textarea
                      className={`${textArea} h-24`}
                      value={config.trust.items.join("\n")}
                      onChange={event =>
                        setConfig(c => ({
                          ...c,
                          trust: {
                            ...c.trust,
                            items: event.target.value
                              .split("\n")
                              .map(r => r.trim())
                              .filter(Boolean),
                          },
                        }))
                      }
                    />
                  </div>
                  <div className="rounded-lg border border-ink-200 bg-white px-3.5">
                    <Switch
                      checked={config.promo.enabled}
                      onChange={value =>
                        setConfig(c => ({
                          ...c,
                          promo: { ...c.promo, enabled: value },
                        }))
                      }
                      label="প্রোমো ব্যানার দেখান"
                    />
                  </div>
                </div>
              </Accordion>

              <Accordion title="ফুটার ও নেভিগেশন">
                <div className="space-y-4">
                  <div>
                    <StudioLabel>দোকান পরিচিতি</StudioLabel>
                    <textarea
                      className={`${textArea} h-20`}
                      value={config.footer.about}
                      onChange={event =>
                        setConfig(c => ({
                          ...c,
                          footer: { ...c.footer, about: event.target.value },
                        }))
                      }
                    />
                  </div>
                  <div>
                    <StudioLabel>ফুটার নোট</StudioLabel>
                    <input
                      className={input}
                      value={config.footer.note}
                      onChange={event =>
                        setConfig(c => ({
                          ...c,
                          footer: { ...c.footer, note: event.target.value },
                        }))
                      }
                    />
                  </div>
                  <div>
                    <StudioLabel hint='[{"label":"হোম","href":"/"}]'>
                      নেভিগেশন (JSON)
                    </StudioLabel>
                    <textarea
                      className={`${jsonArea} h-28`}
                      spellCheck={false}
                      value={navigationJson}
                      onChange={event => setNavigationJson(event.target.value)}
                    />
                  </div>
                  <div>
                    <StudioLabel>রিভিউ (JSON)</StudioLabel>
                    <textarea
                      className={`${jsonArea} h-28`}
                      spellCheck={false}
                      value={testimonialsJson}
                      onChange={event =>
                        setTestimonialsJson(event.target.value)
                      }
                    />
                  </div>
                  <div>
                    <StudioLabel>ফুটার কলাম (JSON)</StudioLabel>
                    <textarea
                      className={`${jsonArea} h-28`}
                      spellCheck={false}
                      value={footerColumnsJson}
                      onChange={event =>
                        setFooterColumnsJson(event.target.value)
                      }
                    />
                  </div>
                </div>
              </Accordion>

              <Accordion title="সেকশন ক্রম ও দৃশ্যমানতা">
                <div className="space-y-3">
                  <ul className="space-y-1.5">
                    {config.sections.map(section => (
                      <li
                        key={section.key}
                        className={`rounded-md border-l-2 px-3 py-1.5 ${
                          section.enabled
                            ? "border-emerald-600 bg-emerald-50/60"
                            : "border-ink-200 bg-white"
                        }`}
                      >
                        <Switch
                          checked={section.enabled}
                          onChange={value =>
                            setConfig(c => ({
                              ...c,
                              sections: c.sections.map(row =>
                                row.key === section.key
                                  ? { ...row, enabled: value }
                                  : row
                              ),
                            }))
                          }
                          label={SECTION_LABELS[section.key] ?? section.key}
                        />
                      </li>
                    ))}
                  </ul>
                  <div>
                    <StudioLabel hint="এখানে ক্রম (order) ঠিক করা যায়">
                      সেকশন JSON
                    </StudioLabel>
                    <textarea
                      className={`${jsonArea} h-32`}
                      spellCheck={false}
                      value={sectionsJson}
                      onChange={event => setSectionsJson(event.target.value)}
                    />
                  </div>
                </div>
              </Accordion>
            </form>
          </div>
        </aside>

        {/* Right — sticky live preview canvas */}
        <div className="min-w-0 xl:sticky xl:top-20 xl:self-start">
          <section className="min-w-0 overflow-hidden rounded-xl border border-ink-200 bg-white">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-ink-200 px-3 py-2">
              <div className="inline-flex rounded-full bg-ink-100 p-0.5">
                {(
                  [
                    { value: "desktop", label: "ডেস্কটপ", icon: Monitor },
                    { value: "tablet", label: "ট্যাবলেট", icon: Tablet },
                    { value: "mobile", label: "মোবাইল", icon: Smartphone },
                  ] as const
                ).map(item => (
                  <button
                    key={item.value}
                    type="button"
                    onClick={() => setDevice(item.value)}
                    className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition ${
                      device === item.value
                        ? "bg-white text-ink-900 shadow-sm"
                        : "text-ink-500 hover:text-ink-800"
                    }`}
                  >
                    <item.icon className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">{item.label}</span>
                  </button>
                ))}
              </div>
              <span className="inline-flex items-center gap-1.5 pr-1 text-[11px] font-medium text-ink-400">
                <MousePointerClick className="h-3.5 w-3.5" />
                লাইভ প্রিভিউ
              </span>
            </div>

            {/* Fixed-height canvas so the page never grows with the storefront */}
            <div className="design-preview-stage min-w-0 overflow-hidden bg-[#f4f6fa] p-3 sm:p-4">
              <div className="design-preview-scroll mx-auto h-[520px] min-w-0 overflow-x-hidden overflow-y-auto overscroll-contain rounded-lg border border-ink-200 bg-white sm:h-[600px] xl:h-[calc(100vh-19rem)] xl:min-h-[480px]">
                <div
                  data-preview-device={device}
                  className={`design-preview-frame mx-auto min-w-0 ${previewWidth}`}
                >
                  <ThemePreview
                    config={config}
                    themeCode={themeCode}
                    storeName={storeName}
                    slug={storeSlug}
                    products={products}
                    categories={categories}
                  />
                </div>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
