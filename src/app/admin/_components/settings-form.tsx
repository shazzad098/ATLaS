"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/shell";
import { Checkbox, Field, Input, Select, Textarea } from "@/components/ui/form";
import {
  addDomainAction,
  updateStoreSettingsAction,
} from "@/app/admin/actions";
import { EMPTY_ADMIN_STATE } from "@/app/admin/state";

/** Store identity, contact, checkout and policy settings (FR-02, FR-07). */

export type StoreSettingsValue = {
  name: string;
  description: string;
  locale: string;
  contactPhone: string;
  contactEmail: string;
  contactWhatsapp: string;
  addressLine1: string;
  addressArea: string;
  addressCity: string;
  addressDistrict: string;
  addressPostcode: string;
  seoTitle: string;
  seoDescription: string;
  seoOgImage: string;
  codAutoConfirm: boolean;
  minOrderTotal: string;
  returnsDays: number;
  returnsText: string;
  privacyText: string;
  termsText: string;
};

export function StoreSettingsForm({ storeId, value }: { storeId: string; value: StoreSettingsValue }) {
  const [state, submit, pending] = useActionState(updateStoreSettingsAction, EMPTY_ADMIN_STATE);

  return (
    <form action={submit} className="space-y-5">
      <input type="hidden" name="storeId" value={storeId} />

      {state.message ? <Alert tone={state.ok ? "success" : "danger"}>{state.message}</Alert> : null}

      <section className="space-y-4">
        <h2 className="text-sm font-semibold text-ink-900">দোকানের পরিচিতি</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="দোকানের নাম" required>
            <Input name="name" defaultValue={value.name} required />
          </Field>
          <Field label="ভাষা">
            <Select name="locale" defaultValue={value.locale}>
              <option value="bn">বাংলা</option>
              <option value="en">English</option>
            </Select>
          </Field>
          <Field label="সংক্ষিপ্ত বিবরণ" className="sm:col-span-2" hint="ফুটার ও SEO-তে ব্যবহৃত হয়">
            <Textarea name="description" defaultValue={value.description} rows={3} />
          </Field>
        </div>
      </section>

      <section className="space-y-4 border-t border-ink-100 pt-5">
        <h2 className="text-sm font-semibold text-ink-900">যোগাযোগ ও ঠিকানা</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="ফোন" required hint="publish করার জন্য আবশ্যক">
            <Input name="contactPhone" defaultValue={value.contactPhone} inputMode="tel" placeholder="01XXXXXXXXX" />
          </Field>
          <Field label="ইমেইল">
            <Input name="contactEmail" type="email" defaultValue={value.contactEmail} />
          </Field>
          <Field label="WhatsApp">
            <Input name="contactWhatsapp" defaultValue={value.contactWhatsapp} inputMode="tel" />
          </Field>
          <Field label="ঠিকানা (লাইন ১)">
            <Input name="addressLine1" defaultValue={value.addressLine1} />
          </Field>
          <Field label="এলাকা">
            <Input name="addressArea" defaultValue={value.addressArea} />
          </Field>
          <Field label="শহর">
            <Input name="addressCity" defaultValue={value.addressCity} />
          </Field>
          <Field label="জেলা">
            <Input name="addressDistrict" defaultValue={value.addressDistrict} />
          </Field>
          <Field label="পোস্ট কোড">
            <Input name="addressPostcode" defaultValue={value.addressPostcode} />
          </Field>
        </div>
      </section>

      <section className="space-y-4 border-t border-ink-100 pt-5">
        <h2 className="text-sm font-semibold text-ink-900">চেকআউট</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="সর্বনিম্ন অর্ডার (৳)" hint="০ মানে কোনো সীমা নেই">
            <Input name="minOrderTotal" type="number" min={0} step="0.01" defaultValue={value.minOrderTotal} />
          </Field>
          <div className="flex items-end">
            <Checkbox
              name="codAutoConfirm"
              defaultChecked={value.codAutoConfirm}
              label="ক্যাশ অন ডেলিভারি অর্ডার স্বয়ংক্রিয়ভাবে confirm করুন"
            />
          </div>
        </div>
      </section>

      <section className="space-y-4 border-t border-ink-100 pt-5">
        <h2 className="text-sm font-semibold text-ink-900">SEO</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="SEO শিরোনাম">
            <Input name="seoTitle" defaultValue={value.seoTitle} />
          </Field>
          <Field label="OG ইমেজ URL">
            <Input name="seoOgImage" defaultValue={value.seoOgImage} />
          </Field>
          <Field label="SEO বিবরণ" className="sm:col-span-2">
            <Textarea name="seoDescription" defaultValue={value.seoDescription} rows={2} />
          </Field>
        </div>
      </section>

      <section className="space-y-4 border-t border-ink-100 pt-5">
        <h2 className="text-sm font-semibold text-ink-900">নীতি</h2>
        <div className="grid gap-4">
          <Field label="রিটার্ন সময়সীমা (দিন)">
            <Input name="returnsDays" type="number" min={0} max={365} defaultValue={String(value.returnsDays)} />
          </Field>
          <Field label="রিটার্ন নীতি">
            <Textarea name="returnsText" defaultValue={value.returnsText} rows={3} />
          </Field>
          <Field label="প্রাইভেসি নীতি">
            <Textarea name="privacyText" defaultValue={value.privacyText} rows={3} />
          </Field>
          <Field label="শর্তাবলী">
            <Textarea name="termsText" defaultValue={value.termsText} rows={3} />
          </Field>
        </div>
      </section>

      <div className="border-t border-ink-100 pt-4">
        <Button type="submit" disabled={pending}>
          {pending ? "সংরক্ষণ হচ্ছে…" : "সেটিংস সংরক্ষণ করুন"}
        </Button>
      </div>
    </form>
  );
}

/** Add a custom domain (FR-03). Plan gating is enforced server-side. */
export function DomainAddForm({ storeId, hint }: { storeId: string; hint?: string }) {
  const [state, submit, pending] = useActionState(addDomainAction, EMPTY_ADMIN_STATE);

  return (
    <form action={submit} className="space-y-3">
      <input type="hidden" name="storeId" value={storeId} />
      {state.message ? <Alert tone={state.ok ? "success" : "danger"}>{state.message}</Alert> : null}
      <Field label="নতুন ডোমেইন" hint={hint ?? "যেমন: shop.example.com"}>
        <Input name="host" placeholder="shop.example.com" />
      </Field>
      <Button type="submit" variant="outline" size="sm" disabled={pending}>
        {pending ? "যোগ হচ্ছে…" : "ডোমেইন যোগ করুন"}
      </Button>
    </form>
  );
}
