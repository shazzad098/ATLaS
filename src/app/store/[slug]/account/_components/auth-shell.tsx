import Link from "next/link";
import { Heart, PackageCheck, ShieldCheck, Star } from "lucide-react";
import { storePath } from "@/lib/storefront";
import { Surface } from "@/app/store/[slug]/_components/storefront-ui";

/**
 * Branded shell around the buyer login/signup forms. The left panel explains
 * what an account gives the shopper; the right panel holds the form.
 */
export function BuyerAuthShell({
  slug,
  storeName,
  tagline,
  mode,
  children,
}: {
  slug: string;
  storeName: string;
  tagline: string | null;
  mode: "login" | "signup";
  children: React.ReactNode;
}) {
  const benefits = [
    { icon: PackageCheck, title: "অর্ডার হিস্ট্রি", text: "পুরোনো অর্ডার, ট্র্যাকিং ও ইনভয়েস এক জায়গায়।" },
    { icon: Star, title: "রিভিউ ও মন্তব্য", text: "কেনা পণ্যে বারবার মন্তব্য করতে পারবেন।" },
    { icon: Heart, title: "উইশলিস্ট", text: "পছন্দের পণ্য সেভ করে পরে কিনুন।" },
  ];

  return (
    <div className="atlas-shell py-10 sm:py-14">
      <div className="mx-auto grid max-w-4xl gap-5 md:grid-cols-[1fr_22rem] md:items-stretch lg:grid-cols-[1fr_26rem]">
        <Surface className="relative order-2 overflow-hidden p-6 sm:p-8 md:order-1">
          <div aria-hidden="true" className="pointer-events-none absolute inset-0">
            <div
              className="absolute -top-24 -right-16 h-56 w-56 rounded-full opacity-20 blur-3xl"
              style={{ background: "var(--store-primary)" }}
            />
            <div
              className="absolute -bottom-24 -left-16 h-56 w-56 rounded-full opacity-15 blur-3xl"
              style={{ background: "var(--store-accent)" }}
            />
          </div>

          <div className="relative">
            <span
              className="grid h-12 w-12 place-items-center rounded-2xl text-lg font-bold text-white shadow-sm"
              style={{ background: "var(--store-primary)" }}
            >
              {storeName.trim().charAt(0)}
            </span>
            <p className="muted mt-5 text-[10px] font-semibold tracking-[0.22em] uppercase">
              Merchant storefront
            </p>
            <h1 className="mt-1.5 text-2xl font-semibold tracking-tight sm:text-3xl">
              {mode === "login" ? "আবার স্বাগতম" : `${storeName}-এ অ্যাকাউন্ট খুলুন`}
            </h1>
            <p className="muted mt-2 text-sm leading-relaxed">
              {tagline ?? `${storeName}-এর অর্ডার, রিভিউ ও পছন্দের পণ্য এক জায়গায় রাখুন।`}
            </p>

            <ul className="mt-7 space-y-4">
              {benefits.map((benefit) => (
                <li key={benefit.title} className="flex items-start gap-3">
                  <span
                    className="grid h-8 w-8 shrink-0 place-items-center rounded-lg"
                    style={{
                      background: "color-mix(in srgb, var(--store-primary) 10%, white)",
                      color: "var(--store-primary)",
                    }}
                  >
                    <benefit.icon className="h-4 w-4" strokeWidth={1.8} />
                  </span>
                  <span>
                    <span className="block text-xs font-semibold">{benefit.title}</span>
                    <span className="muted mt-0.5 block text-[11px] leading-relaxed">
                      {benefit.text}
                    </span>
                  </span>
                </li>
              ))}
            </ul>

            <div className="muted mt-7 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-black/[0.06] pt-4 text-[10px]">
              <span className="inline-flex items-center gap-1.5">
                <ShieldCheck className="h-3.5 w-3.5" style={{ color: "var(--store-primary)" }} />
                নিরাপদ অ্যাকাউন্ট
              </span>
              <Link href={storePath(slug, "/shop")} className="font-semibold hover:underline">
                দোকানে ফিরুন
              </Link>
            </div>
          </div>
        </Surface>

        <Surface className="order-1 p-6 sm:p-7 md:order-2">{children}</Surface>
      </div>
    </div>
  );
}
