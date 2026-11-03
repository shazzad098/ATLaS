"use client";

import { useActionState, useCallback, useRef, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/shell";
import { Checkbox, Field, Input } from "@/components/ui/form";
import { signupAction } from "@/app/(auth)/actions";
import { EMPTY_AUTH_STATE, type AuthState } from "@/app/(auth)/state";

/** Signup: details → OTP → account (FR-01). */

type SignupDraft = {
  name: string;
  phone: string;
  email: string;
  password: string;
};

const EMPTY_DRAFT: SignupDraft = { name: "", phone: "", email: "", password: "" };

export function SignupForm() {
  const [draft, setDraft] = useState<SignupDraft>(EMPTY_DRAFT);
  const draftRef = useRef<SignupDraft>(EMPTY_DRAFT);

  const boundAction = useCallback(async (prev: AuthState, formData: FormData) => {
    const current = draftRef.current;
    const next: SignupDraft = {
      name: String(formData.get("name") ?? "").trim() || current.name,
      phone: String(formData.get("phone") ?? "").trim() || current.phone,
      email: String(formData.get("email") ?? "").trim() || current.email,
      password: String(formData.get("password") ?? "") || current.password,
    };
    draftRef.current = next;
    setDraft(next);
    return signupAction(prev, formData);
  }, []);

  const [state, submit, pending] = useActionState(boundAction, EMPTY_AUTH_STATE);
  const inOtpStep = state.step === "otp";
  const name = state.name || draft.name;
  const phone = state.identifier || draft.phone;
  const email = state.email || draft.email;
  const password = draft.password;

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold">অ্যাকাউন্ট খুলুন</h1>
        <p className="text-sm text-ink-500">মোবাইল নম্বর যাচাই করে মিনিটেই আপনার দোকান শুরু করুন।</p>
      </div>

      {state.message ? <Alert tone={state.ok ? "success" : "danger"}>{state.message}</Alert> : null}

      <form action={submit} className="space-y-4">
        {inOtpStep ? (
          <>
            {/*
              Server actions reset the form after submit. Identity fields live in
              action state (and the password in React state) so a remount cannot
              send an empty phone and look like an expired OTP.
            */}
            <input type="hidden" name="name" value={name} />
            <input type="hidden" name="phone" value={phone} />
            <input type="hidden" name="email" value={email} />
            <input type="hidden" name="acceptTerms" value="on" />
            {password ? <input type="hidden" name="password" value={password} /> : null}

            <Field label="আপনার নাম">
              <Input value={name} readOnly autoComplete="name" />
            </Field>
            <Field label="মোবাইল নম্বর">
              <Input value={phone} readOnly autoComplete="username" />
            </Field>
            <Field label="OTP কোড" required hint="মোবাইলে পাঠানো ৬ ডিজিটের কোড — ৫ মিনিটের মধ্যে দিন">
              <Input name="code" required inputMode="numeric" maxLength={6} placeholder="123456" autoFocus autoComplete="one-time-code" />
            </Field>
            {!password ? (
              <Field label="পাসওয়ার্ড" required hint="যাচাইয়ের জন্য পাসওয়ার্ডটি আবার দিন">
                <Input name="password" type="password" required autoComplete="new-password" placeholder="••••••••" />
              </Field>
            ) : null}
          </>
        ) : (
          <>
            <Field label="আপনার নাম" required>
              <Input name="name" required placeholder="যেমন: রহিম উদ্দিন" defaultValue={name} autoComplete="name" />
            </Field>
            <Field label="মোবাইল নম্বর" required hint="বাংলাদেশি নম্বর, যেমন 017XXXXXXXX">
              <Input name="phone" required inputMode="tel" placeholder="01XXXXXXXXX" defaultValue={draft.phone} autoComplete="username" />
            </Field>
            <Field label="ইমেইল (ঐচ্ছিক)">
              <Input name="email" type="email" placeholder="you@example.com" defaultValue={email} autoComplete="email" />
            </Field>
            <Field label="পাসওয়ার্ড" required hint="কমপক্ষে ৮ অক্ষর, একটি অক্ষর ও একটি সংখ্যা">
              <Input name="password" type="password" required autoComplete="new-password" placeholder="••••••••" />
            </Field>
            <Checkbox
              name="acceptTerms"
              label={
                <>
                  আমি <span className="font-medium">শর্তাবলী</span> ও{" "}
                  <span className="font-medium">প্রাইভেসি নীতি</span> মেনে নিচ্ছি।
                </>
              }
            />
          </>
        )}

        <Button type="submit" name="intent" value={inOtpStep ? "verify" : "request"} disabled={pending} className="w-full">
          {pending ? "অপেক্ষা করুন…" : inOtpStep ? "যাচাই করে অ্যাকাউন্ট খুলুন" : "OTP পাঠান"}
        </Button>
        {inOtpStep ? (
          <button
            type="submit"
            name="intent"
            value="request"
            disabled={pending}
            className="w-full text-center text-xs font-medium text-brand-700 hover:underline"
          >
            নতুন OTP পাঠান
          </button>
        ) : null}
      </form>

      <p className="text-center text-sm text-ink-600">
        আগেই অ্যাকাউন্ট আছে?{" "}
        <Link href="/login" className="font-semibold text-brand-700 hover:underline">
          লগইন করুন
        </Link>
      </p>
    </div>
  );
}
