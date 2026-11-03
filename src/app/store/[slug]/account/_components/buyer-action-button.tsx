"use client";

import { useActionState } from "react";
import type { BuyerState } from "@/app/store/[slug]/account/state";

/** Small server-action form button for the buyer panel (pending + message). */

export type BuyerActionFn = (prev: BuyerState, formData: FormData) => Promise<BuyerState>;

export function BuyerActionButton({
  action,
  fields,
  children,
  className,
  confirmText,
  showMessage = true,
}: {
  action: BuyerActionFn;
  fields: Record<string, string | number | undefined>;
  children: React.ReactNode;
  className?: string;
  confirmText?: string;
  showMessage?: boolean;
}) {
  const [state, submit, pending] = useActionState(action, { ok: false, message: "" });

  return (
    <form
      action={submit}
      className={className}
      onSubmit={(event) => {
        if (confirmText && !window.confirm(confirmText)) event.preventDefault();
      }}
    >
      {Object.entries(fields).map(([key, value]) =>
        value === undefined ? null : <input key={key} type="hidden" name={key} value={String(value)} />,
      )}
      <button
        type="submit"
        disabled={pending}
        className="text-xs font-medium text-red-600 hover:underline disabled:opacity-60"
      >
        {pending ? "…" : children}
      </button>
      {showMessage && state.message ? (
        <p className={`mt-1 text-[11px] ${state.ok ? "text-emerald-700" : "text-red-600"}`}>
          {state.message}
        </p>
      ) : null}
    </form>
  );
}
