"use client";

import { useActionState, useState } from "react";
import { ChevronDown, ShieldCheck, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/shell";
import { Field, Input, Select } from "@/components/ui/form";
import {
  createRoleAction,
  deleteRoleAction,
  inviteStaffAction,
  removeStaffAction,
  updateRoleAction,
  updateStaffRoleAction,
} from "@/app/admin/actions";
import { EMPTY_ADMIN_STATE } from "@/app/admin/state";

/**
 * Staff & role forms (FR-02, PRD §4.4).
 *
 * The permission pickers are client-side only for the checkboxes' own state;
 * the server actions re-validate every permission and enforce the Owner-only
 * rules for tenant-defined roles.
 */

export type RoleOption = { code: string; name: string; isSystem: boolean };
export type PermissionOption = { value: string; label: string };
export type PermissionGroupOption = {
  key: string;
  label: string;
  description: string;
  permissions: PermissionOption[];
};

function StaffHeader({ title, description }: { title: string; description?: string }) {
  return (
    <div>
      <p className="text-sm font-semibold text-ink-900">{title}</p>
      {description ? <p className="mt-0.5 text-xs text-ink-500">{description}</p> : null}
    </div>
  );
}

/** Invite a teammate (FR-02). */
export function StaffInviteForm({
  roles,
  seatHint,
}: {
  roles: RoleOption[];
  seatHint?: string;
}) {
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
          {roles.map((role) => (
            <option key={role.code} value={role.code}>
              {role.name}
              {role.isSystem ? "" : " (কাস্টম)"}
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
  roles,
  membershipId,
  roleCode,
  roleName,
  isOwner,
  canWrite,
  isSelf,
}: {
  roles: RoleOption[];
  membershipId: string;
  roleCode: string;
  roleName: string;
  isOwner: boolean;
  canWrite: boolean;
  isSelf: boolean;
}) {
  const [roleState, roleSubmit, rolePending] = useActionState(updateStaffRoleAction, EMPTY_ADMIN_STATE);
  const [removeState, removeSubmit, removePending] = useActionState(removeStaffAction, EMPTY_ADMIN_STATE);
  const [selected, setSelected] = useState(roleCode);

  if (isOwner) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-ink-600">
        <ShieldCheck className="h-3.5 w-3.5 text-brand-600" />
        Owner
      </span>
    );
  }

  if (!canWrite || isSelf) {
    return (
      <span className="text-xs text-ink-500">
        {roleName}
        {isSelf ? <span className="ml-1.5 text-ink-400">(আপনি)</span> : null}
      </span>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <form action={roleSubmit} className="flex items-center gap-2">
        <input type="hidden" name="membershipId" value={membershipId} />
        <Select
          name="roleCode"
          value={selected}
          onChange={(event) => setSelected(event.target.value)}
          className="w-40 py-1 text-xs"
          aria-label={`${roleName} — নতুন role`}
        >
          {roles.map((role) => (
            <option key={role.code} value={role.code}>
              {role.name}
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
        <span className={`text-xs ${roleState.ok ? "text-emerald-700" : "text-red-600"}`}>
          {roleState.message}
        </span>
      ) : null}
      {removeState.message ? (
        <span className={`text-xs ${removeState.ok ? "text-emerald-700" : "text-red-600"}`}>
          {removeState.message}
        </span>
      ) : null}
    </div>
  );
}

function PermissionPicker({
  groups,
  selected,
}: {
  groups: PermissionGroupOption[];
  selected: string[];
}) {
  const [checked, setChecked] = useState<string[]>(selected);

  const toggle = (value: string) => {
    setChecked((current) =>
      current.includes(value) ? current.filter((item) => item !== value) : [...current, value],
    );
  };

  const toggleGroup = (group: PermissionGroupOption) => {
    const values = group.permissions.map((permission) => permission.value);
    const allSelected = values.every((value) => checked.includes(value));
    setChecked((current) =>
      allSelected
        ? current.filter((value) => !values.includes(value))
        : [...new Set([...current, ...values])],
    );
  };

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {groups.map((group) => {
        const allSelected = group.permissions.every((permission) =>
          checked.includes(permission.value),
        );
        return (
          <fieldset key={group.key} className="rounded-lg border border-ink-200 p-3">
            <legend className="px-1 text-xs font-semibold text-ink-800">{group.label}</legend>
            <p className="mb-2 text-[11px] text-ink-500">{group.description}</p>
            <button
              type="button"
              onClick={() => toggleGroup(group)}
              className="mb-2 text-[11px] font-semibold text-brand-700 hover:underline"
            >
              {allSelected ? "সব বাদ দিন" : "সব বেছে নিন"}
            </button>
            <div className="space-y-1.5">
              {group.permissions.map((permission) => (
                <label key={permission.value} className="flex items-start gap-2 text-xs text-ink-700">
                  <input
                    type="checkbox"
                    name="permissions"
                    value={permission.value}
                    checked={checked.includes(permission.value)}
                    onChange={() => toggle(permission.value)}
                    className="mt-0.5 h-3.5 w-3.5 rounded border-ink-300 text-brand-600 focus:ring-brand-500"
                  />
                  <span>{permission.label}</span>
                </label>
              ))}
            </div>
          </fieldset>
        );
      })}
    </div>
  );
}

/** Create a tenant-defined role. Only rendered for the Owner. */
export function RoleCreateForm({ groups }: { groups: PermissionGroupOption[] }) {
  const [state, submit, pending] = useActionState(createRoleAction, EMPTY_ADMIN_STATE);
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <Button type="button" variant="outline" onClick={() => setOpen(true)}>
        নতুন কাস্টম রোল
      </Button>
    );
  }

  return (
    <form action={submit} className="space-y-3 rounded-xl border border-ink-200 bg-ink-50/40 p-4">
      {state.message ? <Alert tone={state.ok ? "success" : "danger"}>{state.message}</Alert> : null}
      <StaffHeader
        title="নতুন কাস্টম রোল"
        description="নাম দিন এবং এই রোলের সদস্যরা ঠিক কী করতে পারবে তা বেছে নিন।"
      />
      <Field label="রোলের নাম" required>
        <Input name="name" required placeholder="যেমন: ইনভেন্টরি ম্যানেজার" />
      </Field>
      <PermissionPicker groups={groups} selected={[]} />
      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={pending}>
          {pending ? "তৈরি হচ্ছে…" : "রোল তৈরি করুন"}
        </Button>
        <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
          বাতিল
        </Button>
      </div>
    </form>
  );
}

