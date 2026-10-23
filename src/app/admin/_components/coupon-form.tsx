"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/shell";
import { Field, Input, Select } from "@/components/ui/form";
import { saveCouponAction } from "@/app/admin/actions";
import { EMPTY_ADMIN_STATE } from "@/app/admin/state";

/** Coupon create/edit form (FR-08). */

export function CouponForm({
  storeId,
  value,
}: {
  storeId: string;
  value?: {
    id: string;
    code: string;
    type: string;
    value: string;
    minOrder: string;
    usageLimit: string;
    startsAt: string;
    endsAt: string;
    status: string;
  };
}) {
  const [state, submit, pending] = useActionState(saveCouponAction, EMPTY_ADMIN_STATE);

  return (
    <form action={submit} className="space-y-4">
      <input type="hidden" name="storeId" value={storeId} />
      {value?.id ? <input type="hidden" name="couponId" value={value.id} /> : null}

      {state.message ? <Alert tone={state.ok ? "success" : "danger"}>{state.message}</Alert> : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="কুপন কোড" required hint="যেমন: EID20">
          <Input name="code" defaultValue={value?.code ?? ""} required placeholder="EID20" className="uppercase" />
        </Field>
        <Field label="ধরন">
          <Select name="type" defaultValue={value?.type ?? "PERCENTAGE"}>
            <option value="PERCENTAGE">শতাংশ (%)</option>
            <option value="FIXED">নির্দিষ্ট টাকা (৳)</option>
          </Select>
        </Field>
        <Field label="ছাড়ের মান" required>
          <Input name="value" type="number" min={0} step="0.01" defaultValue={value?.value ?? ""} required />
        </Field>
        <Field label="ন্যূনতম অর্ডার (৳)">
          <Input name="minOrder" type="number" min={0} step="0.01" defaultValue={value?.minOrder ?? "0"} />
        </Field>
        <Field label="ব্যবহারের সীমা" hint="খালি রাখলে অসীম">
          <Input name="usageLimit" type="number" min={0} defaultValue={value?.usageLimit ?? ""} />
        </Field>
        <Field label="স্ট্যাটাস">
          <Select name="status" defaultValue={value?.status ?? "ACTIVE"}>
            <option value="ACTIVE">Active</option>
            <option value="DRAFT">Draft</option>
            <option value="ARCHIVED">Archived</option>
          </Select>
        </Field>
        <Field label="শুরু">
          <Input name="startsAt" type="date" defaultValue={value?.startsAt ?? ""} />
        </Field>
        <Field label="শেষ">
          <Input name="endsAt" type="date" defaultValue={value?.endsAt ?? ""} />
        </Field>
      </div>

      <Button type="submit" disabled={pending} size={value?.id ? "sm" : "md"}>
        {pending ? "সংরক্ষণ হচ্ছে…" : value?.id ? "আপডেট করুন" : "কুপন তৈরি করুন"}
      </Button>
    </form>
  );
}
