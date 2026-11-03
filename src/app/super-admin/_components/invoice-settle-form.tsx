"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { markInvoicePaidAction } from "@/app/super-admin/actions";
import { EMPTY_SUPER_ADMIN_STATE } from "@/app/super-admin/state";

/** Super Admin-only manual settlement with an auditable reason. */
export function InvoiceSettleForm({
  invoiceId,
  total,
}: {
  invoiceId: string;
  total: string;
}) {
  const [state, submit, pending] = useActionState(
    markInvoicePaidAction,
    EMPTY_SUPER_ADMIN_STATE,
  );

  return (
    <form action={submit} className="flex min-w-[13rem] flex-col gap-2">
      <input type="hidden" name="invoiceId" value={invoiceId} />
      <input
        name="reason"
        required
        placeholder={`কারণ (যেমন bKash ${total} verified)`}
        className="h-8 rounded-lg border border-ink-200 bg-white px-2 text-xs text-ink-800 outline-none focus:border-brand-500"
      />
      <Button type="submit" variant="outline" size="sm" disabled={pending}>
        {pending ? "Settling…" : "পরিশোধিত করুন"}
      </Button>
      {state.message ? (
        <span className={`text-[11px] ${state.ok ? "text-emerald-700" : "text-red-600"}`}>
          {state.message}
        </span>
      ) : null}
    </form>
  );
}
