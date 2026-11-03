"use client";

import { useActionState } from "react";
import { Loader2 } from "lucide-react";
import {
  changeBuyerPasswordAction,
  updateBuyerProfileAction,
} from "@/app/store/[slug]/account/actions";
import { EMPTY_BUYER_STATE } from "@/app/store/[slug]/account/state";
import type { BuyerAccount } from "@/lib/services/customer-account";

const fieldClass =
  "h-10 w-full rounded-[var(--store-button-radius)] border border-black/10 bg-white px-3 text-sm outline-none transition focus:border-[var(--store-primary)] focus:ring-2 focus:ring-black/5";

function Field({
  label,
  name,
  type = "text",
  defaultValue,
  required,
  placeholder,
  autoComplete,
  disabled,
}: {
  label: string;
  name: string;
  type?: string;
  defaultValue?: string;
  required?: boolean;
  placeholder?: string;
  autoComplete?: string;
  disabled?: boolean;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] font-medium">{label}</span>
      <input
        className={fieldClass}
        name={name}
        type={type}
        defaultValue={defaultValue}
        required={required}
        placeholder={placeholder}
        autoComplete={autoComplete}
        disabled={disabled}
      />
    </label>
  );
}

function Message({ ok, message }: { ok: boolean; message: string }) {
  if (!message) return null;
  return <p className={`text-[11px] ${ok ? "text-emerald-700" : "text-red-600"}`}>{message}</p>;
}

export function BuyerProfileForm({
  slug,
  account,
}: {
  slug: string;
  account: BuyerAccount;
}) {
  const [state, submit, pending] = useActionState(updateBuyerProfileAction, EMPTY_BUYER_STATE);

  return (
    <form action={submit} className="space-y-4">
      <input type="hidden" name="slug" value={slug} />

      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="নাম" name="name" defaultValue={account.name} required autoComplete="name" />
        <Field
          label="Email"
          name="email"
          type="email"
          defaultValue={account.email ?? ""}
          autoComplete="email"
        />
        <Field label="মোবাইল নম্বর" name="phone" defaultValue={account.phone} disabled />
      </div>

      <div className="border-t border-black/5 pt-4">
        <p className="text-[11px] font-semibold">ডেলিভারি ঠিকানা</p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Field
              label="ঠিকানা লাইন ১"
              name="line1"
              defaultValue={account.address.line1 ?? ""}
              placeholder="বাসা/রোড"
              autoComplete="address-line1"
            />
          </div>
          <div className="sm:col-span-2">
            <Field
              label="ঠিকানা লাইন ২"
              name="line2"
              defaultValue={account.address.line2 ?? ""}
              placeholder="এলাকা/ল্যান্ডমার্ক"
              autoComplete="address-line2"
            />
          </div>
          <Field label="এলাকা" name="area" defaultValue={account.address.area ?? ""} />
          <Field label="শহর" name="city" defaultValue={account.address.city ?? ""} autoComplete="address-level2" />
          <Field label="জেলা" name="district" defaultValue={account.address.district ?? ""} />
          <Field label="পোস্টকোড" name="postcode" defaultValue={account.address.postcode ?? ""} autoComplete="postal-code" />
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="store-btn inline-flex items-center gap-2 bg-[var(--store-primary)] px-4 py-2 text-xs font-semibold text-white disabled:opacity-60"
        >
          {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
          প্রোফাইল সংরক্ষণ করুন
        </button>
        <Message ok={state.ok} message={state.message} />
      </div>
    </form>
  );
}

export function BuyerPasswordForm({ slug }: { slug: string }) {
  const [state, submit, pending] = useActionState(changeBuyerPasswordAction, EMPTY_BUYER_STATE);

  return (
    <form action={submit} className="space-y-3">
      <input type="hidden" name="slug" value={slug} />
      <Field label="বর্তমান পাসওয়ার্ড" name="currentPassword" type="password" required autoComplete="current-password" />
      <Field label="নতুন পাসওয়ার্ড" name="newPassword" type="password" required autoComplete="new-password" />
      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="store-btn inline-flex items-center gap-2 border border-black/10 px-4 py-2 text-xs font-semibold hover:border-black/25 disabled:opacity-60"
        >
          {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
          পাসওয়ার্ড বদলান
        </button>
        <Message ok={state.ok} message={state.message} />
      </div>
    </form>
  );
}
