"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox, Field, Input, Textarea } from "@/components/ui/form";
import { togglePaymentMethodAction } from "@/app/admin/actions";
import { EMPTY_ADMIN_STATE } from "@/app/admin/state";

/** Enable/disable a payment provider (FR-05). */

export function PaymentMethodForm({
  storeId,
  provider,
  isEnabled,
  credentialsConfigured,
}: {
  storeId: string;
  provider: string;
  isEnabled: boolean;
  credentialsConfigured: boolean;
}) {
  const [state, submit, pending] = useActionState(togglePaymentMethodAction, EMPTY_ADMIN_STATE);

  const fields = provider === "BKASH"
    ? ["appKey", "appSecret", "username", "password"]
    : provider === "NAGAD"
      ? ["merchantId", "privateKey"]
      : provider === "SSLCOMMERZ"
        ? ["storeId", "storePassword"]
        : [];

  return (
    <form action={submit} className="space-y-3">
      <input type="hidden" name="storeId" value={storeId} />
      <input type="hidden" name="provider" value={provider} />
      <div className="flex flex-wrap items-center gap-3">
        <Checkbox name="isEnabled" defaultChecked={isEnabled} label={isEnabled ? "চালু" : "বন্ধ"} />
        <span className="text-xs text-ink-500">{credentialsConfigured ? "merchant credentials saved" : "sandbox credentials"}</span>
      </div>
      {fields.length > 0 ? (
        <div className="grid gap-2 sm:grid-cols-2">
          {fields.map((field) => (
            <Field key={field} label={field === "privateKey" ? "Private key" : field} hint="ফাঁকা রাখলে আগের credential অপরিবর্তিত থাকবে।">
              {field === "privateKey" ? (
                <Textarea name={`credential_${field}`} autoComplete="off" placeholder="-----BEGIN PRIVATE KEY-----" />
              ) : (
                <Input name={`credential_${field}`} type={field.toLowerCase().includes("password") || field.toLowerCase().includes("secret") ? "password" : "text"} autoComplete="off" />
              )}
            </Field>
          ))}
        </div>
      ) : null}
      <Button type="submit" variant="outline" size="sm" disabled={pending}>{pending ? "…" : "সংরক্ষণ"}</Button>
      {state.message ? (
        <span className={`text-xs ${state.ok ? "text-emerald-700" : "text-red-600"}`}>{state.message}</span>
      ) : null}
    </form>
  );
}
