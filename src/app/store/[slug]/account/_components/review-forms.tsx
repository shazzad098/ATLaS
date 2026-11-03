"use client";

import { useActionState, useState } from "react";
import { Loader2, Star } from "lucide-react";
import {
  addCommentAction,
  deleteReviewAction,
  saveReviewAction,
} from "@/app/store/[slug]/account/actions";
import { EMPTY_BUYER_STATE } from "@/app/store/[slug]/account/state";

/** Buyer review + comment forms (used on the product page and in the panel). */

const fieldClass =
  "w-full rounded-[var(--store-button-radius)] border border-black/10 bg-white px-3 py-2 text-sm outline-none transition focus:border-[var(--store-primary)] focus:ring-2 focus:ring-black/5";

function Message({ ok, message }: { ok: boolean; message: string }) {
  if (!message) return null;
  return (
    <p className={`text-[11px] ${ok ? "text-emerald-700" : "text-red-600"}`}>{message}</p>
  );
}

export function ReviewForm({
  slug,
  productId,
  productSlug,
}: {
  slug: string;
  productId: string;
  productSlug: string;
}) {
  const [state, submit, pending] = useActionState(saveReviewAction, EMPTY_BUYER_STATE);
  const [rating, setRating] = useState(5);
  const [hover, setHover] = useState(0);
  const lit = hover || rating;

  return (
    <form action={submit} className="space-y-3">
      <input type="hidden" name="slug" value={slug} />
      <input type="hidden" name="productId" value={productId} />
      <input type="hidden" name="productSlug" value={productSlug} />
      <input type="hidden" name="rating" value={rating} />

      <div>
        <p className="mb-1.5 text-xs font-medium">রেটিং</p>
        <div role="radiogroup" aria-label="রেটিং" className="flex items-center gap-0.5">
          {[1, 2, 3, 4, 5].map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setRating(value)}
              onMouseEnter={() => setHover(value)}
              onMouseLeave={() => setHover(0)}
              onFocus={() => setHover(value)}
              onBlur={() => setHover(0)}
              aria-label={`${value} স্টার`}
              aria-checked={rating === value}
              role="radio"
              className="rounded p-0.5 transition hover:scale-110"
            >
              <Star
                className={`h-7 w-7 transition ${
                  value <= lit
                    ? "fill-amber-400 text-amber-400 drop-shadow-[0_0_7px_rgba(251,191,36,0.65)]"
                    : "text-black/20"
                }`}
              />
            </button>
          ))}
          <span className="ml-1.5 text-[11px] font-medium text-black/50">{rating}/৫</span>
        </div>
      </div>

      <input
        className={fieldClass}
        name="title"
        placeholder="শিরোনাম (ঐচ্ছিক)"
        maxLength={120}
      />
      <textarea
        className={`${fieldClass} min-h-24 resize-y`}
        name="body"
        placeholder="পণ্যটি কেমন লেগেছে? মান, প্যাকেজিং বা ডেলিভারি নিয়ে লিখুন…"
        maxLength={2000}
        required
      />

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="store-btn inline-flex items-center gap-2 bg-[var(--store-primary)] px-4 py-2 text-xs font-semibold text-white disabled:opacity-60"
        >
          {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
          মন্তব্য যোগ করুন
        </button>
        <Message ok={state.ok} message={state.message} />
      </div>
    </form>
  );
}

export function CommentForm({
  slug,
  productSlug,
  reviewId,
}: {
  slug: string;
  productSlug: string;
  reviewId: string;
}) {
  const [state, submit, pending] = useActionState(addCommentAction, EMPTY_BUYER_STATE);

  return (
    <form action={submit} className="mt-2 flex flex-wrap items-center gap-2">
      <input type="hidden" name="slug" value={slug} />
      <input type="hidden" name="productSlug" value={productSlug} />
      <input type="hidden" name="reviewId" value={reviewId} />
      <input
        className="h-8 min-w-0 flex-1 rounded-full border border-black/10 bg-white px-3 text-[11px] outline-none focus:border-[var(--store-primary)]"
        name="body"
        placeholder="এই রিভিউতে মন্তব্য করুন…"
        maxLength={1000}
        required
      />
      <button
        type="submit"
        disabled={pending}
        className="text-[11px] font-semibold text-[var(--store-primary)] hover:underline disabled:opacity-60"
      >
        {pending ? "…" : "মন্তব্য"}
      </button>
      <Message ok={state.ok} message={state.message} />
    </form>
  );
}

export function DeleteReviewForm({
  slug,
  productSlug,
  reviewId,
}: {
  slug: string;
  productSlug: string;
  reviewId: string;
}) {
  const [state, submit, pending] = useActionState(deleteReviewAction, EMPTY_BUYER_STATE);

  return (
    <form
      action={submit}
      onSubmit={(event) => {
        if (!window.confirm("এই রিভিউটি মুছে ফেলবেন?")) event.preventDefault();
      }}
    >
      <input type="hidden" name="slug" value={slug} />
      <input type="hidden" name="productSlug" value={productSlug} />
      <input type="hidden" name="reviewId" value={reviewId} />
      <button
        type="submit"
        disabled={pending}
        className="text-[11px] font-medium text-red-600 hover:underline disabled:opacity-60"
      >
        {pending ? "…" : "মুছুন"}
      </button>
      {state.message ? (
        <p className={`text-[11px] ${state.ok ? "text-emerald-700" : "text-red-600"}`}>
          {state.message}
        </p>
      ) : null}
    </form>
  );
}
