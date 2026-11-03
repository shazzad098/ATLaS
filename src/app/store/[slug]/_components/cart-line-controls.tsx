"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Minus, Plus } from "lucide-react";
import { setLineQuantityFormAction } from "@/app/store/[slug]/actions";

/**
 * Cart quantity stepper.
 *
 * The count changes instantly in the browser and is persisted in the
 * background; `router.refresh()` then re-renders the totals from the server.
 * Without this every click was a server round-trip that re-rendered the whole
 * cart page before the number moved.
 */
export function CartLineControls({
  slug,
  storeId,
  itemId,
  quantity,
  available,
}: {
  slug: string;
  storeId: string;
  itemId: string;
  quantity: number;
  available: number;
}) {
  const router = useRouter();
  const [current, setCurrent] = useState(quantity);
  const [serverQuantity, setServerQuantity] = useState(quantity);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  // The server is the source of truth after a refresh or a failed write.
  // Adjusting during render (not in an effect) keeps the optimistic value and
  // the refreshed prop in sync without a second paint.
  if (quantity !== serverQuantity) {
    setServerQuantity(quantity);
    setCurrent(quantity);
  }

  const max = available > 0 ? available : current;

  function change(next: number) {
    const clamped = Math.max(1, Math.min(next, Math.max(1, max)));
    if (clamped === current) return;

    const previous = current;
    setError(null);
    setCurrent(clamped);

    const formData = new FormData();
    formData.set("slug", slug);
    formData.set("storeId", storeId);
    formData.set("itemId", itemId);
    formData.set("quantity", String(clamped));

    startTransition(async () => {
      try {
        await setLineQuantityFormAction(formData);
        router.refresh();
      } catch {
        setCurrent(previous);
        setError("পরিমাণ হালনাগাদ করা যায়নি।");
      }
    });
  }

  return (
    <div className="flex flex-col gap-1">
      <div
        className={`flex items-center rounded-full border border-black/15 transition ${
          pending ? "opacity-70" : ""
        }`}
      >
        <button
          type="button"
          onClick={() => change(current - 1)}
          disabled={current <= 1}
          className="grid h-8 w-8 place-items-center text-base leading-none disabled:opacity-40"
          aria-label="কমান"
        >
          <Minus className="h-3.5 w-3.5" />
        </button>
        <span className="w-9 text-center text-sm font-semibold" aria-live="polite">
          {current}
        </span>
        <button
          type="button"
          onClick={() => change(current + 1)}
          disabled={available > 0 && current >= available}
          className="grid h-8 w-8 place-items-center text-base leading-none disabled:opacity-40"
          aria-label="বাড়ান"
        >
          <Plus className="h-3.5 w-3.5" />
        </button>
      </div>
      {error ? <span className="text-[11px] text-red-600">{error}</span> : null}
    </div>
  );
}
