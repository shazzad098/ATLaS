"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/form";
import { EMPTY_ADMIN_STATE } from "@/app/admin/state";
import { createTicketAction } from "@/app/admin/actions";

/** New support ticket (PRD §4.4). Priority defaults to NORMAL. */
export function TicketForm({ storeId }: { storeId: string }) {
  const [state, submit, pending] = useActionState(createTicketAction, EMPTY_ADMIN_STATE);

  return (
    <form action={submit} className="space-y-3">
      <input type="hidden" name="storeId" value={storeId} />

      <Field label="বিষয়" required>
        <Input name="subject" required maxLength={160} placeholder="যেমন: বিকাশ পেমেন্ট কনফার্ম হয়নি" />
      </Field>

      <Field label="বিবরণ" required hint="অর্ডার নম্বর, সময় ও যা হয়েছে — যত বিস্তারিত তত দ্রুত সমাধান">
        <Textarea name="body" required maxLength={5000} className="min-h-28" />
      </Field>

      <Field label="গুরুত্ব">
        <Select name="priority" defaultValue="NORMAL">
          <option value="LOW">কম</option>
          <option value="NORMAL">সাধারণ</option>
          <option value="HIGH">জরুরি</option>
          <option value="URGENT">অতি জরুরি</option>
        </Select>
      </Field>

      <Button type="submit" disabled={pending} className="w-full">
        {pending ? "পাঠানো হচ্ছে…" : "টিকেট খুলুন"}
      </Button>

      {state.message ? (
        <p className={`text-xs ${state.ok ? "text-emerald-700" : "text-red-600"}`}>{state.message}</p>
      ) : null}
    </form>
  );
}
