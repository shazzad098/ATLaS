"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/form";
import { togglePaymentMethodAction } from "@/app/admin/actions";
import { EMPTY_ADMIN_STATE } from "@/app/admin/state";

/** Enable/disable a payment provider (FR-05). */

export function PaymentMethodForm({
  storeId,
  provider,
  isEnabled,
}: {
  storeId: string;
  provider: string;
  isEnabled: boolean;
}) {
  const [state, submit, pending] = useActionState(togglePaymentMethodAction, EMPTY_ADMIN_STATE);

  return (
    <form action={submit} className="flex items-center gap-3">
      <input type="hidden" name="storeId" value={storeId} />
      <input type="hidden" name="provider" value={provider} />
      <Checkbox name="isEnabled" defaultChecked={isEnabled} label={isEnabled ? "চালু" : "বন্ধ"} />
      <Button type="submit" variant="outline" size="sm" disabled={pending}>
        {pending ? "…" : "সংরক্ষণ"}
      </Button>
      {state.message ? (
        <span className={`text-xs ${state.ok ? "text-emerald-700" : "text-red-600"}`}>{state.message}</span>
      ) : null}
    </form>
  );
}
