"use client";

import { useActionState } from "react";
import { Alert } from "@/components/ui/shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/form";
import {
  setCustomerBlacklistAction,
  updateCustomerConsentAction,
} from "@/app/admin/actions";
import type { AdminState } from "@/app/admin/state";

const EMPTY: AdminState = { ok: false, message: "" };

export function CustomerConsentForm({
  storeId,
  customerId,
  marketingEmail,
  marketingSms,
}: {
  storeId: string;
  customerId: string;
  marketingEmail: boolean;
  marketingSms: boolean;
}) {
  const [state, submit, pending] = useActionState(updateCustomerConsentAction, EMPTY);

  return (
    <form action={submit} className="space-y-3">
      <input type="hidden" name="storeId" value={storeId} />
      <input type="hidden" name="customerId" value={customerId} />
      <label className="flex items-start gap-2 text-sm text-ink-700">
        <input type="checkbox" name="marketingEmail" defaultChecked={marketingEmail} className="mt-0.5" />
        <span>
          ইমেইলে মার্কেটিং/অফার পেতে সম্মতি
          <span className="block text-[11px] text-ink-400">Consent timestamp ও source সহ সংরক্ষিত হয়</span>
        </span>
      </label>
      <label className="flex items-start gap-2 text-sm text-ink-700">
        <input type="checkbox" name="marketingSms" defaultChecked={marketingSms} className="mt-0.5" />
        <span>SMS-এ মার্কেটিং/অফার পেতে সম্মতি</span>
      </label>
      {state.message ? <Alert tone={state.ok ? "success" : "danger"}>{state.message}</Alert> : null}
      <Button type="submit" size="sm" disabled={pending}>
        {pending ? "সংরক্ষণ হচ্ছে…" : "Consent সংরক্ষণ করুন"}
      </Button>
    </form>
  );
}

export function CustomerBlacklistForm({
  storeId,
  customerId,
  isBlacklisted,
  notes,
}: {
  storeId: string;
  customerId: string;
  isBlacklisted: boolean;
  notes?: string | null;
}) {
  const [state, submit, pending] = useActionState(setCustomerBlacklistAction, EMPTY);

  return (
    <form action={submit} className="space-y-3">
      <input type="hidden" name="storeId" value={storeId} />
      <input type="hidden" name="customerId" value={customerId} />
      <input type="hidden" name="isBlacklisted" value={isBlacklisted ? "0" : "1"} />
      <Input
        name="reason"
        maxLength={500}
        defaultValue={notes ?? ""}
        placeholder={isBlacklisted ? "Blacklist উঠানোর কারণ (ঐচ্ছিক)" : "Blacklist করার কারণ (ঐচ্ছিক)"}
      />
      <p className="text-[11px] text-ink-500">
        Blacklisted ক্রেতা checkout-এ অর্ডার করতে পারবেন না। সিদ্ধান্ত audit log-এ থাকে।
      </p>
      {state.message ? <Alert tone={state.ok ? "success" : "danger"}>{state.message}</Alert> : null}
      <Button type="submit" variant={isBlacklisted ? "outline" : "danger"} size="sm" disabled={pending}>
        {pending ? "হালনাগাদ হচ্ছে…" : isBlacklisted ? "Blacklist উঠান" : "Blacklist করুন"}
      </Button>
    </form>
  );
}
