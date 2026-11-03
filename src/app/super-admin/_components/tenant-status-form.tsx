"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { setTenantStatusAction } from "@/app/super-admin/actions";
import { EMPTY_SUPER_ADMIN_STATE } from "@/app/super-admin/state";

/** Suspend / reactivate a tenant (PRD §4.5) — inline select + save. */

const STATUSES = [
  { value: "ACTIVE", label: "সক্রিয়" },
  { value: "READ_ONLY", label: "Read-only" },
  { value: "SUSPENDED", label: "স্থগিত" },
  { value: "CANCELLED", label: "বাতিল" },
];

export function TenantStatusForm({ tenantId, status }: { tenantId: string; status: string }) {
  const [state, submit, pending] = useActionState(setTenantStatusAction, EMPTY_SUPER_ADMIN_STATE);
  const [selected, setSelected] = useState(status);
  const router = useRouter();

  // Pull the authoritative row after a save so the select (and the enabled
  // state of the button) reflect the database, not just local state.
  useEffect(() => {
    if (state.ok) router.refresh();
  }, [state, router]);

  return (
    <form action={submit} className="space-y-1.5">
      <input type="hidden" name="tenantId" value={tenantId} />
      <select
        name="status"
        value={selected}
        onChange={(event) => setSelected(event.target.value)}
        aria-label="Tenant status"
        className="h-8 w-full rounded-md border border-slate-200 bg-white px-2 text-[11px] text-slate-800 outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
      >
        {STATUSES.map((row) => (
          <option key={row.value} value={row.value}>
            {row.label}
          </option>
        ))}
      </select>

      <button
        type="submit"
        disabled={pending || selected === status}
        className="rounded-md border border-slate-200 bg-white px-3 py-1 text-[11px] font-medium text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {pending ? "…" : "সংরক্ষণ"}
      </button>

      {state.message ? (
        <p className={`text-[10px] ${state.ok ? "text-emerald-600" : "text-red-600"}`}>
          {state.message}
        </p>
      ) : null}
    </form>
  );
}
