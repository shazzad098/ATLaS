"use client";

import { useActionState, useMemo, useState } from "react";
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

/**
 * Theme editor (FR-06).
 *
 * The merchant edits the draft config; `publish` copies it to the live config.
 * Nested collections (sections, testimonials, footer columns, navigation) are
 * edited as JSON so the editor stays small and the schema stays authoritative.
 */

export type EditableThemeConfig = {
  colors: { primary: string; accent: string; background: string; surface: string; text: string; muted: string };
  typography: { headingFont: "sans" | "serif"; bodyFont: "sans" | "serif"; scale: "compact" | "comfortable" };
  buttons: { style: "rounded" | "pill" | "square" };
  header: { style: "classic" | "centered" | "minimal"; showSearch: boolean; announcement: string; sticky: boolean };
  hero: { enabled: boolean; title: string; subtitle: string; ctaLabel: string; ctaHref: string; align: "left" | "center" };
  promo: { enabled: boolean; title: string; body: string; ctaLabel: string; ctaHref: string };
  testimonials: { enabled: boolean; items: Array<{ name: string; quote: string; location: string }> };
  trust: { enabled: boolean; items: string[] };
  footer: { about: string; columns: Array<{ title: string; links: Array<{ label: string; href: string }> }>; note: string };
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

const COLOR_FIELDS: Array<{ key: keyof EditableThemeConfig["colors"]; label: string }> = [
  { key: "primary", label: "প্রাইমারি" },
  { key: "accent", label: "অ্যাকসেন্ট" },
  { key: "background", label: "ব্যাকগ্রাউন্ড" },
  { key: "surface", label: "সারফেস" },
  { key: "text", label: "টেক্সট" },
  { key: "muted", label: "মিউটেড" },
];

export function ThemeEditor({
  storeId,
  themeVersionId,
  themeCode,
  draft,
  isPublished,
  canSwitch,
  switchBlockedReason,
  options,
}: {
  storeId: string;
  themeVersionId: string;
  themeCode: string;
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
  const [saveState, saveSubmit, savePending] = useActionState(saveThemeDraftAction, EMPTY_ADMIN_STATE);
  const [publishState, publishSubmit, publishPending] = useActionState(publishThemeAction, EMPTY_ADMIN_STATE);
  const [selectState, selectSubmit, selectPending] = useActionState(selectThemeAction, EMPTY_ADMIN_STATE);
  const [resetState, resetSubmit, resetPending] = useActionState(resetThemeDraftAction, EMPTY_ADMIN_STATE);

  const [config, setConfig] = useState<EditableThemeConfig>(draft);
  const [navigationJson, setNavigationJson] = useState(JSON.stringify(draft.navigation, null, 2));
  const [testimonialsJson, setTestimonialsJson] = useState(JSON.stringify(draft.testimonials.items, null, 2));
  const [footerColumnsJson, setFooterColumnsJson] = useState(JSON.stringify(draft.footer.columns, null, 2));
  const [sectionsJson, setSectionsJson] = useState(JSON.stringify(draft.sections, null, 2));

  /**
   * The whole config is submitted as one hidden JSON field; nested collections
   * come from the JSON textareas, so an invalid textarea fails here instead of
   * reaching the server action.
   */
  const configJson = useMemo(() => {
    try {
      return {
        value: JSON.stringify({
          ...config,
          navigation: JSON.parse(navigationJson),
          testimonials: { ...config.testimonials, items: JSON.parse(testimonialsJson) },
          footer: { ...config.footer, columns: JSON.parse(footerColumnsJson) },
          sections: JSON.parse(sectionsJson),
        }),
        error: null as string | null,
      };
    } catch {
      return { value: "", error: "JSON ফরম্যাট ঠিক নেই — কমা ও ব্র্যাকেট যাচাই করুন।" };
    }
  }, [config, navigationJson, testimonialsJson, footerColumnsJson, sectionsJson]);

  const messages = [saveState, publishState, selectState, resetState].filter((state) => state.message);

  const activeSectionCount = config.sections.filter((s) => s.enabled).length;

  function updateSections(next: EditableThemeConfig["sections"]) {
    setConfig((v) => ({ ...v, sections: next }));
    setSectionsJson(JSON.stringify(next, null, 2));
  }

  function toggleSection(key: string) {
    updateSections(config.sections.map((s) => (s.key === key ? { ...s, enabled: !s.enabled } : s)));
  }

  function moveSection(index: number, dir: -1 | 1) {
    const target = index + dir;
    if (target < 0 || target >= config.sections.length) return;
    const next = [...config.sections];
    [next[index], next[target]] = [next[target], next[index]];
    updateSections(next);
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-ink-50 via-white to-ink-50/40 pb-24 lg:pb-0">
      <style>{`
        @keyframes te-in {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .te-in { animation: te-in 0.45s cubic-bezier(0.22, 1, 0.36, 1) both; }
      `}</style>

      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8 lg:py-10">
        {/* ── Page header ───────────────────────────────────── */}
        <header className="te-in mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-ink-200 bg-white/80 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-ink-600 shadow-sm">
              <span className="h-1.5 w-1.5 rounded-full bg-brand-500" />
              Theme Studio
            </span>
            <h1 className="mt-3 text-2xl font-semibold tracking-tight text-ink-900 sm:text-3xl">
              থিম এডিটর
            </h1>
            <p className="mt-1 max-w-2xl text-sm text-ink-600">
              রঙ, টাইপোগ্রাফি ও সেকশন ক্রম কাস্টমাইজ করুন। পরিবর্তন draft-এ থাকবে — publish করলে live হবে।
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <StatusPill tone={isPublished ? "live" : "draft"}>
              {isPublished ? "Live" : "Draft only"}
            </StatusPill>
            <span className="rounded-full border border-ink-200 bg-white/80 px-2.5 py-1 text-[11px] font-medium text-ink-600">
              {themeCode}
            </span>
          </div>
        </header>

        {/* ── Alerts ────────────────────────────────────────── */}
        {messages.length > 0 && (
          <div className="te-in mb-5 space-y-2">
            {messages.map((state, index) => (
              <Alert key={index} tone={state.ok ? "success" : "danger"}>
                {state.message}
              </Alert>
            ))}
          </div>
        )}
        {configJson.error && (
          <div className="te-in mb-5">
            <Alert tone="danger">{configJson.error}</Alert>
          </div>
        )}

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
          {/* ═══════════════ MAIN COLUMN ═══════════════ */}
          <div className="te-in min-w-0 space-y-6">
            {/* Theme selection */}
            <Card>
              <CardHeader
                title="থিম নির্বাচন"
                description={
                  isPublished
                    ? canSwitch
                      ? "নতুন থিম বাছলে সেটি draft-এ যাবে — publish করলে live হবে।"
                      : switchBlockedReason ?? undefined
                    : "এখনো publish করা হয়নি — থিম বদলানো যাবে।"
                }
              />
              <CardBody>
                <div className="grid gap-3 sm:grid-cols-3">
                  {options.map((option) => {
                    const current = option.code === themeCode;
                    const disabled = !option.allowed || current || selectPending;
                    return (
                      <form key={option.code} action={selectSubmit}>
                        <input type="hidden" name="storeId" value={storeId} />
                        <input type="hidden" name="themeCode" value={option.code} />
                        <button
                          type="submit"
                          disabled={disabled}
                          aria-current={current ? "true" : undefined}
                          className={`group relative w-full overflow-hidden rounded-2xl border text-left transition-all duration-300 ${
                            current
                              ? "border-brand-500 shadow-[0_0_0_3px_rgba(20,184,166,0.15)]"
                              : option.allowed
                                ? "border-ink-200 hover:-translate-y-0.5 hover:border-ink-300 hover:shadow-lg"
                                : "cursor-not-allowed border-ink-200 opacity-60"
                          }`}
                        >
                          <span className={`relative block h-24 overflow-hidden bg-gradient-to-br ${option.gradient}`}>
                            <span className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.55),transparent_60%)]" />
                            <span className="absolute bottom-2 left-2 flex gap-1.5">
                              {option.swatches.map((swatch) => (
                                <span
                                  key={swatch}
                                  className="h-4 w-4 rounded-full border border-white/70 shadow-sm transition-transform duration-300 group-hover:scale-110"
                                  style={{ background: swatch }}
                                />
                              ))}
                            </span>
                            {current && (
                              <span className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full bg-white text-brand-600 shadow">
                                <CheckIcon className="h-3.5 w-3.5" />
                              </span>
                            )}
                            {!option.allowed && (
                              <span className="absolute right-2 top-2 rounded-full bg-white/90 px-2 py-0.5 text-[10px] font-semibold text-ink-700 shadow">
                                🔒
                              </span>
                            )}
                          </span>
                          <span className="block bg-white p-3">
                            <span className="block text-sm font-semibold text-ink-900">{option.name}</span>
                            <span className="mt-0.5 block text-[11px] text-ink-500">
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
              </CardBody>
            </Card>

            {/* Colors */}
            <Card>
              <CardHeader title="রঙ" description="থিমের মূল প্যালেট" />
              <CardBody className="grid gap-4 sm:grid-cols-3">
                {COLOR_FIELDS.map(({ key, label }) => (
                  <Field key={key} label={label}>
                    <div className="flex items-center gap-2">
                      <label className="relative h-10 w-10 shrink-0 cursor-pointer overflow-hidden rounded-xl border border-ink-200 shadow-sm transition-all duration-200 hover:scale-105 hover:shadow-md">
                        <span className="absolute inset-0" style={{ background: config.colors[key] }} />
                        <input
                          type="color"
                          value={config.colors[key]}
                          onChange={(event) =>
                            setConfig((v) => ({ ...v, colors: { ...v.colors, [key]: event.target.value } }))
                          }
                          className="absolute inset-0 cursor-pointer opacity-0"
                        />
                      </label>
                      <Input
                        value={config.colors[key]}
                        onChange={(event) =>
                          setConfig((v) => ({ ...v, colors: { ...v.colors, [key]: event.target.value } }))
                        }
                        className="font-mono text-xs uppercase"
                      />
                    </div>
                  </Field>
                ))}
              </CardBody>
            </Card>

            {/* Typography & buttons */}
            <Card>
              <CardHeader title="টাইপোগ্রাফি ও বাটন" />
              <CardBody className="grid gap-4 sm:grid-cols-3">
                <Field label="হেডিং ফন্ট">
                  <Select
                    value={config.typography.headingFont}
                    onChange={(event) =>
                      setConfig((v) => ({
                        ...v,
                        typography: { ...v.typography, headingFont: event.target.value as "sans" | "serif" },
                      }))
                    }
                  >
                    <option value="serif">Serif</option>
                    <option value="sans">Sans</option>
                  </Select>
                </Field>
                <Field label="বডি ফন্ট">
                  <Select
                    value={config.typography.bodyFont}
                    onChange={(event) =>
                      setConfig((v) => ({
                        ...v,
                        typography: { ...v.typography, bodyFont: event.target.value as "sans" | "serif" },
                      }))
                    }
                  >
                    <option value="sans">Sans</option>
                    <option value="serif">Serif</option>
                  </Select>
                </Field>
                <Field label="বাটন স্টাইল">
                  <Select
                    value={config.buttons.style}
                    onChange={(event) =>
                      setConfig((v) => ({
                        ...v,
                        buttons: { style: event.target.value as "rounded" | "pill" | "square" },
                      }))
                    }
                  >
                    <option value="rounded">Rounded</option>
                    <option value="pill">Pill</option>
                    <option value="square">Square</option>
                  </Select>
                </Field>
                <Field label="স্কেল">
                  <Select
                    value={config.typography.scale}
                    onChange={(event) =>
                      setConfig((v) => ({
                        ...v,
                        typography: { ...v.typography, scale: event.target.value as "compact" | "comfortable" },
                      }))
                    }
                  >
                    <option value="comfortable">Comfortable</option>
                    <option value="compact">Compact</option>
                  </Select>
                </Field>
                <div className="sm:col-span-3">
                  <p className="mb-2 text-[11px] font-medium uppercase tracking-widest text-ink-500">
                    ফন্ট প্রিভিউ
                  </p>
                  <div
                    className={`rounded-xl border border-dashed border-ink-200 bg-ink-50/50 p-4 ${
                      config.typography.headingFont === "serif" ? "font-serif" : "font-sans"
                    }`}
                  >
                    <p className="text-lg font-semibold text-ink-900">{config.hero.title || "আপনার নতুন সংগ্রহ"}</p>
                    <p
                      className={`mt-1 text-sm text-ink-600 ${
                        config.typography.bodyFont === "serif" ? "font-serif" : "font-sans"
                      }`}
                    >
                      {config.hero.subtitle || "সরাসরি দোকান থেকে, ঘরে পৌঁছে যাবে।"}
                    </p>
                  </div>
                </div>
              </CardBody>
            </Card>

            {/* Header */}
            <Card>
              <CardHeader title="হেডার" description="ঘোষণা বার ও সার্চ" />
              <CardBody className="grid gap-4 sm:grid-cols-2">
                <Field label="স্টাইল">
                  <Select
                    value={config.header.style}
                    onChange={(event) =>
                      setConfig((v) => ({
                        ...v,
                        header: { ...v.header, style: event.target.value as "classic" | "centered" | "minimal" },
                      }))
                    }
                  >
                    <option value="classic">Classic</option>
                    <option value="centered">Centered</option>
                    <option value="minimal">Minimal</option>
                  </Select>
                </Field>
                <Field label="ঘোষণা টেক্সট" hint="খালি রাখলে ঘোষণা দেখাবে না">
                  <Input
                    value={config.header.announcement}
                    onChange={(event) =>
                      setConfig((v) => ({ ...v, header: { ...v.header, announcement: event.target.value } }))
                    }
                  />
                </Field>
                <div className="space-y-2 sm:col-span-2">
                  <ToggleRow
                    label="সার্চ দেখান"
                    hint="হেডারে সার্চ আইকন দেখাবে"
                    checked={config.header.showSearch}
                    onChange={() =>
                      setConfig((v) => ({ ...v, header: { ...v.header, showSearch: !v.header.showSearch } }))
                    }
                  />
                  <ToggleRow
                    label="Sticky হেডার"
                    hint="স্ক্রল করলে হেডার উপরে আটকে থাকবে"
                    checked={config.header.sticky}
                    onChange={() =>
                      setConfig((v) => ({ ...v, header: { ...v.header, sticky: !v.header.sticky } }))
                    }
                  />
                </div>
              </CardBody>
            </Card>

            {/* Hero */}
            <Card>
              <CardHeader title="হিরো" />
              <CardBody className="grid gap-4 sm:grid-cols-2">
                <Field label="শিরোনাম" className="sm:col-span-2">
                  <Input
                    value={config.hero.title}
                    onChange={(event) => setConfig((v) => ({ ...v, hero: { ...v.hero, title: event.target.value } }))}
                  />
                </Field>
                <Field label="সাবটাইটেল" className="sm:col-span-2">
                  <Input
                    value={config.hero.subtitle}
                    onChange={(event) =>
                      setConfig((v) => ({ ...v, hero: { ...v.hero, subtitle: event.target.value } }))
                    }
                  />
                </Field>
                <Field label="বাটন লেবেল">
                  <Input
                    value={config.hero.ctaLabel}
                    onChange={(event) =>
                      setConfig((v) => ({ ...v, hero: { ...v.hero, ctaLabel: event.target.value } }))
                    }
                  />
                </Field>
                <Field label="বাটন লিংক" hint="যেমন: /shop">
                  <Input
                    value={config.hero.ctaHref}
                    onChange={(event) =>
                      setConfig((v) => ({ ...v, hero: { ...v.hero, ctaHref: event.target.value } }))
                    }
                  />
                </Field>
                <Field label="অ্যালাইনমেন্ট">
                  <Select
                    value={config.hero.align}
                    onChange={(event) =>
                      setConfig((v) => ({
                        ...v,
                        hero: { ...v.hero, align: event.target.value as "left" | "center" },
                      }))
                    }
                  >
                    <option value="left">বাম</option>
                    <option value="center">কেন্দ্রে</option>
                  </Select>
                </Field>
                <div className="flex items-end">
                  <ToggleRow
                    label="হিরো দেখান"
                    checked={config.hero.enabled}
                    onChange={() =>
                      setConfig((v) => ({ ...v, hero: { ...v.hero, enabled: !v.hero.enabled } }))
                    }
                  />
                </div>
              </CardBody>
            </Card>

            {/* Promo & trust */}
            <Card>
              <CardHeader title="প্রোমো ব্যানার ও ট্রাস্ট" />
              <CardBody className="grid gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <ToggleRow
                    label="প্রোমো ব্যানার দেখান"
                    checked={config.promo.enabled}
                    onChange={() =>
                      setConfig((v) => ({ ...v, promo: { ...v.promo, enabled: !v.promo.enabled } }))
                    }
                  />
                </div>
                <Field label="প্রোমো শিরোনাম">
                  <Input
                    value={config.promo.title}
                    onChange={(event) =>
                      setConfig((v) => ({ ...v, promo: { ...v.promo, title: event.target.value } }))
                    }
                  />
                </Field>
                <Field label="প্রোমো বাটন লেবেল">
                  <Input
                    value={config.promo.ctaLabel}
                    onChange={(event) =>
                      setConfig((v) => ({ ...v, promo: { ...v.promo, ctaLabel: event.target.value } }))
                    }
                  />
                </Field>
                <Field label="প্রোমো বাটন লিংক">
                  <Input
                    value={config.promo.ctaHref}
                    onChange={(event) =>
                      setConfig((v) => ({ ...v, promo: { ...v.promo, ctaHref: event.target.value } }))
                    }
                  />
                </Field>
                <Field label="প্রোমো বর্ণনা" className="sm:col-span-2">
                  <Textarea
                    value={config.promo.body}
                    onChange={(event) =>
                      setConfig((v) => ({ ...v, promo: { ...v.promo, body: event.target.value } }))
                    }
                  />
                </Field>
                <div className="sm:col-span-2">
                  <ToggleRow
                    label="ট্রাস্ট বার দেখান"
                    checked={config.trust.enabled}
                    onChange={() =>
                      setConfig((v) => ({ ...v, trust: { ...v.trust, enabled: !v.trust.enabled } }))
                    }
                  />
                </div>
                <Field label="ট্রাস্ট আইটেম" hint="একটি লাইনে একটি" className="sm:col-span-2">
                  <Textarea
                    value={config.trust.items.join("\n")}
                    onChange={(event) =>
                      setConfig((v) => ({
                        ...v,
                        trust: {
                          ...v.trust,
                          items: event.target.value.split("\n").map((row) => row.trim()).filter(Boolean),
                        },
                      }))
                    }
                  />
                </Field>
              </CardBody>
            </Card>

            {/* Footer & navigation */}
            <Card>
              <CardHeader title="ফুটার ও নেভিগেশন" />
              <CardBody className="grid gap-4">
                <Field label="দোকান পরিচিতি">
                  <Textarea
                    value={config.footer.about}
                    onChange={(event) =>
                      setConfig((v) => ({ ...v, footer: { ...v.footer, about: event.target.value } }))
                    }
                  />
                </Field>
                <Field label="ফুটার নোট">
                  <Input
                    value={config.footer.note}
                    onChange={(event) =>
                      setConfig((v) => ({ ...v, footer: { ...v.footer, note: event.target.value } }))
                    }
                  />
                </Field>
                <Field label="নেভিগেশন (JSON)" hint='[{"label":"হোম","href":"/"}]'>
                  <Textarea
                    value={navigationJson}
                    onChange={(event) => setNavigationJson(event.target.value)}
                    rows={5}
                    className="font-mono text-xs"
                  />
                </Field>
                <Field label="রিভিউ (JSON)">
                  <Textarea
                    value={testimonialsJson}
                    onChange={(event) => setTestimonialsJson(event.target.value)}
                    rows={5}
                    className="font-mono text-xs"
                  />
                </Field>
                <Field label="ফুটার কলাম (JSON)">
                  <Textarea
                    value={footerColumnsJson}
                    onChange={(event) => setFooterColumnsJson(event.target.value)}
                    rows={5}
                    className="font-mono text-xs"
                  />
                </Field>
              </CardBody>
            </Card>

            {/* Sections */}
            <Card>
              <CardHeader title="সেকশন ক্রম ও দৃশ্যমানতা" description="উপর-নিচ বাটন দিয়ে ক্রম বদলান" />
              <CardBody className="space-y-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-[11px] font-medium uppercase tracking-widest text-ink-500">ক্রম</p>
                  <span className="rounded-full bg-ink-100 px-2 py-0.5 text-[10px] font-semibold text-ink-700">
                    {activeSectionCount}/{config.sections.length} সক্রিয়
                  </span>
                </div>
                <ul className="space-y-1.5">
                  {config.sections.map((section, index) => {
                    const enabled = section.enabled;
                    const label = SECTION_LABELS[section.key] ?? section.key;
                    return (
                      <li
                        key={section.key}
                        className={`group flex items-center gap-2 rounded-xl border px-3 py-2.5 transition-all duration-200 ${
                          enabled
                            ? "border-ink-200 bg-white hover:border-ink-300 hover:shadow-sm"
                            : "border-dashed border-ink-200 bg-ink-50/40"
                        }`}
                      >
                        <span
                          className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-[11px] font-semibold tabular-nums ${
                            enabled ? "bg-ink-100 text-ink-700" : "bg-ink-100/60 text-ink-400"
                          }`}
                        >
                          {index + 1}
                        </span>
                        <span
                          className={`flex-1 truncate text-sm font-medium ${
                            enabled ? "text-ink-900" : "text-ink-400"
                          }`}
                        >
                          {label}
                        </span>
                        <div className="flex items-center gap-0.5">
                          <button
                            type="button"
                            onClick={() => moveSection(index, -1)}
                            disabled={index === 0}
                            className="rounded-md p-1 text-ink-400 transition-colors hover:bg-ink-100 hover:text-ink-700 disabled:pointer-events-none disabled:opacity-30"
                            aria-label="উপরে সরান"
                          >
                            <ChevronUp className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => moveSection(index, 1)}
                            disabled={index === config.sections.length - 1}
                            className="rounded-md p-1 text-ink-400 transition-colors hover:bg-ink-100 hover:text-ink-700 disabled:pointer-events-none disabled:opacity-30"
                            aria-label="নিচে সরান"
                          >
                            <ChevronDown className="h-3.5 w-3.5" />
                          </button>
                        </div>
                        <Toggle checked={enabled} onChange={() => toggleSection(section.key)} label={label} />
                      </li>
                    );
                  })}
                </ul>
                <Field label="সেকশন JSON" hint="এখানে ক্রম (order) ঠিক করা যায়">
                  <Textarea
                    value={sectionsJson}
                    onChange={(event) => {
                      const value = event.target.value;
                      setSectionsJson(value);
                      try {
                        const parsed = JSON.parse(value);
                        if (Array.isArray(parsed)) {
                          setConfig((v) => ({
                            ...v,
                            sections: parsed as EditableThemeConfig["sections"],
                          }));
                        }
                      } catch {
                        /* ignore invalid JSON while typing */
                      }
                    }}
                    rows={7}
                    className="font-mono text-xs"
                  />
                </Field>
              </CardBody>
            </Card>
          </div>

          {/* ═══════════════ SIDEBAR ═══════════════ */}
          <aside className="te-in h-fit space-y-4 lg:sticky lg:top-6">
            {/* Actions */}
            <Card>
              <CardHeader title="প্রকাশ" description="Draft সংরক্ষণ ও live করা" />
              <CardBody className="space-y-2.5">
                <form action={saveSubmit}>
                  <input type="hidden" name="storeId" value={storeId} />
                  <input type="hidden" name="themeVersionId" value={themeVersionId} />
                  <input type="hidden" name="config" value={configJson.value} />
                  <Button
                    type="submit"
                    disabled={savePending || Boolean(configJson.error)}
                    className="w-full"
                  >
                    {savePending ? "সংরক্ষণ হচ্ছে…" : "ড্রাফট সংরক্ষণ করুন"}
                  </Button>
                </form>
                <form action={publishSubmit}>
                  <input type="hidden" name="storeId" value={storeId} />
                  <input type="hidden" name="themeVersionId" value={themeVersionId} />
                  <Button type="submit" variant="secondary" disabled={publishPending} className="w-full">
                    {publishPending ? "Publish হচ্ছে…" : "ড্রাফট publish করুন"}
                  </Button>
                </form>
                <form
                  action={resetSubmit}
                  onSubmit={(event) => {
                    if (!window.confirm("ড্রাফট পরিবর্তন মুছে থিমের ডিফল্টে ফিরে যাবেন?")) event.preventDefault();
                  }}
                >
                  <input type="hidden" name="storeId" value={storeId} />
                  <input type="hidden" name="themeVersionId" value={themeVersionId} />
                  <Button type="submit" variant="outline" disabled={resetPending} className="w-full">
                    {resetPending ? "রিসেট হচ্ছে…" : "ডিফল্টে রিসেট"}
                  </Button>
                </form>
                {configJson.error && (
                  <p className="text-[11px] text-rose-600">JSON ঠিক না থাকলে সংরক্ষণ বন্ধ থাকে।</p>
                )}
              </CardBody>
            </Card>

            {/* Live preview */}
            <Card className="overflow-hidden">
              <CardHeader title="লাইভ প্রিভিউ" description="Draft অনুযায়ী আনুমানিক চেহারা" />
              <CardBody className="space-y-4">
                <div className="flex gap-1.5">
                  {Object.entries(config.colors).map(([name, value]) => (
                    <div
                      key={name}
                      title={`${name}: ${value}`}
                      className="h-8 flex-1 rounded-lg border border-black/5 shadow-inner transition-transform duration-200 hover:scale-110"
                      style={{ background: value }}
                    />
                  ))}
                </div>

                <div
                  className="overflow-hidden rounded-xl border border-ink-200 shadow-sm"
                  style={{ background: config.colors.background }}
                >
                  <div className="p-4">
                    <p
                      className="text-[10px] font-semibold uppercase tracking-[0.18em]"
                      style={{ color: config.colors.muted }}
                    >
                      {themeCode}
                    </p>
                    <p
                      className={`mt-1.5 text-base font-semibold leading-snug ${
                        config.typography.headingFont === "serif" ? "font-serif" : "font-sans"
                      }`}
                      style={{ color: config.colors.text }}
                    >
                      {config.hero.title || "Hero title"}
                    </p>
                    <p className="mt-1 text-xs leading-relaxed" style={{ color: config.colors.muted }}>
                      {config.hero.subtitle || "Subtitle"}
                    </p>
                    <button
                      type="button"
                      tabIndex={-1}
                      className={`mt-3 px-3 py-1.5 text-[11px] font-semibold text-white transition-transform duration-200 hover:scale-105 ${
                        config.buttons.style === "pill"
                          ? "rounded-full"
                          : config.buttons.style === "square"
                            ? "rounded-none"
                            : "rounded-md"
                      }`}
                      style={{ background: config.colors.primary }}
                    >
                      {config.hero.ctaLabel || "CTA"}
                    </button>
                  </div>
                </div>

                <div>
                  <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-ink-500">
                    সক্রিয় সেকশন · {activeSectionCount}/{config.sections.length}
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {config.sections
                      .filter((s) => s.enabled)
                      .map((s) => (
                        <span
                          key={s.key}
                          className="rounded-full border border-ink-200 bg-ink-50 px-2 py-0.5 text-[10px] font-medium text-ink-700"
                        >
                          {SECTION_LABELS[s.key] ?? s.key}
                        </span>
                      ))}
                  </div>
                </div>
              </CardBody>
            </Card>
          </aside>
        </div>
      </div>

      {/* ── Mobile sticky action bar ─────────────────────────── */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-ink-200/80 bg-white/90 px-4 py-3 shadow-[0_-8px_24px_-12px_rgba(15,23,42,0.15)] backdrop-blur-md lg:hidden">
        <div className="mx-auto flex max-w-2xl items-center gap-2">
          <form action={saveSubmit} className="flex-1">
            <input type="hidden" name="storeId" value={storeId} />
            <input type="hidden" name="themeVersionId" value={themeVersionId} />
            <input type="hidden" name="config" value={configJson.value} />
            <Button
              type="submit"
              disabled={savePending || Boolean(configJson.error)}
              className="w-full"
            >
              {savePending ? "সংরক্ষণ হচ্ছে…" : "সংরক্ষণ"}
            </Button>
          </form>
          <form action={publishSubmit} className="flex-1">
            <input type="hidden" name="storeId" value={storeId} />
            <input type="hidden" name="themeVersionId" value={themeVersionId} />
            <Button type="submit" variant="secondary" disabled={publishPending} className="w-full">
              {publishPending ? "Publish হচ্ছে…" : "Publish"}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────
 * Small presentational helpers
 * ────────────────────────────────────────────────────────────── */

function StatusPill({ tone, children }: { tone: "live" | "draft"; children: React.ReactNode }) {
  const classes =
    tone === "live"
      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
      : "border-amber-200 bg-amber-50 text-amber-700";
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold ${classes}`}
    >
      <span
        className={`h-1.5 w-1.5 rounded-full ${
          tone === "live" ? "animate-pulse bg-emerald-500" : "bg-amber-500"
        }`}
      />
      {children}
    </span>
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
      className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40 ${
        checked ? "bg-brand-500" : "bg-ink-300"
      }`}
    >
      <span
        className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform duration-200 ${
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
    <div className="flex items-center justify-between gap-3 rounded-xl border border-ink-200 bg-white px-3 py-2.5 transition-colors duration-200 hover:border-ink-300">
      <div>
        <p className="text-sm font-medium text-ink-900">{label}</p>
        {hint && <p className="text-[11px] text-ink-500">{hint}</p>}
      </div>
      <Toggle checked={checked} onChange={onChange} label={label} />
    </div>
  );
}

function CheckIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

function ChevronUp({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <path d="m18 15-6-6-6 6" />
    </svg>
  );
}

function ChevronDown({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}