"use client";

import { useActionState, useMemo, useState } from "react";
import { CreditCard, Lock, ShieldCheck, Truck } from "lucide-react";
import { Checkbox, Field, Input, Select, Textarea } from "@/components/ui/form";
import { Alert } from "@/components/ui/shell";
import { formatBdt } from "@/lib/money";
import { submitCheckoutAction } from "@/app/store/[slug]/actions";
import { EMPTY_ACTION_STATE } from "@/app/store/[slug]/state";
import { Surface } from "@/app/store/[slug]/_components/storefront-ui";

/**
 * Checkout form (FR-05).
 *
 * Shipping shown here mirrors `priceCart` so the shopper sees the right total
 * while choosing a zone; the server re-prices on submit, which is authoritative.
 */

export type CheckoutZone = { id: string; name: string; charge: string; freeAbove: string | null };
export type CheckoutProvider = { value: string; label: string; note: string };
export type CheckoutDefaults = {
  name?: string;
  phone?: string;
  email?: string;
  address?: {
    line1?: string;
    line2?: string;
    area?: string;
    city?: string;
    district?: string;
    postcode?: string;
  };
};

const control =
  "h-11 rounded-xl border-black/10 bg-white text-sm focus:border-[var(--store-primary)] focus:ring-[var(--store-primary)]/15";

function Section({
  step,
  title,
  description,
  children,
}: {
  step: number;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <Surface className="p-5 sm:p-6">
      <div className="flex items-start gap-3">
        <span
          className="grid h-7 w-7 shrink-0 place-items-center rounded-full text-[11px] font-bold text-white"
          style={{ background: "var(--store-primary)" }}
        >
          {step}
        </span>
        <div>
          <h2 className="text-sm font-semibold">{title}</h2>
          <p className="muted mt-0.5 text-[11px]">{description}</p>
        </div>
      </div>
      <div className="mt-4 space-y-4">{children}</div>
    </Surface>
  );
}

