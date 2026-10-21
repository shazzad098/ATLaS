"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/form";
import { EMPTY_ADMIN_STATE } from "@/app/admin/state";
import { adjustStockAction } from "@/app/admin/actions";

/**
 * Stock adjustment (FR-03).
 *
 * The delta is signed — positive for received stock, negative for damage or
 * shrinkage — and a reason is mandatory, because the service writes it straight
 * into the inventory ledger.
 */
export function StockAdjustForm({
  storeId,
  variants,
}: {
  storeId: string;
  variants: Array<{ id: string; label: string }>;
}) {
  const [state, submit, pending] = useActionState(adjustStockAction, EMPTY_ADMIN_STATE);

  if (variants.length === 0) {
    return <p className="text-sm text-ink-500">অ্যাডজাস্ট করার জন্য কোনো variant নেই।</p>;
  }

  return (
    <form action={submit} className="space-y-3">
      <input type="hidden" name="storeId" value={storeId} />

      <Field label="Variant" required>
        <Select name="variantId" required defaultValue={variants[0].id}>
          {variants.map((variant) => (
            <option key={variant.id} value={variant.id}>
              {variant.label}
            </option>
          ))}
        </Select>
      </Field>

      <Field label="পরিবর্তন" required hint="নতুন স্টক আসলে ধনাত্মক, নষ্ট হলে ঋণাত্মক">
        <Input name="delta" type="number" required defaultValue={1} step={1} />
      </Field>

      <Field label="কারণ" required hint="যেমন: নতুন সাপ্লাই, ড্যামেজ, রি-স্টক">
        <Input name="reason" required placeholder="নতুন সাপ্লাই" />
      </Field>

      <Button type="submit" disabled={pending} className="w-full">
        {pending ? "হালনাগাদ হচ্ছে…" : "স্টক হালনাগাদ"}
      </Button>

      {state.message ? (
        <p className={`text-xs ${state.ok ? "text-emerald-700" : "text-red-600"}`}>{state.message}</p>
      ) : null}
    </form>
  );
}
