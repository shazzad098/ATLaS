"use client";

import { useActionState } from "react";
import { Button, type ButtonSize, type ButtonVariant } from "@/components/ui/button";
import { EMPTY_ADMIN_STATE, type AdminState } from "@/app/admin/state";

/**
 * One-button server-action form.
 *
 * Admin pages are Server Components; the handful of controls that need pending
 * state and a result message use this instead of shipping a bespoke client
 * component per action.
 */

export type AdminActionFn = (prev: AdminState, formData: FormData) => Promise<AdminState>;

export function FormButton({
  action,
  fields = {},
  children,
  variant = "primary",
  size = "md",
  className,
  confirmText,
  showMessage = true,
  title,
  disabled,
}: {
  action: AdminActionFn;
  fields?: Record<string, string | number | boolean | undefined>;
  children: React.ReactNode;
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
  confirmText?: string;
  showMessage?: boolean;
  title?: string;
  disabled?: boolean;
}) {
  const [state, submit, pending] = useActionState(action, EMPTY_ADMIN_STATE);

  return (
    <form
      action={submit}
      className={className}
      onSubmit={(event) => {
        if (confirmText && !window.confirm(confirmText)) event.preventDefault();
      }}
    >
      {Object.entries(fields).map(([key, value]) =>
        value === undefined ? null : (
          <input key={key} type="hidden" name={key} value={String(value)} />
        ),
      )}
      <Button type="submit" variant={variant} size={size} disabled={pending || disabled} title={title}>
        {pending ? "…" : children}
      </Button>
      {showMessage && state.message ? (
        <p className={`mt-1 text-xs ${state.ok ? "text-emerald-700" : "text-red-600"}`}>{state.message}</p>
      ) : null}
    </form>
  );
}
