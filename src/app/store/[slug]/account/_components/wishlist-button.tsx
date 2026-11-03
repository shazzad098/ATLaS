"use client";

import { useActionState } from "react";
import { Heart } from "lucide-react";
import { toggleWishlistAction } from "@/app/store/[slug]/account/actions";
import { EMPTY_BUYER_STATE } from "@/app/store/[slug]/account/state";

/** Heart toggle on the product page; updates the real wishlist table. */

export function WishlistButton({
  slug,
  productId,
  productSlug,
  saved,
}: {
  slug: string;
  productId: string;
  productSlug: string;
  saved: boolean;
}) {
  const [state, submit, pending] = useActionState(toggleWishlistAction, EMPTY_BUYER_STATE);
  const active = state.saved ?? saved;

  return (
    <form action={submit}>
      <input type="hidden" name="slug" value={slug} />
      <input type="hidden" name="productId" value={productId} />
      <input type="hidden" name="productSlug" value={productSlug} />
      <button
        type="submit"
        disabled={pending}
        aria-pressed={active}
        className={`store-btn inline-flex items-center gap-1.5 border px-3 py-2 text-xs font-medium transition disabled:opacity-60 ${
          active
            ? "border-[var(--store-primary)] text-[var(--store-primary)]"
            : "border-black/10 hover:border-black/25"
        }`}
      >
        <Heart className={`h-4 w-4 ${active ? "fill-current" : ""}`} />
        {pending ? "…" : active ? "উইশলিস্টে আছে" : "উইশলিস্টে রাখুন"}
      </button>
      {state.message ? (
        <p className={`mt-1 text-[11px] ${state.ok ? "text-emerald-700" : "text-red-600"}`}>
          {state.message}
        </p>
      ) : null}
    </form>
  );
}
