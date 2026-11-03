"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/shell";
import { Field, Input, Select, Textarea } from "@/components/ui/form";
import { saveContentPageAction } from "@/app/admin/actions";
import { EMPTY_ADMIN_STATE } from "@/app/admin/state";

/** Create/edit a merchant-authored storefront page (FR-07). */

export function ContentPageForm({
  storeId,
  value,
}: {
  storeId: string;
  value?: {
    id: string;
    slug: string;
    title: string;
    body: string;
    status: string;
  };
}) {
  const [state, submit, pending] = useActionState(saveContentPageAction, EMPTY_ADMIN_STATE);

  return (
    <form action={submit} className="space-y-4">
      <input type="hidden" name="storeId" value={storeId} />
      {value?.id ? <input type="hidden" name="pageId" value={value.id} /> : null}

      {state.message ? <Alert tone={state.ok ? "success" : "danger"}>{state.message}</Alert> : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="শিরোনাম" required>
          <Input name="title" defaultValue={value?.title ?? ""} required maxLength={160} />
        </Field>
        <Field label="URL slug" required hint="যেমন returns, delivery, faq — ছোট হাতের অক্ষর ও হাইফেন">
          <Input
            name="slug"
            defaultValue={value?.slug ?? ""}
            required
            maxLength={60}
            placeholder="faq"
            pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
          />
        </Field>
      </div>

      <Field label="পেজের লেখা" required>
        <Textarea
          name="body"
          defaultValue={value?.body ?? ""}
          required
          rows={12}
          maxLength={20_000}
          placeholder="গ্রাহক যা পড়বেন…"
        />
      </Field>

      <Field label="স্ট্যাটাস">
        <Select name="status" defaultValue={value?.status ?? "ACTIVE"}>
          <option value="ACTIVE">Active</option>
          <option value="DRAFT">Draft</option>
          <option value="ARCHIVED">Archived</option>
        </Select>
      </Field>

      <p className="text-xs text-ink-500">
        `returns`, `contact`, `delivery`, `privacy` ও `terms` slug আগে থেকে reserved। ওই
        নামে পেজ বানালে built-in footer link সেই পেজই দেখাবে।
      </p>

      <Button type="submit" disabled={pending} size={value?.id ? "sm" : "md"}>
        {pending ? "সংরক্ষণ হচ্ছে…" : value?.id ? "আপডেট করুন" : "পেজ তৈরি করুন"}
      </Button>
    </form>
  );
}
