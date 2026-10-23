"use client";

import { useActionState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/shell";
import { Checkbox, Field, Input } from "@/components/ui/form";
import { signupAction } from "@/app/(auth)/actions";
import { EMPTY_AUTH_STATE } from "@/app/(auth)/state";

/** Signup: details → OTP → account (FR-01). */

export function SignupForm() {
  const [state, submit, pending] = useActionState(signupAction, EMPTY_AUTH_STATE);
  const inOtpStep = state.step === "otp";

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold">অ্যাকাউন্ট খুলুন</h1>
        <p className="text-sm text-ink-500">মোবাইল নম্বর যাচাই করে মিনিটেই আপনার দোকান শুরু করুন।</p>
      </div>

      {state.message ? <Alert tone={state.ok ? "success" : "danger"}>{state.message}</Alert> : null}

      <form action={submit} className="space-y-4">
        <input type="hidden" name="intent" value={inOtpStep ? "verify" : "request"} />

        <Field label="আপনার নাম" required>
          <Input name="name" required placeholder="যেমন: রহিম উদ্দিন" readOnly={inOtpStep} />
        </Field>

        <Field label="মোবাইল নম্বর" required hint="বাংলাদেশি নম্বর, যেমন 017XXXXXXXX">
          <Input name="phone" required inputMode="tel" placeholder="01XXXXXXXXX" readOnly={inOtpStep} />
        </Field>

        {!inOtpStep ? (
          <>
            <Field label="ইমেইল (ঐচ্ছিক)">
              <Input name="email" type="email" placeholder="you@example.com" />
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
        ) : (
          <Field label="OTP কোড" required hint="মোবাইলে পাঠানো ৬ ডিজিটের কোড">
            <Input name="code" required inputMode="numeric" maxLength={6} placeholder="123456" autoFocus />
          </Field>
        )}

        <Button type="submit" disabled={pending} className="w-full">
          {pending ? "অপেক্ষা করুন…" : inOtpStep ? "যাচাই করে অ্যাকাউন্ট খুলুন" : "OTP পাঠান"}
        </Button>
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
