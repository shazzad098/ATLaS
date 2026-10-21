"use client";

import { useActionState, useMemo, useState } from "react";
import { Checkbox, Field, Input, Select, Textarea } from "@/components/ui/form";
import { Alert } from "@/components/ui/shell";
import { formatBdt } from "@/lib/money";
import { submitCheckoutAction } from "@/app/store/[slug]/actions";
import { EMPTY_ACTION_STATE } from "@/app/store/[slug]/state";

/**
 * Checkout form (FR-05).
 *
 * Shipping shown here mirrors `priceCart` so the shopper sees the right total
 * while choosing a zone; the server re-prices on submit, which is authoritative.
 */

export type CheckoutZone = { id: string; name: string; charge: string; freeAbove: string | null };
export type CheckoutProvider = { value: string; label: string; note: string };

export function CheckoutForm({
  slug,
  storeId,
  subtotal,
  discountTotal,
  couponCode,
  zones,
  providers,
  idempotencyKey,
}: {
  slug: string;
  storeId: string;
  subtotal: string;
  discountTotal: string;
  couponCode: string | null;
  zones: CheckoutZone[];
  providers: CheckoutProvider[];
  idempotencyKey: string;
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

  const grandTotal = net + shipping;
  const activeProvider = providers.find((entry) => entry.value === provider);

  return (
    <form action={formAction} className="grid gap-8 lg:grid-cols-[1.6fr_1fr]">
      <input type="hidden" name="slug" value={slug} />
      <input type="hidden" name="storeId" value={storeId} />
      <input type="hidden" name="idempotencyKey" value={idempotencyKey} />
      <input type="hidden" name="zoneId" value={zoneId} />
      <input type="hidden" name="paymentProvider" value={provider} />

      <div className="space-y-6">
        {state.message && !state.ok ? <Alert tone="danger">{state.message}</Alert> : null}

        <section className="space-y-4 rounded-xl border border-black/10 p-5">
          <h2 className="text-base font-semibold">যোগাযোগের তথ্য</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="নাম" required>
              <Input name="customerName" required autoComplete="name" placeholder="আপনার নাম" />
            </Field>
            <Field label="মোবাইল নম্বর" required hint="যেমন: 017XXXXXXXX">
              <Input name="customerPhone" required inputMode="tel" autoComplete="tel" placeholder="01XXXXXXXXX" />
            </Field>
          </div>
          <Field label="ইমেইল (ঐচ্ছিক)">
            <Input name="customerEmail" type="email" autoComplete="email" placeholder="you@example.com" />
          </Field>
        </section>

        <section className="space-y-4 rounded-xl border border-black/10 p-5">
          <h2 className="text-base font-semibold">ডেলিভারি ঠিকানা</h2>
          <Field label="ঠিকানা" required>
            <Input name="addressLine1" required placeholder="বাসা/রোড/এলাকা" autoComplete="address-line1" />
          </Field>
          <Field label="অতিরিক্ত ঠিকানা (ঐচ্ছিক)">
            <Input name="addressLine2" placeholder="ফ্ল্যাট, তলা ইত্যাদি" autoComplete="address-line2" />
          </Field>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="থানা / উপজেলা">
              <Input name="addressArea" placeholder="যেমন: ধানমন্ডি" />
            </Field>
            <Field label="শহর / জেলা" required>
              <Input name="addressCity" required placeholder="যেমন: ঢাকা" autoComplete="address-level2" />
            </Field>
            <Field label="পোস্ট কোড (ঐচ্ছিক)">
              <Input name="addressPostcode" placeholder="1209" autoComplete="postal-code" />
            </Field>
          </div>
          <Field label="বিভাগ (ঐচ্ছিক)">
            <Input name="addressDistrict" placeholder="যেমন: ঢাকা" />
          </Field>

          {zones.length > 1 ? (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-ink-600">ডেলিভারি এলাকা</p>
              <Select
                value={zoneId}
                onChange={(event) => setZoneId(event.target.value)}
                aria-label="ডেলিভারি এলাকা"
              >
                {zones.map((zone) => (
                  <option key={zone.id} value={zone.id}>
                    {zone.name} — {zone.freeAbove ? `${formatBdt(zone.freeAbove)} এর উপরে ফ্রি` : formatBdt(zone.charge)}
                  </option>
                ))}
              </Select>
            </div>
          ) : null}

          <Field label="অর্ডার নোট (ঐচ্ছিক)">
            <Textarea name="notes" placeholder="ডেলিভারি সংক্রান্ত নির্দেশনা" />
          </Field>
        </section>

        <section className="space-y-3 rounded-xl border border-black/10 p-5">
          <h2 className="text-base font-semibold">পেমেন্ট</h2>
          <div className="space-y-2">
            {providers.map((entry) => (
              <label
                key={entry.value}
                className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition ${
                  provider === entry.value ? "border-transparent tone-surface" : "border-black/10"
                }`}
              >
                <input
                  type="radio"
                  name="providerChoice"
                  value={entry.value}
                  checked={provider === entry.value}
                  onChange={() => setProvider(entry.value)}
                  className="mt-0.5"
                />
                <span>
                  <span className="block text-sm font-medium">{entry.label}</span>
                  <span className="muted block text-xs">{entry.note}</span>
                </span>
              </label>
            ))}
          </div>
          {activeProvider?.value !== "COD" ? (
            <p className="muted text-xs">
              সাবমিট করার পর আপনাকে পেমেন্ট গেটওয়েতে নিয়ে যাওয়া হবে।
            </p>
          ) : null}
        </section>
      </div>

      <aside className="h-fit space-y-4 rounded-xl border border-black/10 p-5">
        <h2 className="text-base font-semibold">অর্ডার সারসংক্ষেপ</h2>
        <dl className="space-y-2 text-sm">
          <div className="flex justify-between">
            <dt className="muted">সাবটোটাল</dt>
            <dd className="font-medium">{formatBdt(subtotal)}</dd>
          </div>
          {Number(discountTotal) > 0 ? (
            <div className="flex justify-between">
              <dt className="muted">ছাড়{couponCode ? ` (${couponCode})` : ""}</dt>
              <dd className="font-medium">− {formatBdt(discountTotal)}</dd>
            </div>
          ) : null}
          <div className="flex justify-between">
            <dt className="muted">ডেলিভারি চার্জ</dt>
            <dd className="font-medium">{shipping === 0 ? "ফ্রি" : formatBdt(shipping)}</dd>
          </div>
          <div className="flex items-baseline justify-between border-t border-black/10 pt-3">
            <dt className="text-sm font-semibold">সর্বমোট</dt>
            <dd className="text-lg font-bold" style={{ color: "var(--store-primary)" }}>
              {formatBdt(grandTotal)}
            </dd>
          </div>
        </dl>

        <Checkbox name="acceptTerms" defaultChecked label="শর্তাবলী ও রিটার্ন নীতি মেনে নিচ্ছি।" />

        <button
          type="submit"
          disabled={pending}
          className="store-btn w-full px-6 py-3 text-sm font-semibold text-white disabled:opacity-60"
          style={{ background: "var(--store-primary)" }}
        >
          {pending ? "অর্ডার প্রক্রিয়া চলছে…" : "অর্ডার নিশ্চিত করুন"}
        </button>
      </aside>
    </form>
  );
}