/** Edit or delete one custom role, collapsed behind a summary row. */
export function RoleEditForm({
  roleId,
  name,
  groups,
  selected,
  memberCount,
}: {
  roleId: string;
  name: string;
  groups: PermissionGroupOption[];
  selected: string[];
  memberCount: number;
}) {
  const [state, submit, pending] = useActionState(updateRoleAction, EMPTY_ADMIN_STATE);
  const [deleteState, deleteSubmit, deletePending] = useActionState(
    deleteRoleAction,
    EMPTY_ADMIN_STATE,
  );
  const [open, setOpen] = useState(false);

  return (
    <div className="rounded-xl border border-ink-200">
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
        <div>
          <p className="text-sm font-semibold text-ink-900">{name}</p>
          <p className="text-[11px] text-ink-500">
            {selected.length}টি অনুমতি · {memberCount} জন সদস্য
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => setOpen((value) => !value)}>
            <ChevronDown className={`h-3.5 w-3.5 transition ${open ? "rotate-180" : ""}`} />
            {open ? "বন্ধ করুন" : "সম্পাদনা"}
          </Button>
          <form
            action={deleteSubmit}
            onSubmit={(event) => {
              if (!window.confirm("এই কাস্টম রোলটি মুছে ফেলতে চান?")) event.preventDefault();
            }}
          >
            <input type="hidden" name="roleId" value={roleId} />
            <Button
              type="submit"
              variant="ghost"
              size="sm"
              disabled={deletePending || memberCount > 0}
              title={memberCount > 0 ? "আগে সদস্যদের অন্য role দিন" : "রোল মুছুন"}
            >
              <Trash2 className="h-3.5 w-3.5" />
              মুছুন
            </Button>
          </form>
        </div>
      </div>

      {open ? (
        <form action={submit} className="space-y-3 border-t border-ink-100 p-4">
          {state.message ? (
            <Alert tone={state.ok ? "success" : "danger"}>{state.message}</Alert>
          ) : null}
          <Field label="রোলের নাম" required>
            <Input name="name" required defaultValue={name} />
          </Field>
          <PermissionPicker groups={groups} selected={selected} />
          <input type="hidden" name="roleId" value={roleId} />
          <Button type="submit" disabled={pending}>
            {pending ? "সেভ হচ্ছে…" : "পরিবর্তন সেভ করুন"}
          </Button>
        </form>
      ) : null}

      {deleteState.message ? (
        <p
          className={`px-4 pb-3 text-xs ${
            deleteState.ok ? "text-emerald-700" : "text-red-600"
          }`}
        >
          {deleteState.message}
        </p>
      ) : null}
    </div>
  );
}
