"use client";

import { useActionState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/shell";
import { Checkbox, Field, Input } from "@/components/ui/form";
import { signupAction } from "@/app/(auth)/actions";
import { EMPTY_AUTH_STATE } from "@/app/(auth)/state";

/** Merchant signup: details → OTP → store setup → dashboard (FR-01, FR-02). */

export function SignupForm({ next = "/admin" }: { next?: string }) {
  const [state, submit, pending] = useActionState(signupAction, EMPTY_AUTH_STATE);
  const inOtpStep = state.step === "otp";

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold">মার্চেন্ট অ্যাকাউন্ট খুলুন</h1>
        <p className="text-sm text-ink-500">
          মোবাইল নম্বর যাচাই করে মিনিটেই আপনার দোকান শুরু করুন — এরপর দোকান সেটআপ করে ড্যাশবোর্ডে
          যাবেন।
        </p>
      </div>

      {state.message ? <Alert tone={state.ok ? "success" : "danger"}>{state.message}</Alert> : null}

      <form action={submit} className="space-y-4">
        <input type="hidden" name="next" value={next} />
        <input type="hidden" name="intent" value={inOtpStep ? "verify" : "request"} />

        {inOtpStep ? (
          <>
            <p className="rounded-lg border border-ink-200 bg-ink-50 px-3 py-2 text-sm text-ink-700">
              OTP পাঠানো হয়েছে{" "}
              <span className="font-semibold">{state.phone ?? "আপনার নম্বরে"}</span>
            </p>
            <Field label="OTP কোড" required hint="মোবাইলে পাঠানো ৬ ডিজিটের কোড">
              <Input name="code" required inputMode="numeric" maxLength={6} placeholder="123456" autoFocus />
            </Field>
          </>
        ) : (
          <>
            <Field label="আপনার নাম" required>
              <Input name="name" required placeholder="যেমন: রহিম উদ্দিন" />
            </Field>

            <Field label="মোবাইল নম্বর" required hint="বাংলাদেশি নম্বর, যেমন 017XXXXXXXX">
              <Input name="phone" required inputMode="tel" placeholder="01XXXXXXXXX" />
            </Field>

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
        )}

        <Button type="submit" disabled={pending} className="w-full">
          {pending ? "অপেক্ষা করুন…" : inOtpStep ? "যাচাই করে অ্যাকাউন্ট খুলুন" : "OTP পাঠান"}
        </Button>
      </form>

      <p className="text-center text-sm text-ink-600">
        আগেই অ্যাকাউন্ট আছে?{" "}
        <Link
          href={`/login?next=${encodeURIComponent(next)}`}
          className="font-semibold text-brand-700 hover:underline"
        >
          লগইন করুন
        </Link>
      </p>
    </div>
  );
}
