"use client";

import { useActionState, useMemo, useState } from "react";
import { ShoppingBag } from "lucide-react";
import { addToCartAction } from "@/app/store/[slug]/actions";
import { EMPTY_ACTION_STATE } from "@/app/store/[slug]/state";

/**
 * Variant picker + add-to-cart (FR-04).
 *
 * A client component only because it needs local selection state; the mutation
 * itself runs in a Server Action so stock and pricing are re-validated there.
 */

export type VariantOption = {
  id: string;
  label: string;
  priceLabel: string;
  available: number;
};

export function AddToCart({
  storeId,
  slug,
  options,
}: {
  storeId: string;
  slug: string;
  options: VariantOption[];
}) {
  const [selectedId, setSelectedId] = useState(options[0]?.id ?? "");
  const [quantity, setQuantity] = useState(1);
  const [state, formAction, pending] = useActionState(addToCartAction, EMPTY_ACTION_STATE);

  const selected = useMemo(
    () => options.find((option) => option.id === selectedId) ?? options[0],
    [options, selectedId],
  );

  if (options.length === 0) {
    return (
      <p className="rounded-lg border border-black/10 px-4 py-3 text-sm">এই পণ্যটি এখন পাওয়া যাচ্ছে না।</p>
    );
  }

  const max = Math.max(1, Math.min(selected?.available ?? 1, 20));
  const soldOut = !selected || selected.available <= 0;

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="storeId" value={storeId} />
      <input type="hidden" name="slug" value={slug} />
      <input type="hidden" name="variantId" value={selectedId} />
      <input type="hidden" name="quantity" value={quantity} />

      {options.length > 1 ? (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-ink-600">ভ্যারিয়েন্ট বাছুন</p>
          <div className="flex flex-wrap gap-2">
            {options.map((option) => {
              const active = option.id === selectedId;
              return (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => {
                    setSelectedId(option.id);
                    setQuantity(1);
                  }}
                  className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                    active ? "border-transparent text-white" : "border-black/15 hover:border-black/40"
                  }`}
                  style={active ? { background: "var(--store-primary)" } : undefined}
                  disabled={option.available <= 0}
                >
                  {option.label}
                  <span className={`ml-1.5 ${active ? "text-white/80" : "muted"}`}>
                    {option.priceLabel}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      ) : null}

      <div className="flex items-center gap-3">
        <div className="flex items-center rounded-full border border-black/15">
          <button
            type="button"
            onClick={() => setQuantity((value) => Math.max(1, value - 1))}
            className="grid h-9 w-9 place-items-center text-lg leading-none"
            aria-label="কমান"
          >
            −
          </button>
          <span className="w-10 text-center text-sm font-semibold">{quantity}</span>
          <button
            type="button"
            onClick={() => setQuantity((value) => Math.min(max, value + 1))}
            className="grid h-9 w-9 place-items-center text-lg leading-none"
            aria-label="বাড়ান"
          >
            +
          </button>
        </div>
        {selected ? (
          <span className="text-xs text-ink-500">
            {selected.available > 0 ? `স্টকে ${selected.available}টি` : "স্টক নেই"}
          </span>
        ) : null}
      </div>

      <button
        type="submit"
        disabled={pending || soldOut}
        className="store-btn inline-flex w-full items-center justify-center gap-2 px-6 py-3 text-sm font-semibold text-white transition disabled:opacity-60"
        style={{ background: "var(--store-primary)" }}
      >
        <ShoppingBag className="h-4 w-4" />
        {pending ? "যোগ করা হচ্ছে…" : soldOut ? "স্টক নেই" : "কার্টে যোগ করুন"}
      </button>

      {state.message ? (
        <p
          role="status"
          className={`text-sm font-medium ${state.ok ? "text-emerald-700" : "text-red-600"}`}
        >
          {state.message}
        </p>
      ) : null}
    </form>
  );
}
