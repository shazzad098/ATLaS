"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/form";
import { setTenantStatusAction } from "@/app/super-admin/actions";
import { EMPTY_SUPER_ADMIN_STATE } from "@/app/super-admin/state";

/** Suspend / reactivate a tenant (PRD §4.5). */

const STATUSES = [
  { value: "ACTIVE", label: "সক্রিয়" },
  { value: "READ_ONLY", label: "Read-only" },
  { value: "SUSPENDED", label: "স্থগিত" },
  { value: "CANCELLED", label: "বাতিল" },
];

export function TenantStatusForm({ tenantId, status }: { tenantId: string; status: string }) {
  const [state, submit, pending] = useActionState(setTenantStatusAction, EMPTY_SUPER_ADMIN_STATE);
  const [selected, setSelected] = useState(status);

  return (
    <form action={submit} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="tenantId" value={tenantId} />
      <Select
        name="status"
        value={selected}
        onChange={(event) => setSelected(event.target.value)}
        className="w-32 py-1 text-xs"
      >
        {STATUSES.map((row) => (
          <option key={row.value} value={row.value}>
            {row.label}
          </option>
        ))}
      </Select>
      <Button type="submit" variant="outline" size="sm" disabled={pending || selected === status}>
        {pending ? "…" : "সংরক্ষণ"}
      </Button>
      {state.message ? (
        <span className={`text-xs ${state.ok ? "text-emerald-700" : "text-red-600"}`}>{state.message}</span>
      ) : null}
    </form>
  );
}
