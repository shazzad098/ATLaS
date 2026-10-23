"use client";

import { useActionState, useState } from "react";
import { Alert, Badge, Card, CardBody, CardHeader } from "@/components/ui/shell";
import { Button } from "@/components/ui/button";
import { Checkbox, Select } from "@/components/ui/form";
import {
  cancelSubscriptionAction,
  changePlanAction,
  markInvoicePaidAction,
} from "@/app/admin/actions";
import { EMPTY_ADMIN_STATE } from "@/app/admin/state";
import { formatBdt } from "@/lib/money";

/**
 * Plan switcher (PRD §5.1).
 *
 * Prices are shown as "custom" when a plan's BDT price is still pending
 * approval, which is how the pricing table stays honest during beta.
 */

export type PlanOption = {
  code: string;
  name: string;
  description: string;
  monthlyPriceBdt: number | null;
  yearlyPriceBdt: number | null;
  trialDays: number;
  limits: { products: number | null; monthlyOrders: number | null; staffSeats: number };
};

function priceLabel(monthly: number | null, yearly: number | null): string {
  if (monthly === null && yearly === null) return "দাম আলোচনা সাপেক্ষে";
  if (monthly === null) return `বার্ষিক ${formatBdt(yearly as number)}`;
  return `${formatBdt(monthly)}/মাস`;
}

export function PlanSwitcher({
  plans,
  currentPlanCode,
  currentPeriod,
  canManage,
}: {
  plans: PlanOption[];
  currentPlanCode: string;
  currentPeriod: "MONTHLY" | "YEARLY";
  canManage: boolean;
}) {
  const [changeState, changeSubmit, changePending] = useActionState(changePlanAction, EMPTY_ADMIN_STATE);
  const [cancelState, cancelSubmit, cancelPending] = useActionState(cancelSubscriptionAction, EMPTY_ADMIN_STATE);
  const [selected, setSelected] = useState(currentPlanCode);
  const [period, setPeriod] = useState<"MONTHLY" | "YEARLY">(currentPeriod);

  return (
    <div className="space-y-5">
      {changeState.message ? <Alert tone={changeState.ok ? "success" : "danger"}>{changeState.message}</Alert> : null}
      {cancelState.message ? <Alert tone={cancelState.ok ? "success" : "danger"}>{cancelState.message}</Alert> : null}

      <form action={changeSubmit} className="space-y-4">
        <input type="hidden" name="planCode" value={selected} />
        <input type="hidden" name="billingPeriod" value={period} />

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {plans.map((plan) => {
            const active = plan.code === selected;
            const current = plan.code === currentPlanCode;
            return (
              <button
                key={plan.code}
                type="button"
                onClick={() => setSelected(plan.code)}
                className={`rounded-xl border p-4 text-left transition ${
                  active ? "border-brand-500 ring-2 ring-brand-500/25" : "border-ink-200 hover:border-ink-300"
                }`}
              >
                <span className="flex items-center justify-between gap-2">
                  <span className="text-sm font-semibold text-ink-900">{plan.name}</span>
                  {current ? <Badge tone="brand">বর্তমান</Badge> : null}
                </span>
                <span className="mt-1 block text-lg font-bold text-ink-900">
                  {priceLabel(plan.monthlyPriceBdt, plan.yearlyPriceBdt)}
                </span>
                <span className="mt-2 block text-xs text-ink-500">{plan.description}</span>
                <span className="mt-3 block space-y-1 text-xs text-ink-600">
                  <span className="block">
                    পণ্য: {plan.limits.products === null ? "আনলিমিটেড" : plan.limits.products}
                  </span>
                  <span className="block">
                    মাসিক অর্ডার: {plan.limits.monthlyOrders === null ? "আনলিমিটেড" : plan.limits.monthlyOrders}
                  </span>
                  <span className="block">স্টাফ সিট: {plan.limits.staffSeats}</span>
                  {plan.trialDays > 0 ? <span className="block">{plan.trialDays} দিনের ট্রায়াল</span> : null}
                </span>
              </button>
            );
          })}
        </div>

        <div className="flex flex-wrap items-center gap-4">
          <div className="w-40">
            <Select value={period} onChange={(event) => setPeriod(event.target.value as "MONTHLY" | "YEARLY")}>
              <option value="MONTHLY">মাসিক</option>
              <option value="YEARLY">বার্ষিক</option>
            </Select>
          </div>
          <Checkbox name="asTrial" label="৭ দিনের ট্রায়াল হিসেবে শুরু করুন" />
          <Button type="submit" disabled={changePending || !canManage || selected === currentPlanCode}>
            {changePending ? "পরিবর্তন হচ্ছে…" : "প্ল্যান পরিবর্তন করুন"}
          </Button>
          {!canManage ? <span className="text-xs text-ink-500">শুধু Owner প্ল্যান বদলাতে পারেন।</span> : null}
        </div>
      </form>

      <Card>
        <CardHeader title="সাবস্ক্রিপশন বাতিল" description="বাতিল করলে চলতি পিরিয়ড শেষে Free প্ল্যানে নেমে যাবে।" />
        <CardBody>
          <form action={cancelSubmit} className="flex flex-wrap items-center gap-3">
            <Checkbox name="atPeriodEnd" defaultChecked label="পিরিয়ড শেষে বাতিল করুন" />
            <Button type="submit" variant="danger" size="sm" disabled={cancelPending || !canManage}>
              {cancelPending ? "…" : "সাবস্ক্রিপশন বাতিল"}
            </Button>
          </form>
        </CardBody>
      </Card>
    </div>
  );
}

/** Mark an invoice paid (beta: manual settlement). */
export function InvoiceRowAction({ invoiceId, status }: { invoiceId: string; status: string }) {
  const [state, submit, pending] = useActionState(markInvoicePaidAction, EMPTY_ADMIN_STATE);

  if (status === "PAID") {
    return <span className="text-xs text-emerald-700">পরিশোধিত</span>;
  }

  return (
    <form action={submit} className="flex items-center gap-2">
      <input type="hidden" name="invoiceId" value={invoiceId} />
      <Button type="submit" variant="outline" size="sm" disabled={pending}>
        {pending ? "…" : "পরিশোধ চিহ্নিত করুন"}
      </Button>
      {state.message ? (
        <span className={`text-xs ${state.ok ? "text-emerald-700" : "text-red-600"}`}>{state.message}</span>
      ) : null}
    </form>
  );
}
