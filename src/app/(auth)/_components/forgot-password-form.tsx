"use client";

import { useActionState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/shell";
import { Field, Input } from "@/components/ui/form";
import { requestPasswordResetAction, resetPasswordAction } from "@/app/(auth)/actions";
import { EMPTY_AUTH_STATE } from "@/app/(auth)/state";

/**
 * Password reset, two steps in one form (FR-01).
 *
 * Step 1 collects the identifier and sends the OTP; step 2 collects the code and
 * the new password. The identifier travels in a hidden field so the reset action
 * can re-resolve the account server-side.
 */
export function ForgotPasswordForm() {
  const [requestState, requestSubmit, requestPending] = useActionState(
    requestPasswordResetAction,
    EMPTY_AUTH_STATE,
  );
  const [resetState, resetSubmit, resetPending] = useActionState(resetPasswordAction, EMPTY_AUTH_STATE);

  const inResetStep = requestState.step === "otp" || resetState.step === "otp";
  const state = resetState.message ? resetState : requestState;
  const action = inResetStep ? resetSubmit : requestSubmit;
  const pending = requestPending || resetPending;

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold">পাসওয়ার্ড রিসেট</h1>
        <p className="text-sm text-ink-500">
          মোবাইল নম্বর দিন — SMS-এ পাঠানো কোড দিয়ে নতুন পাসওয়ার্ড সেট করবেন।
        </p>
      </div>

      {state.message ? <Alert tone={state.ok ? "success" : "danger"}>{state.message}</Alert> : null}

      <form action={action} className="space-y-4" key={inResetStep ? "reset" : "request"}>
        <Field label="মোবাইল নম্বর বা ইমেইল" required={!inResetStep}>
          <Input
            name="identifier"
            required
            autoComplete="username"
            placeholder="017XXXXXXXX"
            readOnly={inResetStep}
            defaultValue={resetState.step === "otp" ? undefined : ""}
          />
        </Field>

        {inResetStep ? (
          <>
            <Field label="OTP কোড" required hint="৬ ডিজিটের কোড">
              <Input name="code" required inputMode="numeric" maxLength={6} placeholder="123456" autoFocus />
            </Field>
            <Field label="নতুন পাসওয়ার্ড" required hint="অন্তত ৮ অক্ষর, একটি সংখ্যা ও একটি বড় হাতের অক্ষর">
              <Input name="password" type="password" required autoComplete="new-password" />
            </Field>
          </>
        ) : null}

        <Button type="submit" disabled={pending} className="w-full">
          {pending ? "অপেক্ষা করুন…" : inResetStep ? "পাসওয়ার্ড সেট করুন" : "কোড পাঠান"}
        </Button>
      </form>

      <p className="text-center text-sm text-ink-600">
        মনে পড়েছে?{" "}
        <Link href="/login" className="font-semibold text-brand-700 hover:underline">
          লগইনে ফিরে যান
        </Link>
      </p>
    </div>
  );
}
