"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/form";
import { updateTicketAction } from "@/app/super-admin/actions";
import { EMPTY_SUPER_ADMIN_STATE } from "@/app/super-admin/state";

/** Triage control for a support ticket (PRD §11). */

const STATUSES = [
  { value: "OPEN", label: "খোলা" },
  { value: "PENDING", label: "অপেক্ষমাণ" },
  { value: "RESOLVED", label: "সমাধান" },
  { value: "CLOSED", label: "বন্ধ" },
];

const PRIORITIES = [
  { value: "LOW", label: "কম" },
  { value: "NORMAL", label: "সাধারণ" },
  { value: "HIGH", label: "উচ্চ" },
  { value: "URGENT", label: "জরুরি" },
];

export function TicketTriageForm({
  ticketId,
  status,
  priority,
  assignedTo,
}: {
  ticketId: string;
  status: string;
  priority: string;
  assignedTo: string | null;
}) {
  const [state, submit, pending] = useActionState(updateTicketAction, EMPTY_SUPER_ADMIN_STATE);
  const [selected, setSelected] = useState(status);

  return (
    <form action={submit} className="flex flex-wrap items-end gap-2">
      <input type="hidden" name="ticketId" value={ticketId} />

      <Select
        name="status"
        value={selected}
        onChange={(event) => setSelected(event.target.value)}
        className="w-28 py-1 text-xs"
      >
        {STATUSES.map((row) => (
          <option key={row.value} value={row.value}>
            {row.label}
          </option>
        ))}
      </Select>

      <Select name="priority" defaultValue={priority} className="w-28 py-1 text-xs">
        {PRIORITIES.map((row) => (
          <option key={row.value} value={row.value}>
            {row.label}
          </option>
        ))}
      </Select>

      <Input
        name="assignedTo"
        defaultValue={assignedTo ?? ""}
        placeholder="assignee id"
        className="w-40 py-1 text-xs"
      />

      <Button type="submit" variant="outline" size="sm" disabled={pending}>
        {pending ? "…" : "সংরক্ষণ"}
      </Button>

      {state.message ? (
        <span className={`text-xs ${state.ok ? "text-emerald-700" : "text-red-600"}`}>{state.message}</span>
      ) : null}
    </form>
  );
}
