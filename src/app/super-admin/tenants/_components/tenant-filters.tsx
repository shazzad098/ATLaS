"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Search, X } from "lucide-react";

/** Search + status/plan filters + sort for the tenant directory. */

const STATUS_OPTIONS = [
  { value: "", label: "সব স্ট্যাটাস" },
  { value: "ACTIVE", label: "সক্রিয়" },
  { value: "READ_ONLY", label: "Read-only" },
  { value: "SUSPENDED", label: "স্থগিত" },
  { value: "CANCELLED", label: "বাতিল" },
];

const SORT_OPTIONS = [
  { value: "recent", label: "সাম্প্রতিক যোগদান" },
  { value: "name", label: "নাম (অ→হ)" },
  { value: "gmv", label: "সর্বোচ্চ GMV" },
  { value: "orders", label: "সর্বোচ্চ অর্ডার" },
  { value: "fees", label: "সর্বোচ্চ বকেয়া" },
];

const selectClass =
  "h-9 rounded-md border border-slate-200 bg-white px-2.5 text-[11px] text-slate-700 outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100";

export function TenantFilters({
  plans,
  initial,
}: {
  plans: Array<{ code: string; name: string }>;
  initial: { q: string; status: string; plan: string; sort: string };
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [values, setValues] = useState(initial);

  function go(patch: Partial<typeof values>) {
    const next = { ...values, ...patch };
    setValues(next);
    const params = new URLSearchParams();
    if (next.q.trim()) params.set("q", next.q.trim());
    if (next.status) params.set("status", next.status);
    if (next.plan) params.set("plan", next.plan);
    if (next.sort && next.sort !== "recent") params.set("sort", next.sort);
    const query = params.toString();
    startTransition(() => router.push(`/super-admin/tenants${query ? `?${query}` : ""}`));
  }

  return (
    <div className={`flex flex-wrap items-center gap-2 ${pending ? "opacity-70" : ""}`}>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          go({ q: values.q });
        }}
        className="relative w-full sm:w-auto"
        role="search"
      >
        <Search className="pointer-events-none absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
        <input
          type="search"
          value={values.q}
          onChange={(event) => setValues((prev) => ({ ...prev, q: event.target.value }))}
          placeholder="নাম, মালিক বা প্ল্যান দিয়ে খুঁজুন…"
          aria-label="টেন্যান্ট খুঁজুন"
          className="h-9 w-full rounded-md border border-slate-200 bg-white pr-8 pl-8 text-[11px] text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 sm:w-64"
        />
        {values.q ? (
          <button
            type="button"
            onClick={() => go({ q: "" })}
            aria-label="সার্চ মুছুন"
            className="absolute top-1/2 right-2 -translate-y-1/2 rounded p-0.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        ) : null}
      </form>

      <select
        value={values.status}
        onChange={(event) => go({ status: event.target.value })}
        aria-label="স্ট্যাটাস ফিল্টার"
        className={selectClass}
      >
        {STATUS_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>

      <select
        value={values.plan}
        onChange={(event) => go({ plan: event.target.value })}
        aria-label="প্ল্যান ফিল্টার"
        className={selectClass}
      >
        <option value="">সব প্ল্যান</option>
        {plans.map((plan) => (
          <option key={plan.code} value={plan.code}>
            {plan.name}
          </option>
        ))}
      </select>

      <div className="ml-auto flex items-center gap-1.5">
        <span className="text-[10px] text-slate-400">সাজান:</span>
        <select
          value={values.sort}
          onChange={(event) => go({ sort: event.target.value })}
          aria-label="সাজানোর ক্রম"
          className={selectClass}
        >
          {SORT_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
