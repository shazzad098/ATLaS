"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { Field, Textarea } from "@/components/ui/form";
import { Badge } from "@/components/ui/shell";
import { importProductsAction } from "@/app/admin/actions";
import { EMPTY_ADMIN_STATE } from "@/app/admin/state";

/**
 * CSV product import (FR-03).
 *
 * A dry-run button and a commit button post the same CSV to the same action with
 * a different flag, which is exactly how the service distinguishes validation
 * from writing. The preview table below comes back in the action state, so the
 * merchant sees per-row outcomes before touching real data.
 */

const SAMPLE = `name,slug,category,sku,price,compare_price,stock,status,tags
Kurta Set,kurta-set,fashion,KS-001,2450,2990,12,ACTIVE,eid|new
Cotton Panjabi,cotton-panjabi,fashion,CP-014,1890,,8,ACTIVE,eid`;

export function ImportForm({
  storeId,
  headers,
  canCommit,
}: {
  storeId: string;
  headers: readonly string[];
  canCommit: boolean;
}) {
  const [state, submit, pending] = useActionState(importProductsAction, EMPTY_ADMIN_STATE);
  const [csv, setCsv] = useState("");

  const rows = state.data?.results ?? [];
  const problems = rows.filter((row) => row.errors.length > 0);

  return (
    <div className="space-y-4">
      <form action={submit} className="space-y-3">
        <input type="hidden" name="storeId" value={storeId} />
        <Field
          label="CSV"
          hint={`প্রয়োজনীয় column: ${headers.join(", ")} — নাম, SKU, দাম অবশ্যই থাকতে হবে`}
        >
          <Textarea
            name="csv"
            value={csv}
            onChange={(event) => setCsv(event.target.value)}
            className="min-h-40 font-mono text-xs"
            placeholder={SAMPLE}
          />
        </Field>

        <div className="flex flex-wrap items-center gap-2">
          <Button type="submit" name="commit" value="0" variant="outline" disabled={pending}>
            {pending ? "যাচাই হচ্ছে…" : "Dry-run করুন"}
          </Button>
          <Button
            type="submit"
            name="commit"
            value="1"
            disabled={pending || !canCommit}
            title={canCommit ? undefined : "Bulk import Basic plan থেকে শুরু"}
          >
            {pending ? "…" : `${rows.length > 0 ? rows.length + "টি row " : ""}Import করুন`}
          </Button>
          <button
            type="button"
            onClick={() => setCsv(SAMPLE)}
            className="text-xs font-medium text-brand-700 hover:underline"
          >
            নমুনা CSV বসান
          </button>
        </div>

        {state.message ? (
          <p className={`text-xs ${state.ok ? "text-emerald-700" : "text-red-600"}`}>{state.message}</p>
        ) : null}
      </form>

      {rows.length > 0 ? (
        <div className="overflow-x-auto rounded-lg border border-ink-200">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-ink-50 text-left text-xs text-ink-500">
                <th className="px-3 py-2">Row</th>
                <th className="px-3 py-2">SKU</th>
                <th className="px-3 py-2">পণ্য</th>
                <th className="px-3 py-2">Action</th>
                <th className="px-3 py-2">সমস্যা</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={`${row.row}-${row.sku}`} className="border-t border-ink-100">
                  <td className="px-3 py-2 text-ink-500">{row.row}</td>
                  <td className="px-3 py-2 font-mono text-xs">{row.sku || "—"}</td>
                  <td className="px-3 py-2">{row.name || "—"}</td>
                  <td className="px-3 py-2">
                    <Badge tone={row.action === "skip" ? "danger" : row.action === "update" ? "info" : "success"}>
                      {row.action}
                    </Badge>
                  </td>
                  <td className="px-3 py-2 text-xs text-red-600">{row.errors.join(", ") || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      {problems.length > 0 ? (
        <p className="text-xs text-amber-700">
          {problems.length}টি row-এ সমস্যা আছে — ঠিক না করলে সেগুলো বাদ যাবে (বাকিগুলো import হবে)।
        </p>
      ) : null}
    </div>
  );
}
