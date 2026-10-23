"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/form";
import { EMPTY_SUPER_ADMIN_STATE } from "@/app/super-admin/state";
import { updatePlanAction } from "@/app/super-admin/actions";

/**
 * Plan editor (PRD §4.5). Empty number inputs mean "unlimited" for the quota
 * fields, which is why the action parses an empty string as null.
 */
export function PlanEditForm({
  code,
  monthlyPrice,
  yearlyPrice,
  trialDays,
  limits,
}: {
  code: string;
  monthlyPrice: number | null;
  yearlyPrice: number | null;
  trialDays: number;
  limits: Record<string, number | null>;
}) {
  const [state, submit, pending] = useActionState(updatePlanAction, EMPTY_SUPER_ADMIN_STATE);

  return (
    <form action={submit} className="space-y-3">
      <input type="hidden" name="planCode" value={code} />

      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="মাসিক দাম (৳)" hint="খালি = কাস্টম কোট (quote-only)">
          <Input name="price" type="number" min={0} step="1" defaultValue={monthlyPrice ?? ""} />
        </Field>
        <Field label="বাৎসরিক দাম (৳)" hint="খালি রাখলে monthly × 10">
          <Input name="yearlyPrice" type="number" min={0} step="1" defaultValue={yearlyPrice ?? ""} />
        </Field>
        <Field label="Trial দিন" required>
          <Input name="trialDays" type="number" min={0} max={30} defaultValue={trialDays} required />
        </Field>
        <Field label="স্টাফ seat" required>
          <Input name="staffSeats" type="number" min={1} max={100} defaultValue={limits.staffSeats ?? 1} required />
        </Field>
        <Field label="প্রোডাক্ট limit" hint="খালি = unlimited">
          <Input name="products" type="number" min={0} defaultValue={limits.products ?? ""} />
        </Field>
        <Field label="মাসিক অর্ডার limit" hint="খালি = unlimited">
          <Input name="monthlyOrders" type="number" min={0} defaultValue={limits.monthlyOrders ?? ""} />
        </Field>
        <Field label="ওভারেজ হার (%)" hint="included quota-র পরে প্রতি sale-এ">
          <Input
            name="overageRate"
            type="number"
            min={0}
            max={20}
            step="0.01"
            defaultValue={(limits.overageRate ?? 0) * 100}
          />
        </Field>
        <Field label="স্টোরেজ (MB)" hint="খালি = unlimited">
          <Input name="storageMb" type="number" min={0} defaultValue={limits.storageMb ?? ""} />
        </Field>
      </div>

      <div className="flex items-center gap-3">
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? "সংরক্ষণ হচ্ছে…" : "সেভ করুন"}
        </Button>
        {state.message ? (
          <p className={`text-xs ${state.ok ? "text-emerald-700" : "text-red-600"}`}>{state.message}</p>
        ) : null}
      </div>
    </form>
  );
}
