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
import { useMessages } from "@/components/locale-provider";

/**
 * Login form — password or OTP, toggled by the shopper (FR-01).
 *
 * The OTP step is a second action so the phone number is re-verified server-side
 * rather than trusted from the client.
 */

export function LoginForm({ devHint }: { devHint?: string }) {
  const m = useMessages();
  const [mode, setMode] = useState<"password" | "otp">("password");
  const [passwordState, passwordSubmit, passwordPending] = useActionState(loginAction, EMPTY_AUTH_STATE);
  const [otpState, otpSubmit, otpPending] = useActionState(verifyLoginOtpAction, EMPTY_AUTH_STATE);

  // The OTP step can be opened either by the verify action (a failed code) or
  // by the request action (a code was just sent). In the latter case the
  // identifier and demo code live in `passwordState`, not `otpState`.
  const inOtpStep = otpState.step === "otp" || passwordState.step === "otp";
  const state: AuthState = otpState.step === "otp" ? otpState : passwordState;
  const action = inOtpStep ? otpSubmit : passwordSubmit;
  const pending = otpPending || passwordPending;

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold">{m.auth.login.title}</h1>
        <p className="text-sm text-ink-500">{m.auth.login.subtitle}</p>
      </div>

      {state.message ? <Alert tone={state.ok ? "success" : "danger"}>{state.message}</Alert> : null}

      <form action={action} className="space-y-4">
        <input type="hidden" name="mode" value={mode} />

        {inOtpStep ? (
          <>
            {/* The number is re-verified server-side; a remount must not lose it. */}
            <input type="hidden" name="identifier" value={state.identifier ?? ""} />
            <Field label={m.auth.login.identifierOtp}>
              <Input value={state.identifier ?? ""} readOnly autoComplete="username" />
            </Field>
          </>
        ) : (
          <Field label={m.auth.login.identifier} required>
            <Input
              name="identifier"
              required
              autoComplete="username"
              placeholder="017XXXXXXXX"
              defaultValue={state.identifier}
            />
          </Field>
        )}

        {inOtpStep ? (
          <Field label={m.auth.login.otpCode} required hint={m.auth.login.otpHint}>
            <Input name="code" required inputMode="numeric" maxLength={6} placeholder="123456" autoFocus />
          </Field>
        ) : (
          <>
            <Field label={m.auth.login.password} required>
              <Input name="password" type="password" autoComplete="current-password" placeholder="••••••••" />
            </Field>
            <div className="text-right">
              <Link href="/forgot-password" className="text-xs font-medium text-brand-700 hover:underline">
                {m.auth.login.forgot}
              </Link>
            </div>
          </>
        )}

        <Button type="submit" disabled={pending} className="w-full">
          {pending
            ? m.auth.login.pending
            : inOtpStep
              ? m.auth.login.verify
              : mode === "otp"
                ? m.auth.login.sendOtp
                : m.auth.login.submit}
        </Button>
      </form>

      {!inOtpStep ? (
        <button
          type="button"
          onClick={() => setMode((value) => (value === "otp" ? "password" : "otp"))}
          className="w-full text-center text-xs font-medium text-brand-700 hover:underline"
        >
          {mode === "otp" ? m.auth.login.loginWithPassword : m.auth.login.loginWithOtp}
        </button>
      ) : null}

      <p className="text-center text-sm text-ink-600">
        {m.auth.login.noAccount}{" "}
        <Link href="/signup" className="font-semibold text-brand-700 hover:underline">
          {m.auth.login.createAccount}
        </Link>
      </p>

      {devHint ? (
        <p className="rounded-lg bg-ink-100 px-3 py-2 text-center text-[11px] text-ink-600">{devHint}</p>
      ) : null}
    </div>
  );
}
