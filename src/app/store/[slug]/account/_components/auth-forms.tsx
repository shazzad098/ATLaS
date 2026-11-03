"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { Loader2 } from "lucide-react";
import { buyerLoginAction, buyerSignupAction } from "@/app/store/[slug]/account/actions";
import { EMPTY_BUYER_STATE } from "@/app/store/[slug]/account/state";

/**
 * Storefront account forms.
 *
 * Both forms are progressively enhanced Server Action forms: they work without
 * JavaScript and use `useActionState` only for the pending label and messages.
 */

const inputClass =
  "h-11 w-full rounded-[var(--store-button-radius)] border border-black/10 bg-white px-3 text-sm outline-none transition focus:border-[var(--store-primary)] focus:ring-2 focus:ring-black/5";

function Field({
  label,
  name,
  type = "text",
  required = true,
  autoComplete,
  placeholder,
  defaultValue,
  value,
  onChange,
  hint,
}: {
  label: string;
  name: string;
  type?: string;
  required?: boolean;
  autoComplete?: string;
  placeholder?: string;
  defaultValue?: string;
  value?: string;
  onChange?: (event: React.ChangeEvent<HTMLInputElement>) => void;
  hint?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium">
        {label}
        {required ? <span className="ml-0.5 text-red-500">*</span> : null}
      </span>
      <input
        className={inputClass}
        name={name}
        type={type}
        required={required}
        autoComplete={autoComplete}
        placeholder={placeholder}
        defaultValue={defaultValue}
        value={value}
        onChange={onChange}
      />
      {hint ? <span className="muted mt-1 block text-[11px]">{hint}</span> : null}
    </label>
  );
}

function Alert({ state }: { state: { ok: boolean; message: string } }) {
  if (!state.message) return null;
  return (
    <p
      role="status"
      className={`rounded-[var(--store-button-radius)] border px-3 py-2 text-xs leading-relaxed ${
        state.ok
          ? "border-emerald-200 bg-emerald-50 text-emerald-800"
          : "border-red-200 bg-red-50 text-red-700"
      }`}
    >
      {state.message}
    </p>
  );
}

export function BuyerLoginForm({ slug, next }: { slug: string; next: string }) {
  const [state, submit, pending] = useActionState(buyerLoginAction, EMPTY_BUYER_STATE);
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");

  return (
    <form action={submit} className="space-y-4">
      <input type="hidden" name="slug" value={slug} />
      <input type="hidden" name="next" value={next} />

      <div>
        <h2 className="text-lg font-semibold">লগইন করুন</h2>
        <p className="muted mt-1 text-xs">মোবাইল নম্বর বা ইমেইল ও পাসওয়ার্ড দিন।</p>
      </div>

      <Alert state={state} />

      <Field
        label="মোবাইল নম্বর বা email"
        name="identifier"
        autoComplete="username"
        placeholder="01712345678 / you@example.com"
        value={identifier}
        onChange={(event) => setIdentifier(event.target.value)}
      />
      <Field
        label="পাসওয়ার্ড"
        name="password"
        type="password"
        autoComplete="current-password"
        placeholder="••••••••"
        value={password}
        onChange={(event) => setPassword(event.target.value)}
      />

      <button
        type="submit"
        disabled={pending}
        className="store-btn inline-flex h-11 w-full items-center justify-center gap-2 bg-[var(--store-primary)] text-sm font-semibold text-white transition hover:brightness-110 disabled:opacity-60"
      >
        {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
        {pending ? "লগইন হচ্ছে…" : "লগইন"}
      </button>

      <p className="muted text-center text-xs">
        নতুন গ্রাহক?{" "}
        <Link
          href={`/store/${slug}/account/signup`}
          className="font-semibold text-[var(--store-primary)] hover:underline"
        >
          অ্যাকাউন্ট খুলুন
        </Link>
      </p>
    </form>
  );
}

export function BuyerSignupForm({ slug }: { slug: string }) {
  const [state, submit, pending] = useActionState(buyerSignupAction, EMPTY_BUYER_STATE);
  const [fields, setFields] = useState({ name: "", phone: "", email: "", password: "" });
  const [code, setCode] = useState("");
  const awaitingCode = state.stage === "code";
  const update = (key: keyof typeof fields) => (event: React.ChangeEvent<HTMLInputElement>) =>
    setFields((prev) => ({ ...prev, [key]: event.target.value }));

  return (
    <form action={submit} className="space-y-4">
      <input type="hidden" name="slug" value={slug} />

      <div>
        <h2 className="text-lg font-semibold">অ্যাকাউন্ট খুলুন</h2>
        <p className="muted mt-1 text-xs">
          মোবাইল নম্বর যাচাই করে অ্যাকাউন্ট তৈরি হবে — অর্ডার ইতিহাস আপনার সাথে থাকবে।
        </p>
      </div>

      <Alert state={state} />

      {/* Kept mounted across stages: remounting would wipe the uncontrolled
          fields the buyer already typed. */}
      <p
        className={`rounded-[var(--store-button-radius)] bg-amber-50 px-3 py-2 text-xs text-amber-800 ${
          state.devCode ? "" : "hidden"
        }`}
      >
        ডেমো মোড: আপনার OTP কোড{" "}
        <strong className="font-mono">{state.devCode ?? ""}</strong>
      </p>

      <Field
        label="নাম"
        name="name"
        autoComplete="name"
        placeholder="আপনার নাম"
        value={fields.name}
        onChange={update("name")}
      />
      <Field
        label="মোবাইল নম্বর"
        name="phone"
        type="tel"
        autoComplete="tel"
        placeholder="01712345678"
        hint="এই নম্বরেই OTP যাবে এবং অর্ডার লিংক থাকবে।"
        value={fields.phone}
        onChange={update("phone")}
      />
      <Field
        label="Email (ঐচ্ছিক)"
        name="email"
        type="email"
        required={false}
        autoComplete="email"
        placeholder="you@example.com"
        value={fields.email}
        onChange={update("email")}
      />
      <Field
        label="পাসওয়ার্ড"
        name="password"
        type="password"
        autoComplete="new-password"
        placeholder="কমপক্ষে ৮ অক্ষর, একটি সংখ্যা সহ"
        value={fields.password}
        onChange={update("password")}
      />

      <label className={`block ${awaitingCode ? "" : "hidden"}`}>
        <span className="mb-1.5 block text-xs font-medium">
          OTP কোড<span className="ml-0.5 text-red-500">*</span>
        </span>
        <input
          className={`${inputClass} text-center font-mono text-lg tracking-[0.4em]`}
          name="code"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          placeholder="৬ সংখ্যার কোড"
          required={awaitingCode}
          value={code}
          onChange={(event) => setCode(event.target.value)}
        />
        <span className="muted mt-1 block text-[11px]">কোড না পেলে আবার “OTP পাঠান” চাপুন।</span>
      </label>

      <button
        type="submit"
        disabled={pending}
        className="store-btn inline-flex h-11 w-full items-center justify-center gap-2 bg-[var(--store-primary)] text-sm font-semibold text-white transition hover:brightness-110 disabled:opacity-60"
      >
        {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
        {pending ? "অপেক্ষা করুন…" : awaitingCode ? "যাচাই করে অ্যাকাউন্ট খুলুন" : "OTP পাঠান"}
      </button>

      <p className="muted text-center text-xs">
        আগে থেকেই অ্যাকাউন্ট আছে?{" "}
        <Link
          href={`/store/${slug}/account/login`}
          className="font-semibold text-[var(--store-primary)] hover:underline"
        >
          লগইন করুন
        </Link>
      </p>
    </form>
  );
}
