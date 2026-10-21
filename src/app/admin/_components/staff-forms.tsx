"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/shell";
import { Field, Input, Select } from "@/components/ui/form";
import {
  inviteStaffAction,
  removeStaffAction,
  updateStaffRoleAction,
} from "@/app/admin/actions";
import { EMPTY_ADMIN_STATE } from "@/app/admin/state";

const ROLES = [
  { value: "ADMIN", label: "Admin" },
  { value: "MANAGER", label: "Manager" },
  { value: "STAFF", label: "Staff" },
  { value: "SUPPORT", label: "Support" },
];

/** Invite a teammate (FR-02). */
export function StaffInviteForm({ seatHint }: { seatHint?: string }) {
  const [state, submit, pending] = useActionState(inviteStaffAction, EMPTY_ADMIN_STATE);

  return (
    <form action={submit} className="space-y-4">
      {state.message ? <Alert tone={state.ok ? "success" : "danger"}>{state.message}</Alert> : null}

      <Field label="নাম" required>
        <Input name="name" required placeholder="সদস্যের নাম" />
      </Field>
      <Field label="মোবাইল নম্বর" required hint={seatHint}>
        <Input name="phone" required inputMode="tel" placeholder="01XXXXXXXXX" />
      </Field>
      <Field label="Role">
        <Select name="roleCode" defaultValue="STAFF">
          {ROLES.map((role) => (
            <option key={role.value} value={role.value}>
              {role.label}
            </option>
          ))}
        </Select>
      </Field>

      <Button type="submit" disabled={pending}>
        {pending ? "যোগ হচ্ছে…" : "টিমে যোগ করুন"}
      </Button>
    </form>
  );
}

/** Change a member's role or remove them (FR-02). */
export function StaffRowActions({
  membershipId,
  roleCode,
  isOwner,
}: {
  membershipId: string;
  roleCode: string;
  isOwner: boolean;
}) {
  const [roleState, roleSubmit, rolePending] = useActionState(updateStaffRoleAction, EMPTY_ADMIN_STATE);
  const [removeState, removeSubmit, removePending] = useActionState(removeStaffAction, EMPTY_ADMIN_STATE);
  const [selected, setSelected] = useState(roleCode);

  if (isOwner) return <span className="text-xs text-ink-400">Owner</span>;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <form action={roleSubmit} className="flex items-center gap-2">
        <input type="hidden" name="membershipId" value={membershipId} />
        <Select
          name="roleCode"
          value={selected}
          onChange={(event) => setSelected(event.target.value)}
          className="w-32 py-1 text-xs"
        >
          {ROLES.map((role) => (
            <option key={role.value} value={role.value}>
              {role.label}
            </option>
          ))}
        </Select>
        <Button type="submit" variant="outline" size="sm" disabled={rolePending || selected === roleCode}>
          {rolePending ? "…" : "Role"}
        </Button>
      </form>

      <form
        action={removeSubmit}
        onSubmit={(event) => {
          if (!window.confirm("এই সদস্যকে টিম থেকে সরাতে চান?")) event.preventDefault();
        }}
      >
        <input type="hidden" name="membershipId" value={membershipId} />
        <Button type="submit" variant="ghost" size="sm" disabled={removePending}>
          সরান
        </Button>
      </form>

      {roleState.message ? (
        <span className={`text-xs ${roleState.ok ? "text-emerald-700" : "text-red-600"}`}>{roleState.message}</span>
      ) : null}
      {removeState.message ? (
        <span className={`text-xs ${removeState.ok ? "text-emerald-700" : "text-red-600"}`}>{removeState.message}</span>
      ) : null}
    </div>
  );
}
