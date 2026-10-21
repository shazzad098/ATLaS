"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/form";
import { EMPTY_ADMIN_STATE, type AdminState } from "@/app/admin/state";

/** Status transition control for an order (FR-05). */

export function OrderStatusForm({
  action,
  storeId,
  orderId,
  options,
}: {
  action: (prev: AdminState, formData: FormData) => Promise<AdminState>;
  storeId: string;
  orderId: string;
  options: Array<{ value: string; label: string }>;
}) {
  const [state, submit, pending] = useActionState(action, EMPTY_ADMIN_STATE);

  if (options.length === 0) {
    return <p className="text-xs text-ink-500">এই অবস্থা থেকে আর কোনো পরিবর্তন সম্ভব নয়।</p>;
  }

  return (
    <form action={submit} className="space-y-3">
      <input type="hidden" name="storeId" value={storeId} />
      <input type="hidden" name="orderId" value={orderId} />

      <Field label="নতুন স্ট্যাটাস">
        <Select name="status" defaultValue={options[0].value}>
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </Select>
      </Field>

      <Field label="নোট (ঐচ্ছিক)">
        <Input name="note" placeholder="যেমন: কুরিয়ারে দেওয়া হয়েছে" />
      </Field>

      <Button type="submit" disabled={pending}>
        {pending ? "আপডেট হচ্ছে…" : "স্ট্যাটাস আপডেট করুন"}
      </Button>

      {state.message ? (
        <p className={`text-xs ${state.ok ? "text-emerald-700" : "text-red-600"}`}>{state.message}</p>
      ) : null}
    </form>
  );
}
