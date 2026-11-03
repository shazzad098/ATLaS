"use client";

import { useActionState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/shell";
import { Field, Input } from "@/components/ui/form";
import { verifyTwoFactorLoginAction } from "@/app/(auth)/actions";
import { EMPTY_AUTH_STATE } from "@/app/(auth)/state";

/** Second-factor step (FR-01). A TOTP code or a one-time recovery code. */
export function TwoFactorLoginForm() {
  const [state, submit, pending] = useActionState(verifyTwoFactorLoginAction, EMPTY_AUTH_STATE);

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold">দুই-ধাপ যাচাই</h1>
        <p className="text-sm text-ink-500">
          আপনার authenticator অ্যাপের ৬ ডিজিটের কোড দিন, অথবা একটি recovery code ব্যবহার করুন।
        </p>
      </div>

      {state.message ? <Alert tone={state.ok ? "success" : "danger"}>{state.message}</Alert> : null}

      <form action={submit} className="space-y-4">
        <Field label="কোড" required hint="Authenticator কোড অথবা xxxx-xxxx recovery code">
          <Input
            name="code"
            required
            autoFocus
            autoComplete="one-time-code"
            inputMode="text"
            maxLength={20}
            placeholder="123456"
          />
        </Field>

        <Button type="submit" disabled={pending} className="w-full">
          {pending ? "যাচাই হচ্ছে…" : "যাচাই করুন"}
        </Button>
      </form>

      <p className="text-center text-xs text-ink-500">
        কোড হারিয়েছেন?{" "}
        <Link href="/login" className="font-medium text-brand-700 hover:underline">
          আবার লগইন
        </Link>{" "}
        করুন, তারপর recovery code দিয়ে ঢুকুন।
      </p>
    </div>
  );
}
