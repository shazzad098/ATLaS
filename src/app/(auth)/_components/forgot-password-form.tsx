"use client";

import { useActionState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/shell";
import { Field, Input } from "@/components/ui/form";
import { requestPasswordResetAction, resetPasswordAction } from "@/app/(auth)/actions";
import { EMPTY_AUTH_STATE } from "@/app/(auth)/state";
import { useMessages } from "@/components/locale-provider";

/**
 * Password reset, two steps in one form (FR-01).
 *
 * Step 1 collects the identifier and sends the OTP; step 2 collects the code and
 * the new password. The identifier travels in a hidden field so the reset action
 * can re-resolve the account server-side.
 */
export function ForgotPasswordForm() {
  const m = useMessages();
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
        <h1 className="text-2xl font-semibold">{m.auth.forgot.title}</h1>
        <p className="text-sm text-ink-500">{m.auth.forgot.subtitle}</p>
      </div>

      {state.message ? <Alert tone={state.ok ? "success" : "danger"}>{state.message}</Alert> : null}

      <form action={action} className="space-y-4">
        {inResetStep ? (
          <>
            {/* Hidden so the reset request can re-resolve the same account. */}
            <input type="hidden" name="identifier" value={state.identifier ?? ""} />
            <Field label={m.auth.forgot.identifier}>
              <Input value={state.identifier ?? ""} readOnly autoComplete="username" />
            </Field>
          </>
        ) : (
          <Field label={m.auth.forgot.identifier} required>
            <Input
              name="identifier"
              required
              autoComplete="username"
              placeholder="017XXXXXXXX"
              defaultValue={state.identifier}
            />
          </Field>
        )}

        {inResetStep ? (
          <>
            <Field label={m.auth.forgot.otp} required hint={m.auth.forgot.otpHint}>
              <Input name="code" required inputMode="numeric" maxLength={6} placeholder="123456" autoFocus />
            </Field>
            <Field label={m.auth.forgot.newPassword} required hint={m.auth.forgot.passwordHint}>
              <Input name="password" type="password" required autoComplete="new-password" />
            </Field>
          </>
        ) : null}

        <Button type="submit" disabled={pending} className="w-full">
          {pending
            ? m.auth.forgot.pending
            : inResetStep
              ? m.auth.forgot.setPassword
              : m.auth.forgot.submit}
        </Button>
      </form>

      <p className="text-center text-sm text-ink-600">
        {m.auth.forgot.remembered}{" "}
        <Link href="/login" className="font-semibold text-brand-700 hover:underline">
          {m.auth.forgot.back}
        </Link>
      </p>
    </div>
  );
}
