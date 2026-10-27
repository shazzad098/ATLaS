"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/shell";
import { Checkbox, Field, Input, Select, Textarea } from "@/components/ui/form";
import { createFirstStoreAction } from "@/app/onboarding/actions";
import { EMPTY_ONBOARDING_STATE } from "@/app/onboarding/state";

/** Onboarding form: store identity + first theme (FR-02). */

export type OnboardingTheme = {
  code: string;
  name: string;
  description: string;
  style: string;
  gradient: string;
  swatches: string[];
};

export function OnboardingForm({
  ownerName,
  themes,
  next = "/admin",
}: {
  ownerName: string;
  themes: OnboardingTheme[];
  next?: string;
}) {
  const [state, submit, pending] = useActionState(createFirstStoreAction, EMPTY_ONBOARDING_STATE);
  const [themeCode, setThemeCode] = useState(themes[0]?.code ?? "nokshi");

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-brand-700">ধাপ ২ / ২</p>
        <h1 className="text-2xl font-semibold">
          {ownerName ? `${ownerName}, আপনার দোকানের নাম দিন` : "আপনার দোকানের নাম দিন"}
        </h1>
        <p className="text-sm text-ink-500">
          পরে যেকোনো সময় নাম, থিম আর সেটিংস বদলাতে পারবেন।
        </p>
      </header>

      {state.message ? <Alert tone="danger">{state.message}</Alert> : null}

      <form action={submit} className="space-y-6">
        <input type="hidden" name="next" value={next} />
        <div className="space-y-4 rounded-xl border border-ink-200 bg-white p-5">
          <Field label="দোকানের নাম" required hint="যেমন: নকশি বুটিক">
            <Input name="name" required placeholder="আপনার দোকানের নাম" />
          </Field>

          <Field label="দোকানের ঠিকানা (slug)" hint="খালি রাখলে নাম থেকে তৈরি হবে">
            <Input name="slug" placeholder="nokshi-boutique" />
          </Field>

          <Field label="সংক্ষিপ্ত পরিচিতি">
            <Textarea name="description" placeholder="আপনার দোকান কী বিক্রি করে, এক লাইনে।" />
          </Field>

          <Field label="ডিফল্ট ভাষা">
            <Select name="locale" defaultValue="bn">
              <option value="bn">বাংলা</option>
              <option value="en">English</option>
            </Select>
          </Field>
        </div>

        <fieldset className="space-y-3">
          <legend className="text-sm font-semibold">প্রথম থিম বাছুন</legend>
          <input type="hidden" name="themeCode" value={themeCode} />
          <div className="grid gap-3 sm:grid-cols-3">
            {themes.map((theme) => {
              const active = theme.code === themeCode;
              return (
                <button
                  key={theme.code}
                  type="button"
                  onClick={() => setThemeCode(theme.code)}
                  className={`overflow-hidden rounded-xl border text-left transition ${
                    active ? "border-brand-500 ring-2 ring-brand-500/25" : "border-ink-200 hover:border-ink-300"
                  }`}
                >
                  <span className={`block h-20 bg-gradient-to-br ${theme.gradient}`}>
                    <span className="flex h-full items-end gap-1 p-2">
                      {theme.swatches.map((swatch) => (
                        <span
                          key={swatch}
                          className="h-4 w-4 rounded-full border border-white/60"
                          style={{ background: swatch }}
                        />
                      ))}
                    </span>
                  </span>
                  <span className="block space-y-1 p-3">
                    <span className="block text-sm font-semibold text-ink-900">{theme.name}</span>
                    <span className="block text-[11px] text-ink-500">{theme.style}</span>
                  </span>
                </button>
              );
            })}
          </div>
          <p className="text-xs text-ink-500">
            {themes.find((theme) => theme.code === themeCode)?.description}
          </p>
        </fieldset>

        <Checkbox name="acceptTerms" defaultChecked label="আমি শর্তাবলী মেনে নিচ্ছি।" />

        <Button type="submit" size="lg" disabled={pending} className="w-full">
          {pending ? "দোকান তৈরি হচ্ছে…" : "দোকান তৈরি করুন"}
        </Button>
      </form>
    </div>
  );
}
