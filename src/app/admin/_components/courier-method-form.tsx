"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/shell";
import { Checkbox, Input } from "@/components/ui/form";
import { saveDeliveryMethodAction } from "@/app/admin/actions";
import { EMPTY_ADMIN_STATE } from "@/app/admin/state";

/** Per-courier delivery method form: enable/disable + the merchant's courier store ID (FR-07). */

export function CourierMethodForm({
  storeId,
  provider,
  value,
}: {
  storeId: string;
  provider: string;
  value?: {
    courierStoreId: string;
    isEnabled: boolean;
  };
}) {
  const [state, submit, pending] = useActionState(saveDeliveryMethodAction, EMPTY_ADMIN_STATE);

  return (
    <form action={submit} className="space-y-4">
      <input type="hidden" name="storeId" value={storeId} />
      <input type="hidden" name="provider" value={provider} />

      {state.message ? <Alert tone={state.ok ? "success" : "danger"}>{state.message}</Alert> : null}

      <Input
        name="courierStoreId"
        defaultValue={value?.courierStoreId ?? ""}
        placeholder="যেমন: 123456"
        aria-label="কুরিয়ার Store ID"
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Checkbox
          name="isEnabled"
          defaultChecked={value?.isEnabled ?? false}
          label="চালু রাখুন"
        />
        <Button type="submit" disabled={pending} variant="secondary" size="sm">
          {pending ? "সংরক্ষণ হচ্ছে…" : "সংরক্ষণ করুন"}
        </Button>
      </div>
    </form>
  );
}
