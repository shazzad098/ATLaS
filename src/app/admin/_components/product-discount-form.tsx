"use client";

import { useActionState } from "react";
import { BadgePercent, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert, Card, CardBody, CardHeader } from "@/components/ui/shell";
import { Field, Input } from "@/components/ui/form";
import { applyProductDiscountAction } from "@/app/admin/actions";
import { EMPTY_ADMIN_STATE } from "@/app/admin/state";
import { bnNumber } from "@/lib/dates";

/**
 * Apply or clear a percentage discount on one product. The action writes real
 * prices (comparePrice keeps the original), so the storefront badge and
 * strikethrough update automatically.
 */
export function ProductDiscountForm({
  storeId,
  productId,
  currentPercent,
}: {
  storeId: string;
  productId: string;
  /** Highest currently applied discount, 0 = none. */
  currentPercent: number;
}) {
  const [state, submit, pending] = useActionState(applyProductDiscountAction, EMPTY_ADMIN_STATE);

  return (
    <Card>
      <CardHeader
        title={<span className="flex items-center gap-1.5"><BadgePercent className="h-4 w-4" /> ডিসকাউন্ট</span>}
        description="সব variant-এর দাম একসাথে কমবে, আগের দাম আগের দাম হিসেবে দেখাবে"
      />
      <CardBody className="space-y-3">
        {state.message ? <Alert tone={state.ok ? "success" : "danger"}>{state.message}</Alert> : null}

        {currentPercent > 0 ? (
          <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800">
            বর্তমানে <strong>{bnNumber(currentPercent)}%</strong> ছাড় চালু আছে।
          </p>
        ) : (
          <p className="text-xs text-ink-500">এখনো কোনো ডিসকাউন্ট চালু নেই।</p>
        )}

        <form action={submit} className="flex items-end gap-2">
          <input type="hidden" name="storeId" value={storeId} />
          <input type="hidden" name="productId" value={productId} />
          <Field label="ডিসকাউন্ট (%)" className="flex-1">
            <Input
              name="percent"
              type="number"
              min={1}
              max={90}
              step={1}
              required
              placeholder="যেমন: ২০"
              defaultValue={currentPercent > 0 ? currentPercent : undefined}
            />
          </Field>
          <Button type="submit" disabled={pending} className="shrink-0">
            <BadgePercent className="h-4 w-4" />
            {pending ? "…" : "প্রয়োগ"}
          </Button>
          <Button
            type="submit"
            name="mode"
            value="clear"
            variant="outline"
            disabled={pending || currentPercent === 0}
            className="shrink-0"
          >
            <Trash2 className="h-4 w-4" /> সরান
          </Button>
        </form>

        <p className="text-xs text-ink-400">
          ডিসকাউন্ট আবার প্রয়োগ করলে আগের মূল দাম থেকে হিসাব হয় — নতুন দামের উপর ঢেকে যায় না। স্টোরফ্রন্টে &ldquo;ছাড়&rdquo; ব্যাজ ও কাটা দাম স্বয়ংক্রিয়ভাবে দেখাবে।
        </p>
      </CardBody>
    </Card>
  );
}
