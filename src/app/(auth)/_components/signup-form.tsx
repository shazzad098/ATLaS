"use client";

import { useActionState, useCallback, useRef, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/shell";
import { Checkbox, Field, Input } from "@/components/ui/form";
import { signupAction } from "@/app/(auth)/actions";
import { EMPTY_AUTH_STATE, type AuthState } from "@/app/(auth)/state";
import { useMessages } from "@/components/locale-provider";

/** Signup: details → OTP → account (FR-01). */

type SignupDraft = {
  name: string;
  phone: string;
  email: string;
  password: string;
};

const EMPTY_DRAFT: SignupDraft = { name: "", phone: "", email: "", password: "" };

export function SignupForm() {
  const m = useMessages();
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
        <h1 className="text-2xl font-semibold">{m.auth.signup.title}</h1>
        <p className="text-sm text-ink-500">{m.auth.signup.subtitle}</p>
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

            <Field label={m.auth.signup.name}>
              <Input value={name} readOnly autoComplete="name" />
            </Field>
            <Field label={m.auth.signup.phone}>
              <Input value={phone} readOnly autoComplete="username" />
            </Field>
            <Field label={m.auth.signup.otp} required hint={m.auth.signup.otpHint}>
              <Input name="code" required inputMode="numeric" maxLength={6} placeholder="123456" autoFocus autoComplete="one-time-code" />
            </Field>
            {!password ? (
              <Field label={m.auth.signup.password} required hint={m.auth.signup.passwordConfirmHint}>
                <Input name="password" type="password" required autoComplete="new-password" placeholder="••••••••" />
              </Field>
            ) : null}
          </>
        ) : (
          <>
            <Field label={m.auth.signup.name} required>
              <Input name="name" required placeholder={m.auth.signup.namePlaceholder} defaultValue={name} autoComplete="name" />
            </Field>
            <Field label={m.auth.signup.phone} required hint={m.auth.signup.phoneHint}>
              <Input name="phone" required inputMode="tel" placeholder="01XXXXXXXXX" defaultValue={draft.phone} autoComplete="username" />
            </Field>
            <Field label={m.auth.signup.email}>
              <Input name="email" type="email" placeholder="you@example.com" defaultValue={email} autoComplete="email" />
            </Field>
            <Field label={m.auth.signup.password} required hint={m.auth.signup.passwordHint}>
              <Input name="password" type="password" required autoComplete="new-password" placeholder="••••••••" />
            </Field>
            <Checkbox name="acceptTerms" label={m.auth.signup.terms} />
          </>
        )}

        <Button type="submit" name="intent" value={inOtpStep ? "verify" : "request"} disabled={pending} className="w-full">
          {pending
            ? m.auth.signup.pending
            : inOtpStep
              ? m.auth.signup.verify
              : m.auth.signup.submit}
        </Button>
        {inOtpStep ? (
          <button
            type="submit"
            name="intent"
            value="request"
            disabled={pending}
            className="w-full text-center text-xs font-medium text-brand-700 hover:underline"
          >
            {m.auth.signup.resend}
          </button>
        ) : null}
      </form>

      <p className="text-center text-sm text-ink-600">
        {m.auth.signup.haveAccount}{" "}
        <Link href="/login" className="font-semibold text-brand-700 hover:underline">
          {m.auth.signup.login}
        </Link>
      </p>
    </div>
  );
}
