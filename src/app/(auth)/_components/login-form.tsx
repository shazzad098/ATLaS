"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/shell";
import { Field, Input } from "@/components/ui/form";
import {
  loginAction,
  verifyLoginOtpAction,
} from "@/app/(auth)/actions";
import { EMPTY_AUTH_STATE, type AuthState } from "@/app/(auth)/state";

/**
 * Login form — password or OTP, toggled by the shopper (FR-01).
 *
 * The OTP step is a second action so the phone number is re-verified server-side
 * rather than trusted from the client.
 */

export function LoginForm({ devHint, next = "/admin" }: { devHint?: string; next?: string }) {
  const [mode, setMode] = useState<"password" | "otp">("password");
  const [passwordState, passwordSubmit, passwordPending] = useActionState(loginAction, EMPTY_AUTH_STATE);
  const [otpState, otpSubmit, otpPending] = useActionState(verifyLoginOtpAction, EMPTY_AUTH_STATE);

  // The first OTP step is produced by the login action, the second by the
  // verify action. Pick the state that actually owns the OTP step so the phone
  // number and dev code survive the React 19 form reset.
  const otpRequested = passwordState.step === "otp";
  const otpSubmitted = otpState.step === "otp";
  const inOtpStep = otpRequested || otpSubmitted;
  const state: AuthState = otpSubmitted ? otpState : passwordState;
  const action = inOtpStep ? otpSubmit : passwordSubmit;
  const pending = otpPending || passwordPending;

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold">লগইন</h1>
        <p className="text-sm text-ink-500">আপনার দোকান পরিচালনা করতে সাইন ইন করুন।</p>
      </div>

      {state.message ? <Alert tone={state.ok ? "success" : "danger"}>{state.message}</Alert> : null}

      <form action={action} className="space-y-4" key={inOtpStep ? "otp" : "creds"}>
        <input type="hidden" name="next" value={next} />
        <input type="hidden" name="mode" value={mode} />

        {inOtpStep ? (
          <>
            <input type="hidden" name="identifier" value={state.identifier ?? ""} />
            <p className="rounded-lg border border-ink-200 bg-ink-50 px-3 py-2 text-sm text-ink-700">
              OTP পাঠানো হয়েছে{" "}
              <span className="font-semibold">{state.identifier ?? "আপনার নম্বরে"}</span>
            </p>
          </>
        ) : (
          <Field label="মোবাইল নম্বর বা ইমেইল" required>
            <Input
              name="identifier"
              required
              autoComplete="username"
              placeholder="017XXXXXXXX"
              defaultValue={state.identifier ?? undefined}
            />
          </Field>
        )}

        {inOtpStep ? (
          <Field label="OTP কোড" required hint="SMS-এ পাঠানো ৬ ডিজিটের কোড">
            <Input name="code" required inputMode="numeric" maxLength={6} placeholder="123456" autoFocus />
          </Field>
        ) : (
          <>
            <Field label="পাসওয়ার্ড" required>
              <Input name="password" type="password" autoComplete="current-password" placeholder="••••••••" />
            </Field>
            <div className="text-right">
              <Link href="/forgot-password" className="text-xs font-medium text-brand-700 hover:underline">
                পাসওয়ার্ড ভুলে গেছেন?
              </Link>
            </div>
          </>
        )}

        <Button type="submit" disabled={pending} className="w-full">
          {pending ? "অপেক্ষা করুন…" : inOtpStep ? "কোড যাচাই করুন" : mode === "otp" ? "OTP পাঠান" : "লগইন করুন"}
        </Button>
      </form>

      {!inOtpStep ? (
        <button
          type="button"
          onClick={() => setMode((value) => (value === "otp" ? "password" : "otp"))}
          className="w-full text-center text-xs font-medium text-brand-700 hover:underline"
        >
          {mode === "otp" ? "পাসওয়ার্ড দিয়ে লগইন করুন" : "OTP দিয়ে লগইন করুন"}
        </button>
      ) : null}

      <p className="text-center text-sm text-ink-600">
        অ্যাকাউন্ট নেই?{" "}
        <Link
          href={`/signup?next=${encodeURIComponent(next)}`}
          className="font-semibold text-brand-700 hover:underline"
        >
          মার্চেন্ট হিসেবে বিনামূল্যে শুরু করুন
        </Link>
      </p>

      {devHint ? (
        <p className="rounded-lg bg-ink-100 px-3 py-2 text-center text-[11px] text-ink-600">{devHint}</p>
      ) : null}
    </div>
  );
}
