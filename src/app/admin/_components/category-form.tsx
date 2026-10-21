"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Alert, Card, CardBody, CardHeader } from "@/components/ui/shell";
import { Field, Input, Select } from "@/components/ui/form";
import { saveCategoryAction } from "@/app/admin/actions";
import { EMPTY_ADMIN_STATE } from "@/app/admin/state";

/** Category create/edit form (FR-03). */

export function CategoryForm({
  storeId,
  value,
  compact,
}: {
  storeId: string;
  value?: { id: string; name: string; slug: string; sortOrder: number; status: string };
  compact?: boolean;
}) {
  const [state, submit, pending] = useActionState(saveCategoryAction, EMPTY_ADMIN_STATE);

  const body = (
    <form action={submit} className="space-y-4">
      <input type="hidden" name="storeId" value={storeId} />
      {value?.id ? <input type="hidden" name="categoryId" value={value.id} /> : null}

      {state.message ? <Alert tone={state.ok ? "success" : "danger"}>{state.message}</Alert> : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="ক্যাটাগরির নাম" required>
          <Input name="name" defaultValue={value?.name ?? ""} required placeholder="যেমন: শাড়ি" />
        </Field>
        <Field label="Slug" hint="খালি রাখলে নাম থেকে তৈরি হবে">
          <Input name="slug" defaultValue={value?.slug ?? ""} placeholder="shari" />
        </Field>
        <Field label="ক্রম">
          <Input name="sortOrder" type="number" min={0} defaultValue={value?.sortOrder ?? 0} />
        </Field>
        <Field label="স্ট্যাটাস">
          <Select name="status" defaultValue={value?.status ?? "ACTIVE"}>
            <option value="ACTIVE">Active</option>
            <option value="DRAFT">Draft</option>
            <option value="ARCHIVED">Archived</option>
          </Select>
        </Field>
      </div>

      <Button type="submit" disabled={pending} size={compact ? "sm" : "md"}>
        {pending ? "সংরক্ষণ হচ্ছে…" : value?.id ? "আপডেট করুন" : "ক্যাটাগরি যোগ করুন"}
      </Button>
    </form>
  );

  if (compact) return body;

  return (
    <Card>
      <CardHeader title={value?.id ? "ক্যাটাগরি সম্পাদনা" : "নতুন ক্যাটাগরি"} />
      <CardBody>{body}</CardBody>
    </Card>
  );
}
