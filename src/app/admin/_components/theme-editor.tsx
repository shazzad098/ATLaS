"use client";

import { useActionState, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Alert, Card, CardBody, CardHeader } from "@/components/ui/shell";
import { Checkbox, Field, Input, Select, Textarea } from "@/components/ui/form";
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

  return (
    <div className="space-y-5">
      {messages.map((state, index) => (
        <Alert key={index} tone={state.ok ? "success" : "danger"}>
          {state.message}
        </Alert>
      ))}
      {configJson.error ? <Alert tone="danger">{configJson.error}</Alert> : null}

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
                    className={`w-full overflow-hidden rounded-xl border text-left transition ${
                      current
                        ? "border-brand-500 ring-2 ring-brand-500/25"
                        : option.allowed
                          ? "border-ink-200 hover:border-ink-300"
                          : "cursor-not-allowed border-ink-200 opacity-60"
                    }`}
                  >
                    <span className={`block h-20 bg-gradient-to-br ${option.gradient}`}>
                      <span className="flex h-full items-end gap-1 p-2">
                        {option.swatches.map((swatch) => (
                          <span
                            key={swatch}
                            className="h-4 w-4 rounded-full border border-white/60"
                            style={{ background: swatch }}
                          />
                        ))}
                      </span>
                    </span>
                    <span className="block p-3">
                      <span className="block text-sm font-semibold text-ink-900">{option.name}</span>
                      <span className="block text-[11px] text-ink-500">
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

      <form action={saveSubmit} className="space-y-5">
        <input type="hidden" name="storeId" value={storeId} />
        <input type="hidden" name="themeVersionId" value={themeVersionId} />
        <input type="hidden" name="config" value={configJson.value} />

        <Card>
          <CardHeader title="রঙ" description="থিমের মূল প্যালেট" />
          <CardBody className="grid gap-4 sm:grid-cols-3">
            {(
              [
                ["primary", "প্রাইমারি"],
                ["accent", "অ্যাকসেন্ট"],
                ["background", "ব্যাকগ্রাউন্ড"],
                ["surface", "সারফেস"],
                ["text", "টেক্সট"],
                ["muted", "মিউটেড"],
              ] as const
            ).map(([key, label]) => (
              <Field key={key} label={label}>
                <span className="flex items-center gap-2">
                  <input
                    type="color"
                    value={config.colors[key]}
                    onChange={(event) =>
                      setConfig((value) => ({ ...value, colors: { ...value.colors, [key]: event.target.value } }))
                    }
                    className="h-9 w-12 cursor-pointer rounded border border-ink-200"
                  />
                  <Input
                    value={config.colors[key]}
                    onChange={(event) =>
                      setConfig((value) => ({ ...value, colors: { ...value.colors, [key]: event.target.value } }))
                    }
                  />
                </span>
              </Field>
            ))}
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="টাইপোগ্রাফি ও বাটন" />
          <CardBody className="grid gap-4 sm:grid-cols-3">
            <Field label="হেডিং ফন্ট">
              <Select
                value={config.typography.headingFont}
                onChange={(event) =>
                  setConfig((value) => ({
                    ...value,
                    typography: { ...value.typography, headingFont: event.target.value as "sans" | "serif" },
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
                  setConfig((value) => ({
                    ...value,
                    typography: { ...value.typography, bodyFont: event.target.value as "sans" | "serif" },
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
                  setConfig((value) => ({
                    ...value,
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
                  setConfig((value) => ({
                    ...value,
                    typography: { ...value.typography, scale: event.target.value as "compact" | "comfortable" },
                  }))
                }
              >
                <option value="comfortable">Comfortable</option>
                <option value="compact">Compact</option>
              </Select>
            </Field>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="হেডার" description="ঘোষণা বার ও সার্চ" />
          <CardBody className="grid gap-4 sm:grid-cols-2">
            <Field label="স্টাইল">
              <Select
                value={config.header.style}
                onChange={(event) =>
                  setConfig((value) => ({
                    ...value,
                    header: { ...value.header, style: event.target.value as "classic" | "centered" | "minimal" },
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
                  setConfig((value) => ({ ...value, header: { ...value.header, announcement: event.target.value } }))
                }
              />
            </Field>
            <div className="flex items-end gap-6 sm:col-span-2">
              <Checkbox
                checked={config.header.showSearch}
                onChange={(event) =>
                  setConfig((value) => ({ ...value, header: { ...value.header, showSearch: event.target.checked } }))
                }
                label="সার্চ দেখান"
              />
              <Checkbox
                checked={config.header.sticky}
                onChange={(event) =>
                  setConfig((value) => ({ ...value, header: { ...value.header, sticky: event.target.checked } }))
                }
                label="Sticky হেডার"
              />
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="হিরো" />
          <CardBody className="grid gap-4 sm:grid-cols-2">
            <Field label="শিরোনাম" className="sm:col-span-2">
              <Input
                value={config.hero.title}
                onChange={(event) => setConfig((value) => ({ ...value, hero: { ...value.hero, title: event.target.value } }))}
              />
            </Field>
            <Field label="সাবটাইটেল" className="sm:col-span-2">
              <Input
                value={config.hero.subtitle}
                onChange={(event) =>
                  setConfig((value) => ({ ...value, hero: { ...value.hero, subtitle: event.target.value } }))
                }
              />
            </Field>
            <Field label="বাটন লেবেল">
              <Input
                value={config.hero.ctaLabel}
                onChange={(event) =>
                  setConfig((value) => ({ ...value, hero: { ...value.hero, ctaLabel: event.target.value } }))
                }
              />
            </Field>
            <Field label="বাটন লিংক" hint="যেমন: /shop">
              <Input
                value={config.hero.ctaHref}
                onChange={(event) =>
                  setConfig((value) => ({ ...value, hero: { ...value.hero, ctaHref: event.target.value } }))
                }
              />
            </Field>
            <Field label="অ্যালাইনমেন্ট">
              <Select
                value={config.hero.align}
                onChange={(event) =>
                  setConfig((value) => ({ ...value, hero: { ...value.hero, align: event.target.value as "left" | "center" } }))
                }
              >
                <option value="left">বাম</option>
                <option value="center">কেন্দ্রে</option>
              </Select>
            </Field>
            <div className="flex items-end">
              <Checkbox
                checked={config.hero.enabled}
                onChange={(event) => setConfig((value) => ({ ...value, hero: { ...value.hero, enabled: event.target.checked } }))}
                label="হিরো দেখান"
              />
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="প্রোমো ব্যানার ও ট্রাস্ট" />
          <CardBody className="grid gap-4 sm:grid-cols-2">
            <Field label="প্রোমো শিরোনাম">
              <Input
                value={config.promo.title}
                onChange={(event) => setConfig((value) => ({ ...value, promo: { ...value.promo, title: event.target.value } }))}
              />
            </Field>
            <Field label="প্রোমো বাটন লেবেল">
              <Input
                value={config.promo.ctaLabel}
                onChange={(event) =>
                  setConfig((value) => ({ ...value, promo: { ...value.promo, ctaLabel: event.target.value } }))
                }
              />
            </Field>
            <Field label="প্রোমো বাটন লিংক">
              <Input
                value={config.promo.ctaHref}
                onChange={(event) =>
                  setConfig((value) => ({ ...value, promo: { ...value.promo, ctaHref: event.target.value } }))
                }
              />
            </Field>
            <Field label="প্রোমো দেখান">
              <Checkbox
                checked={config.promo.enabled}
                onChange={(event) =>
                  setConfig((value) => ({ ...value, promo: { ...value.promo, enabled: event.target.checked } }))
                }
                label="প্রোমো ব্যানার দেখান"
              />
            </Field>
            <Field label="প্রোমো বর্ণনা" className="sm:col-span-2">
              <Textarea
                value={config.promo.body}
                onChange={(event) => setConfig((value) => ({ ...value, promo: { ...value.promo, body: event.target.value } }))}
              />
            </Field>
            <Field label="ট্রাস্ট আইটেম" hint="একটি লাইনে একটি" className="sm:col-span-2">
              <Textarea
                value={config.trust.items.join("\n")}
                onChange={(event) =>
                  setConfig((value) => ({
                    ...value,
                    trust: { ...value.trust, items: event.target.value.split("\n").map((row) => row.trim()).filter(Boolean) },
                  }))
                }
              />
            </Field>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="ফুটার ও নেভিগেশন" />
          <CardBody className="grid gap-4">
            <Field label="দোকান পরিচিতি">
              <Textarea
                value={config.footer.about}
                onChange={(event) => setConfig((value) => ({ ...value, footer: { ...value.footer, about: event.target.value } }))}
              />
            </Field>
            <Field label="ফুটার নোট">
              <Input
                value={config.footer.note}
                onChange={(event) => setConfig((value) => ({ ...value, footer: { ...value.footer, note: event.target.value } }))}
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

        <Card>
          <CardHeader
            title="সেকশন ক্রম ও দৃশ্যমানতা"
            description="JSON এ ক্রম বদলালে হোমপেজে সেই ক্রমেই দেখাবে"
          />
          <CardBody className="space-y-3">
            <ul className="space-y-1.5 text-sm">
              {config.sections.map((section) => (
                <li key={section.key} className="flex items-center justify-between gap-3 rounded-lg border border-ink-200 px-3 py-2">
                  <span>{SECTION_LABELS[section.key] ?? section.key}</span>
                  <Checkbox
                    checked={section.enabled}
                    label="দেখান"
                    onChange={(event) =>
                      setConfig((value) => ({
                        ...value,
                        sections: value.sections.map((row) =>
                          row.key === section.key ? { ...row, enabled: event.target.checked } : row,
                        ),
                      }))
                    }
                  />
                </li>
              ))}
            </ul>
            <Field label="সেকশন JSON" hint="এখানে ক্রম (order) ঠিক করা যায়">
              <Textarea
                value={sectionsJson}
                onChange={(event) => setSectionsJson(event.target.value)}
                rows={7}
                className="font-mono text-xs"
              />
            </Field>
          </CardBody>
        </Card>

        <div className="flex flex-wrap gap-3">
          <Button type="submit" disabled={savePending || Boolean(configJson.error)}>
            {savePending ? "সংরক্ষণ হচ্ছে…" : "ড্রাফট সংরক্ষণ করুন"}
          </Button>
        </div>
      </form>

      <div className="flex flex-wrap gap-3">
        <form action={publishSubmit}>
          <input type="hidden" name="storeId" value={storeId} />
          <input type="hidden" name="themeVersionId" value={themeVersionId} />
          <Button type="submit" variant="secondary" disabled={publishPending}>
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
          <Button type="submit" variant="outline" disabled={resetPending}>
            {resetPending ? "রিসেট হচ্ছে…" : "ডিফল্টে রিসেট"}
          </Button>
        </form>
      </div>
    </div>
  );
}
