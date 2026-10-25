"use client";

import { useActionState } from "react";
import { createAnnouncementAction } from "@/app/super-admin/actions";

/** Client component for the announcement creation form (PRD §4.5). */

export function AnnouncementForm() {
  const [state, action, pending] = useActionState(createAnnouncementAction, {
    ok: false,
    message: "",
  });

  return (
    <form action={action} className="space-y-3">
      <div>
        <label className="mb-1 block text-[12.5px] font-medium text-ink-600">শিরোনাম</label>
        <input
          type="text"
          name="title"
          required
          placeholder="অ্যানাউন্সমেন্টের শিরোনাম"
          className="w-full rounded-lg border border-ink-200 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
        />
      </div>

      <div>
        <label className="mb-1 block text-[12.5px] font-medium text-ink-600">বিবরণ</label>
        <textarea
          name="body"
          required
          rows={3}
          placeholder="বিস্তারিত বার্তা..."
          className="w-full resize-none rounded-lg border border-ink-200 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="mb-1 block text-[12.5px] font-medium text-ink-600">দর্শক</label>
          <select
            name="audience"
            className="w-full rounded-lg border border-ink-200 px-3 py-2 text-sm outline-none focus:border-brand-500"
          >
            <option value="all">সবাই</option>
            <option value="free">Free plan</option>
            <option value="paid">Paid plan</option>
          </select>
        </div>
        <div>
          <label className="mb-1 block text-[12.5px] font-medium text-ink-600">ধরন</label>
          <select
            name="level"
            className="w-full rounded-lg border border-ink-200 px-3 py-2 text-sm outline-none focus:border-brand-500"
          >
            <option value="info">Info</option>
            <option value="warning">Warning</option>
            <option value="success">Success</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="mb-1 block text-[12.5px] font-medium text-ink-600">শুরু (ঐচ্ছিক)</label>
          <input
            type="datetime-local"
            name="startsAt"
            className="w-full rounded-lg border border-ink-200 px-3 py-2 text-sm outline-none focus:border-brand-500"
          />
        </div>
        <div>
          <label className="mb-1 block text-[12.5px] font-medium text-ink-600">শেষ (ঐচ্ছিক)</label>
          <input
            type="datetime-local"
            name="endsAt"
            className="w-full rounded-lg border border-ink-200 px-3 py-2 text-sm outline-none focus:border-brand-500"
          />
        </div>
      </div>

      <div>
        <label className="mb-1 block text-[12.5px] font-medium text-ink-600">স্ট্যাটাস</label>
        <select
          name="status"
          className="w-full rounded-lg border border-ink-200 px-3 py-2 text-sm outline-none focus:border-brand-500"
        >
          <option value="draft">Draft</option>
          <option value="published">প্রকাশ করুন</option>
        </select>
      </div>

      {state.message && (
        <p className={`text-xs ${state.ok ? "text-emerald-600" : "text-red-600"}`}>{state.message}</p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-lg bg-brand-600 py-2 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:opacity-60"
      >
        {pending ? "তৈরি হচ্ছে..." : "তৈরি করুন"}
      </button>
    </form>
  );
}
