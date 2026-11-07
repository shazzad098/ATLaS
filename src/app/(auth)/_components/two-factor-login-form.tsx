"use client";

import { useActionState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/shell";
import { Field, Input } from "@/components/ui/form";
import { verifyTwoFactorLoginAction } from "@/app/(auth)/actions";
import { EMPTY_AUTH_STATE } from "@/app/(auth)/state";
import { useMessages } from "@/components/locale-provider";

/** Second-factor step (FR-01). A TOTP code or a one-time recovery code. */
export function TwoFactorLoginForm() {
  const m = useMessages();
  const [state, submit, pending] = useActionState(verifyTwoFactorLoginAction, EMPTY_AUTH_STATE);

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold">{m.auth.twoFactor.title}</h1>
        <p className="text-sm text-ink-500">{m.auth.twoFactor.subtitle}</p>
      </div>

      {state.message ? <Alert tone={state.ok ? "success" : "danger"}>{state.message}</Alert> : null}

      <form action={submit} className="space-y-4">
        <Field label={m.auth.twoFactor.code} required hint={m.auth.twoFactor.hint}>
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
          {pending ? m.auth.twoFactor.pending : m.auth.twoFactor.submit}
        </Button>
      </form>

      <p className="text-center text-xs text-ink-500">
        {m.auth.twoFactor.lost}{" "}
        <Link href="/login" className="font-medium text-brand-700 hover:underline">
          {m.auth.twoFactor.again}
        </Link>
        {m.auth.twoFactor.lostTail}
      </p>
    </div>
  );
}
