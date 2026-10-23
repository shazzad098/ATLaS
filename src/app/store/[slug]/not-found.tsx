import Link from "next/link";

/** 404 inside a published storefront. */

export default function StorefrontNotFound() {
  return (
    <div className="atlas-shell grid min-h-[60vh] place-items-center py-16">
      <div className="max-w-md text-center">
        <p className="text-4xl font-bold" style={{ color: "var(--store-primary)" }}>
          ৪০৪
        </p>
        <h1 className="mt-3 text-xl font-semibold">পাতাটি পাওয়া যায়নি</h1>
        <p className="muted mt-2 text-sm">লিংকটি হয়তো ভুল, অথবা পণ্যটি আর পাওয়া যাচ্ছে না।</p>
        <p className="mt-6 text-sm">
          <Link href="/" className="font-semibold underline">
            দোকানের হোমপেজে যান
          </Link>
        </p>
      </div>
    </div>
  );
}
