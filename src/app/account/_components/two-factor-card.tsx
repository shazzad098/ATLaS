"use client";

import { useActionState } from "react";
import { Alert } from "@/components/ui/shell";
import { Field, Input } from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import {
  confirmTwoFactorSetupAction,
  disableTwoFactorAction,
  regenerateRecoveryCodesAction,
  startTwoFactorSetupAction,
} from "@/app/account/actions";
import { EMPTY_TWO_FACTOR_STATE } from "@/app/account/state";

/**
 * Two-factor setup and recovery (FR-01).
 *
 * The secret is shown once for manual entry into any authenticator app; every
 * code list is shown exactly once and stored server-side as a hash.
 */
export function TwoFactorCard({
  enabled,
  confirmedAt,
  recoveryCodesRemaining,
  hasPassword,
  warning,
}: {
  enabled: boolean;
  confirmedAt: string | null;
  recoveryCodesRemaining: number;
  hasPassword: boolean;
  warning?: string | null;
}) {
  const [setupState, startSetup, starting] = useActionState(
    startTwoFactorSetupAction,
    EMPTY_TWO_FACTOR_STATE,
  );
  const [confirmState, confirmSetup, confirming] = useActionState(
    confirmTwoFactorSetupAction,
    EMPTY_TWO_FACTOR_STATE,
  );
  const [regenState, regenerate, regenerating] = useActionState(
    regenerateRecoveryCodesAction,
    EMPTY_TWO_FACTOR_STATE,
  );
  const [disableState, disable, disabling] = useActionState(
    disableTwoFactorAction,
    EMPTY_TWO_FACTOR_STATE,
  );

  const setupSecret = setupState.step === "setup" ? setupState.secret : undefined;
  const setupUri = setupState.step === "setup" ? setupState.otpauthUri : undefined;
  const freshCodes =
    confirmState.step === "recovery"
      ? confirmState.recoveryCodes
      : regenState.step === "recovery"
        ? regenState.recoveryCodes
        : undefined;

  return (
    <div className="space-y-4">
      {warning ? <Alert tone="warning">{warning}</Alert> : null}

      {enabled ? (
        <div className="space-y-4">
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
            2FA চালু{confirmedAt ? ` · ${confirmedAt}` : ""} · অবশিষ্ট recovery code{" "}
            {recoveryCodesRemaining}
          </div>

          {freshCodes ? (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
              <p className="text-sm font-medium text-amber-900">
                নতুন recovery code — একবারই দেখা যাচ্ছে
              </p>
              <ul className="mt-2 grid grid-cols-2 gap-1 font-mono text-xs text-amber-900">
                {freshCodes.map((code) => (
                  <li key={code}>{code}</li>
                ))}
              </ul>
            </div>
          ) : null}

          {regenState.message ? (
            <Alert tone={regenState.ok ? "success" : "danger"}>{regenState.message}</Alert>
          ) : null}
          {disableState.message ? (
            <Alert tone={disableState.ok ? "success" : "danger"}>{disableState.message}</Alert>
          ) : null}

          <form action={regenerate} className="space-y-2 rounded-lg border border-ink-200 p-3">
            <Field label="Recovery code নতুন করে তৈরি করুন" hint="বর্তমান authenticator কোড দিন">
              <Input name="code" required inputMode="numeric" maxLength={6} placeholder="123456" />
            </Field>
            <Button type="submit" variant="outline" size="sm" disabled={regenerating}>
              {regenerating ? "তৈরি হচ্ছে…" : "নতুন recovery code"}
            </Button>
          </form>

          <form action={disable} className="space-y-2 rounded-lg border border-red-200 p-3">
            <p className="text-sm font-medium text-red-800">2FA বন্ধ করুন</p>
            <p className="text-xs text-ink-500">
              বন্ধ করলে অন্য সব সেশনও বন্ধ হয়ে যাবে। {hasPassword ? "পাসওয়ার্ড ও কোড দুটোই লাগবে।" : "কোড দিয়ে নিশ্চিত করুন।"}
            </p>
            <div className="grid gap-2 sm:grid-cols-2">
              <Input name="code" required inputMode="numeric" maxLength={6} placeholder="123456" />
              {hasPassword ? (
                <Input name="password" type="password" required placeholder="পাসওয়ার্ড" autoComplete="current-password" />
              ) : null}
            </div>
            <Button type="submit" variant="danger" size="sm" disabled={disabling}>
              {disabling ? "বন্ধ হচ্ছে…" : "2FA বন্ধ করুন"}
            </Button>
          </form>
        </div>
      ) : (
        <div className="space-y-4">
          {setupState.message ? (
            <Alert tone={setupState.ok ? "info" : "danger"}>{setupState.message}</Alert>
          ) : null}
          {confirmState.message ? (
            <Alert tone={confirmState.ok ? "success" : "danger"}>{confirmState.message}</Alert>
          ) : null}

          {!setupSecret ? (
            <form action={startSetup}>
              <Button type="submit" disabled={starting}>
                {starting ? "প্রস্তুত হচ্ছে…" : "2FA চালু করুন"}
              </Button>
            </form>
          ) : (
            <div className="space-y-3">
              <div className="rounded-lg border border-ink-200 bg-ink-50 p-3 text-sm">
                <p className="font-medium text-ink-900">Authenticator অ্যাপে যোগ করুন</p>
                <p className="mt-1 text-xs text-ink-500">
                  Google Authenticator / Authy-তে “Enter setup key” বেছে নিয়ে এই key দিন:
                </p>
                <code className="mt-2 block break-all rounded bg-white px-2 py-1 font-mono text-xs">
                  {setupSecret}
                </code>
                <p className="mt-2 text-[11px] text-ink-500">
                  অথবা otpauth URI: <span className="break-all font-mono">{setupUri}</span>
                </p>
              </div>

              <form action={confirmSetup} className="space-y-2">
                <Field label="অ্যাপে দেখানো ৬ ডিজিটের কোড" required>
                  <Input name="code" required inputMode="numeric" maxLength={6} placeholder="123456" />
                </Field>
                <Button type="submit" disabled={confirming}>
                  {confirming ? "যাচাই হচ্ছে…" : "2FA নিশ্চিত করুন"}
                </Button>
              </form>
            </div>
          )}

          {freshCodes ? (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
              <p className="text-sm font-medium text-amber-900">Recovery code — একবারই দেখা যাচ্ছে</p>
              <ul className="mt-2 grid grid-cols-2 gap-1 font-mono text-xs text-amber-900">
                {freshCodes.map((code) => (
                  <li key={code}>{code}</li>
                ))}
              </ul>
              <p className="mt-2 text-[11px] text-amber-800">
                প্রতিটি কোড একবার ব্যবহার করা যায়। ফোন হারালে এগুলো দিয়েই লগইন করুন।
              </p>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
