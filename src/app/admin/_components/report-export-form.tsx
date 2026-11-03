"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/shell";
import { Field, Input, Select } from "@/components/ui/form";
import { EMPTY_ADMIN_STATE } from "@/app/admin/state";
import {
  createExportJobAction,
  createExportScheduleAction,
} from "@/app/admin/actions";

/**
 * Report export controls. Jobs are persisted server-side; the result links to
 * `/admin/reports/exports/[jobId]`, which streams the generated CSV.
 */

type Option = { value: string; label: string };

export function ReportExportForm({
  storeId,
  types,
  from,
  to,
}: {
  storeId: string;
  types: Option[];
  from: string;
  to: string;
}) {
  const [state, submit, pending] = useActionState(createExportJobAction, EMPTY_ADMIN_STATE);

  return (
    <form action={submit} className="space-y-3">
      <input type="hidden" name="storeId" value={storeId} />
      {state.message ? (
        <Alert tone={state.ok ? "success" : "danger"}>
          <span>{state.message}</span>
          {state.downloadUrl ? (
            <Link href={state.downloadUrl} className="ml-2 font-semibold underline">
              CSV ডাউনলোড
            </Link>
          ) : null}
        </Alert>
      ) : null}
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="রিপোর্ট">
          <Select name="type" defaultValue="orders">
            {types.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="শুরু">
          <Input type="date" name="from" defaultValue={from} />
        </Field>
        <Field label="শেষ">
          <Input type="date" name="to" defaultValue={to} />
        </Field>
      </div>
      <Button type="submit" disabled={pending} size="sm">
        {pending ? "তৈরি হচ্ছে…" : "CSV export করুন"}
      </Button>
    </form>
  );
}

export function ExportScheduleForm({
  storeId,
  types,
}: {
  storeId: string;
  types: Option[];
}) {
  const [state, submit, pending] = useActionState(createExportScheduleAction, EMPTY_ADMIN_STATE);

  return (
    <form action={submit} className="space-y-3">
      <input type="hidden" name="storeId" value={storeId} />
      {state.message ? <Alert tone={state.ok ? "success" : "danger"}>{state.message}</Alert> : null}
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="রিপোর্ট">
          <Select name="type" defaultValue="orders">
            {types.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="কতবার">
          <Select name="frequency" defaultValue="DAILY">
            <option value="DAILY">প্রতিদিন</option>
            <option value="WEEKLY">প্রতি সপ্তাহে</option>
          </Select>
        </Field>
        <Field label="প্রাপকের email" hint="কমা দিয়ে একাধিক">
          <Input name="recipients" placeholder="owner@example.com" />
        </Field>
      </div>
      <Button type="submit" disabled={pending} size="sm" variant="outline">
        {pending ? "সেভ হচ্ছে…" : "Scheduled export চালু করুন"}
      </Button>
    </form>
  );
}
