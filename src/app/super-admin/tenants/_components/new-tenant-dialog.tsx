"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, X } from "lucide-react";
import { createTenantAction } from "@/app/super-admin/actions";
import { EMPTY_SUPER_ADMIN_STATE } from "@/app/super-admin/state";

const inputClass =
  "h-9 w-full rounded-md border border-slate-200 bg-white px-2.5 text-xs text-slate-800 outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100";

/** Creates a merchant workspace (owner + roles + plan subscription). */
export function NewTenantDialog({
  plans,
}: {
  plans: Array<{ code: string; name: string }>;
}) {
  const [state, submit, pending] = useActionState(createTenantAction, EMPTY_SUPER_ADMIN_STATE);
  const [open, setOpen] = useState(false);
  const router = useRouter();

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  useEffect(() => {
    if (state.ok) router.refresh();
  }, [state.ok, router]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-indigo-600 px-3 text-xs font-semibold text-white shadow-sm shadow-indigo-600/20 transition hover:bg-indigo-500"
      >
        <Plus className="h-3.5 w-3.5" />
        নতুন টেন্যান্ট যুক্ত করুন
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
            aria-labelledby="new-tenant-title"
            className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-5 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 id="new-tenant-title" className="text-sm font-semibold text-slate-900">
                  নতুন টেন্যান্ট
                </h2>
                <p className="mt-1 text-[11px] leading-relaxed text-slate-500">
                  owner-এর মোবাইল নম্বর দিয়ে account তৈরি হবে; তিনি OTP দিয়ে লগইন করবেন।
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
              <label className="block">
                <span className="mb-1 block text-[11px] font-medium text-slate-600">
                  ওয়ার্কস্পেসের নাম
                </span>
                <input
                  name="tenantName"
                  required
                  minLength={2}
                  maxLength={120}
                  autoFocus
                  placeholder="যেমন: Nokshi Studio"
                  className={inputClass}
                />
              </label>

              <label className="block">
                <span className="mb-1 block text-[11px] font-medium text-slate-600">
                  মালিকের নাম
                </span>
                <input
                  name="ownerName"
                  required
                  minLength={2}
                  maxLength={120}
                  placeholder="যেমন: শাকিব আল হাসান"
                  className={inputClass}
                />
              </label>

              <label className="block">
                <span className="mb-1 block text-[11px] font-medium text-slate-600">
                  মালিকের মোবাইল
                </span>
                <input
                  name="ownerPhone"
                  required
                  inputMode="tel"
                  placeholder="01712345678"
                  className={inputClass}
                />
              </label>

              <label className="block">
                <span className="mb-1 block text-[11px] font-medium text-slate-600">প্ল্যান</span>
                <select name="planCode" defaultValue={plans[0]?.code ?? "free"} className={inputClass}>
                  {plans.map((plan) => (
                    <option key={plan.code} value={plan.code}>
                      {plan.name}
                    </option>
                  ))}
                </select>
              </label>

              {state.message ? (
                <p
                  className={`rounded-md px-2.5 py-2 text-[11px] ${
                    state.ok ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"
                  }`}
                >
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
                  className="rounded-md bg-indigo-600 px-3.5 py-1.5 text-[11px] font-semibold text-white transition hover:bg-indigo-500 disabled:opacity-60"
                >
                  {pending ? "তৈরি হচ্ছে…" : "তৈরি করুন"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}
