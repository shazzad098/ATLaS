"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/shell";
import { Checkbox, Field, Input } from "@/components/ui/form";
import { saveDeliveryZoneAction } from "@/app/admin/actions";
import { EMPTY_ADMIN_STATE } from "@/app/admin/state";

/** Delivery zone create/edit form (FR-07). */

export function DeliveryZoneForm({
  storeId,
  value,
}: {
  storeId: string;
  value?: {
    id: string;
    name: string;
    areas: string;
    charge: string;
    freeAbove: string;
    isDefault: boolean;
    isActive: boolean;
    sortOrder: number;
  };
}) {
  const [state, submit, pending] = useActionState(saveDeliveryZoneAction, EMPTY_ADMIN_STATE);

  return (
    <form action={submit} className="space-y-4">
      <input type="hidden" name="storeId" value={storeId} />
      {value?.id ? <input type="hidden" name="zoneId" value={value.id} /> : null}

      {state.message ? <Alert tone={state.ok ? "success" : "danger"}>{state.message}</Alert> : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="জোনের নাম" required>
          <Input name="name" defaultValue={value?.name ?? ""} required placeholder="যেমন: ঢাকা সিটির ভিতরে" />
        </Field>
        <Field label="এলাকাসমূহ" hint="কমা দিয়ে আলাদা করুন">
          <Input name="areas" defaultValue={value?.areas ?? ""} placeholder="ধানমন্ডি, মিরপুর, উত্তরা" />
        </Field>
        <Field label="ডেলিভারি চার্জ (৳)" required>
          <Input name="charge" type="number" min={0} step="0.01" defaultValue={value?.charge ?? "60"} required />
        </Field>
        <Field label="এই টাকার উপরে ফ্রি (৳)" hint="খালি রাখলে ফ্রি শিপিং নেই">
          <Input name="freeAbove" type="number" min={0} step="0.01" defaultValue={value?.freeAbove ?? ""} />
        </Field>
        <Field label="ক্রম">
          <Input name="sortOrder" type="number" min={0} defaultValue={value?.sortOrder ?? 0} />
        </Field>
        <div className="flex items-end gap-6">
          <Checkbox name="isActive" defaultChecked={value?.isActive ?? true} label="সক্রিয়" />
          <Checkbox name="isDefault" defaultChecked={value?.isDefault ?? false} label="ডিফল্ট" />
        </div>
      </div>

      <Button type="submit" disabled={pending} size={value?.id ? "sm" : "md"}>
        {pending ? "সংরক্ষণ হচ্ছে…" : value?.id ? "আপডেট করুন" : "জোন যোগ করুন"}
      </Button>
    </form>
  );
}
