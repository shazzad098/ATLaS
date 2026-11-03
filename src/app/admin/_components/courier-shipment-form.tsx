"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/shell";
import { Select } from "@/components/ui/form";
import { createShipmentAction } from "@/app/admin/actions";
import { EMPTY_ADMIN_STATE } from "@/app/admin/state";

/** Pick an enabled courier and hand the order over (FR-07). */

export function CourierShipmentForm({
  storeId,
  orderId,
  methods,
}: {
  storeId: string;
  orderId: string;
  methods: Array<{ provider: string; label: string; mode: "sandbox" | "live" }>;
}) {
  const [state, submit, pending] = useActionState(createShipmentAction, EMPTY_ADMIN_STATE);

  if (methods.length === 0) {
    return (
      <p className="text-sm text-ink-500">
        কোনো কুরিয়ার চালু নেই — ডেলিভারি সেটিংসে Store ID দিয়ে Pathao/RedX/Steadfast চালু করুন।
      </p>
    );
  }

  return (
    <form action={submit} className="space-y-3">
      <input type="hidden" name="storeId" value={storeId} />
      <input type="hidden" name="orderId" value={orderId} />

      <Select name="provider" defaultValue={methods[0].provider} aria-label="কুরিয়ার">
        {methods.map((method) => (
          <option key={method.provider} value={method.provider}>
            {method.label}
            {method.mode === "sandbox" ? " (sandbox)" : ""}
          </option>
        ))}
      </Select>

      {state.message ? (
        <Alert tone={state.ok ? "success" : "danger"}>{state.message}</Alert>
      ) : null}

      <Button type="submit" disabled={pending} size="sm" className="w-full">
        {pending ? "পাঠানো হচ্ছে…" : "কুরিয়ারে পাঠান"}
      </Button>
    </form>
  );
}