export function CheckoutForm({
  slug,
  storeId,
  subtotal,
  discountTotal,
  taxTotal,
  taxMode,
  taxRatePercent,
  couponCode,
  zones,
  providers,
  idempotencyKey,
  defaults,
}: {
  slug: string;
  storeId: string;
  subtotal: string;
  discountTotal: string;
  taxTotal: string;
  taxMode: "INCLUSIVE" | "EXCLUSIVE" | "NONE";
  taxRatePercent: number;
  couponCode: string | null;
  zones: CheckoutZone[];
  providers: CheckoutProvider[];
  idempotencyKey: string;
  defaults?: CheckoutDefaults;
}) {
  const [state, formAction, pending] = useActionState(submitCheckoutAction, EMPTY_ACTION_STATE);
  const [zoneId, setZoneId] = useState(zones[0]?.id ?? "");
  const [provider, setProvider] = useState(providers[0]?.value ?? "COD");

  const net = Number(subtotal) - Number(discountTotal);

  const shipping = useMemo(() => {
    const zone = zones.find((entry) => entry.id === zoneId);
    if (!zone) return 0;
    if (zone.freeAbove !== null && net >= Number(zone.freeAbove)) return 0;
    return Number(zone.charge);
  }, [zones, zoneId, net]);

  // The server sends the discounted-merchandise tax, so changing the delivery
  // zone cannot change the tax amount in this preview.
  const tax = Number(taxTotal);
  const grandTotal = net + shipping + (taxMode === "EXCLUSIVE" ? tax : 0);
  const activeProvider = providers.find((entry) => entry.value === provider);

  return (
    <form action={formAction} className="mt-6 grid gap-6 lg:grid-cols-[1.55fr_1fr] lg:items-start">
      <input type="hidden" name="slug" value={slug} />
      <input type="hidden" name="storeId" value={storeId} />
      <input type="hidden" name="idempotencyKey" value={idempotencyKey} />
      <input type="hidden" name="zoneId" value={zoneId} />
      <input type="hidden" name="paymentProvider" value={provider} />

      <div className="space-y-4">
        {state.message && !state.ok ? <Alert tone="danger">{state.message}</Alert> : null}

        <Section
          step={1}
          title="যোগাযোগের তথ্য"
          description="অর্ডার আপডেট ও ডেলিভারির জন্য এই তথ্য ব্যবহার হবে।"
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="নাম" required>
              <Input
                name="customerName"
                required
                autoComplete="name"
                placeholder="আপনার নাম"
                defaultValue={defaults?.name}
                className={control}
              />
            </Field>
            <Field label="মোবাইল নম্বর" required hint="যেমন: 017XXXXXXXX">
              <Input
                name="customerPhone"
                required
                inputMode="tel"
                autoComplete="tel"
                placeholder="01XXXXXXXXX"
                defaultValue={defaults?.phone}
                className={control}
              />
            </Field>
          </div>
          <Field label="ইমেইল (ঐচ্ছিক)">
            <Input
              name="customerEmail"
              type="email"
              autoComplete="email"
              placeholder="you@example.com"
              defaultValue={defaults?.email}
              className={control}
            />
          </Field>
        </Section>

        <Section
          step={2}
          title="ডেলিভারি ঠিকানা"
          description="যেখানে পণ্য পৌঁছাতে হবে সেই ঠিকানাটি দিন।"
        >
          <Field label="ঠিকানা" required>
            <Input
              name="addressLine1"
              required
              placeholder="বাসা/রোড/এলাকা"
              autoComplete="address-line1"
              defaultValue={defaults?.address?.line1}
              className={control}
            />
          </Field>
          <Field label="অতিরিক্ত ঠিকানা (ঐচ্ছিক)">
            <Input
              name="addressLine2"
              placeholder="ফ্ল্যাট, তলা ইত্যাদি"
              autoComplete="address-line2"
              defaultValue={defaults?.address?.line2}
              className={control}
            />
          </Field>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="থানা / উপজেলা">
              <Input
                name="addressArea"
                placeholder="যেমন: ধানমন্ডি"
                defaultValue={defaults?.address?.area}
                className={control}
              />
            </Field>
            <Field label="শহর / জেলা" required>
              <Input
                name="addressCity"
                required
                placeholder="যেমন: ঢাকা"
                autoComplete="address-level2"
                defaultValue={defaults?.address?.city}
                className={control}
              />
            </Field>
            <Field label="পোস্ট কোড (ঐচ্ছিক)">
              <Input
                name="addressPostcode"
                placeholder="1209"
                autoComplete="postal-code"
                defaultValue={defaults?.address?.postcode}
                className={control}
              />
            </Field>
          </div>
          <Field label="বিভাগ (ঐচ্ছিক)">
            <Input
              name="addressDistrict"
              placeholder="যেমন: ঢাকা"
              defaultValue={defaults?.address?.district}
              className={control}
            />
          </Field>

          {zones.length > 1 ? (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-ink-600">ডেলিভারি এলাকা</p>
              <Select
                value={zoneId}
                onChange={(event) => setZoneId(event.target.value)}
                aria-label="ডেলিভারি এলাকা"
                className={control}
              >
                {zones.map((zone) => (
                  <option key={zone.id} value={zone.id}>
                    {zone.name} —{" "}
                    {zone.freeAbove
                      ? `${formatBdt(zone.freeAbove)} এর উপরে ফ্রি`
                      : formatBdt(zone.charge)}
                  </option>
                ))}
              </Select>
            </div>
          ) : null}

          <Field label="অর্ডার নোট (ঐচ্ছিক)">
            <Textarea
              name="notes"
              placeholder="ডেলিভারি সংক্রান্ত নির্দেশনা"
              className="rounded-xl border-black/10 bg-white focus:border-[var(--store-primary)] focus:ring-[var(--store-primary)]/15"
            />
          </Field>
        </Section>

        <Section
          step={3}
          title="পেমেন্ট"
          description="পেমেন্ট মাধ্যম বেছে নিন। গেটওয়ে নির্বাচন করলে পরের ধাপে পাঠানো হবে।"
        >
          <div className="space-y-2">
            {providers.map((entry) => {
              const selected = provider === entry.value;
              return (
                <label
                  key={entry.value}
                  className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3.5 transition ${
                    selected
                      ? "tone-surface"
                      : "border-black/10 bg-white hover:border-black/20"
                  }`}
                  style={selected ? { borderColor: "var(--store-primary)" } : undefined}
                >
                  <input
                    type="radio"
                    name="providerChoice"
                    value={entry.value}
                    checked={selected}
                    onChange={() => setProvider(entry.value)}
                    className="mt-0.5 h-4 w-4 accent-[var(--store-primary)]"
                  />
                  <span className="flex min-w-0 flex-1 items-start justify-between gap-2">
                    <span>
                      <span className="block text-sm font-semibold">{entry.label}</span>
                      <span className="muted mt-0.5 block text-[11px]">{entry.note}</span>
                    </span>
                    <CreditCard className="muted mt-0.5 h-4 w-4 shrink-0" />
                  </span>
                </label>
              );
            })}
          </div>
          {activeProvider?.value !== "COD" ? (
            <p className="muted text-[11px]">
              সাবমিট করার পর আপনাকে পেমেন্ট গেটওয়েতে নিয়ে যাওয়া হবে।
            </p>
          ) : null}
        </Section>
      </div>

      <Surface className="h-fit p-5 lg:sticky lg:top-24">
        <h2 className="text-base font-semibold">অর্ডার সারসংক্ষেপ</h2>
        <dl className="mt-4 space-y-2.5 border-t border-black/[0.06] pt-4 text-sm">
          <div className="flex justify-between gap-3">
            <dt className="muted">সাবটোটাল</dt>
            <dd className="font-medium">{formatBdt(subtotal)}</dd>
          </div>
          {Number(discountTotal) > 0 ? (
            <div className="flex justify-between gap-3">
              <dt className="muted">ছাড়{couponCode ? ` (${couponCode})` : ""}</dt>
              <dd className="font-medium">− {formatBdt(discountTotal)}</dd>
            </div>
          ) : null}
          <div className="flex justify-between gap-3">
            <dt className="muted">ডেলিভারি চার্জ</dt>
            <dd className="font-medium">{shipping === 0 ? "ফ্রি" : formatBdt(shipping)}</dd>
          </div>
          {tax > 0 ? (
            <div className="flex justify-between gap-3">
              <dt className="muted">
                ভ্যাট ({taxRatePercent}%{taxMode === "INCLUSIVE" ? ", অন্তর্ভুক্ত" : ""})
              </dt>
              <dd className="font-medium">{formatBdt(taxTotal)}</dd>
            </div>
          ) : null}
          <div className="flex items-baseline justify-between border-t border-black/[0.06] pt-3">
            <dt className="text-sm font-semibold">সর্বমোট</dt>
            <dd className="text-xl font-bold" style={{ color: "var(--store-primary)" }}>
              {formatBdt(grandTotal)}
            </dd>
          </div>
        </dl>

        <div className="mt-4 border-t border-black/[0.06] pt-4">
          <Checkbox
            name="acceptTerms"
            defaultChecked
            label="শর্তাবলী ও রিটার্ন নীতি মেনে নিচ্ছি।"
            className="text-[11px]"
          />
        </div>

        <button
          type="submit"
          disabled={pending}
          className="store-btn mt-4 flex w-full items-center justify-center gap-2 px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:brightness-110 disabled:opacity-60"
          style={{ background: "var(--store-primary)" }}
        >
          <Lock className="h-4 w-4" />
          {pending ? "অর্ডার প্রক্রিয়া চলছে…" : "অর্ডার নিশ্চিত করুন"}
        </button>

        <div className="muted mt-4 space-y-2 border-t border-black/[0.06] pt-4 text-[11px]">
          <span className="flex items-center gap-2">
            <ShieldCheck className="h-3.5 w-3.5" style={{ color: "var(--store-primary)" }} />
            নিরাপদ চেকআউট
          </span>
          <span className="flex items-center gap-2">
            <Truck className="h-3.5 w-3.5" style={{ color: "var(--store-primary)" }} />
            ডেলিভারি চার্জ উপরে দেখানো হয়েছে
          </span>
        </div>
      </Surface>
    </form>
  );
}
