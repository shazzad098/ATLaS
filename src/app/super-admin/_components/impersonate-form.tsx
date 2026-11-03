"use client";

import { useActionState, useEffect, useState } from "react";
import { X, UserCog } from "lucide-react";
import { startImpersonationAction } from "@/app/super-admin/actions";
import { EMPTY_SUPER_ADMIN_STATE } from "@/app/super-admin/state";

/**
 * Support impersonation dialog.
 *
 * A reason and a ticket/reference are mandatory; `startImpersonationAction`
 * re-checks the Super Admin session, records the audit row and opens a
 * read-only merchant workspace for 60 minutes.
 */
export function ImpersonateForm({
  tenantId,
  tenantName,
  variant = "text",
}: {
  tenantId: string;
  tenantName: string;
  variant?: "text" | "icon";
}) {
  const [state, submit, pending] = useActionState(
    startImpersonationAction,
    EMPTY_SUPER_ADMIN_STATE,
  );
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title="Impersonate (read-only)"
        aria-label={`${tenantName} — Impersonate`}
        className={
          variant === "icon"
            ? "grid h-8 w-8 place-items-center rounded-md border border-slate-200 bg-white text-slate-500 transition hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-600"
            : "text-[11px] font-medium text-slate-700 underline-offset-2 transition hover:text-indigo-600 hover:underline"
        }
      >
        {variant === "icon" ? <UserCog className="h-3.5 w-3.5" /> : "Impersonate"}
      </button>

      {open ? (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/40 p-4 sm:items-center"
          role="presentation"
          onClick={() => setOpen(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="impersonate-title"
            className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-5 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 id="impersonate-title" className="text-sm font-semibold text-slate-900">
                  Impersonate — {tenantName}
                </h2>
                <p className="mt-1 text-[11px] leading-relaxed text-slate-500">
                  read-only · ৬০ মিনিট · কারণ ও রেফারেন্স audit log-এ রেকর্ড হবে
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="বন্ধ করুন"
                className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form action={submit} className="mt-4 space-y-3">
              <input type="hidden" name="tenantId" value={tenantId} />

              <label className="block">
                <span className="mb-1 block text-[11px] font-medium text-slate-600">কারণ</span>
                <input
                  name="reason"
                  required
                  minLength={6}
                  maxLength={500}
                  autoFocus
                  placeholder="যেমন: কাস্টমার অর্ডার সমস্যা যাচাই"
                  className="h-9 w-full rounded-md border border-slate-200 bg-white px-2.5 text-xs text-slate-800 outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                />
              </label>

              <label className="block">
                <span className="mb-1 block text-[11px] font-medium text-slate-600">
                  Ticket / reference
                </span>
                <input
                  name="reference"
                  required
                  minLength={2}
                  maxLength={120}
                  placeholder="Ticket # বা support reference"
                  className="h-9 w-full rounded-md border border-slate-200 bg-white px-2.5 text-xs text-slate-800 outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                />
              </label>

              {state.message ? (
                <p className="rounded-md bg-red-50 px-2.5 py-2 text-[11px] text-red-700">
                  {state.message}
                </p>
              ) : null}

              <div className="flex items-center justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-medium text-slate-600 hover:bg-slate-50"
                >
                  বাতিল
                </button>
                <button
                  type="submit"
                  disabled={pending}
                  className="rounded-md bg-slate-900 px-3.5 py-1.5 text-[11px] font-semibold text-white transition hover:bg-slate-800 disabled:opacity-60"
                >
                  {pending ? "খুলছে…" : "শুরু করুন"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}
