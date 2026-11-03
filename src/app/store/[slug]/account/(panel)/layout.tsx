import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { LogOut } from "lucide-react";
import { readBuyerSession } from "@/lib/auth/customer-session";
import { getStorefrontContext, storePath } from "@/lib/storefront";
import { buyerLogoutAction } from "@/app/store/[slug]/account/actions";
import { BuyerAccountNav } from "@/app/store/[slug]/account/_components/buyer-nav";
import {
  StoreBreadcrumb,
  Surface,
} from "@/app/store/[slug]/_components/storefront-ui";

/** Signed-in buyer shell: account nav + profile chip around every panel page. */

export default async function BuyerPanelLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<unknown>;
}) {
  const { slug } = (await params) as { slug: string };
  const context = await getStorefrontContext(slug);
  if (!context) notFound();

  const buyer = await readBuyerSession(context.store.id);
  if (!buyer) {
    redirect(
      `${storePath(slug, "/account/login")}?next=${encodeURIComponent(storePath(slug, "/account"))}`,
    );
  }

  return (
    <div className="atlas-shell py-8 sm:py-10">
      <StoreBreadcrumb
        slug={slug}
        items={[
          { label: "হোম", href: "/" },
          { label: "আমার অ্যাকাউন্ট", href: "/account" },
        ]}
      />

      <div className="mt-5 grid gap-6 md:grid-cols-[15rem_1fr] md:items-start">
        <aside className="min-w-0 space-y-3 md:sticky md:top-24">
          <Surface className="p-4">
            <div className="flex items-center gap-3">
              <span
                className="grid h-11 w-11 shrink-0 place-items-center rounded-full text-sm font-bold text-white"
                style={{ background: "var(--store-primary)" }}
              >
                {buyer.name.trim().charAt(0) || "B"}
              </span>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">{buyer.name}</p>
                <p className="muted truncate text-[11px]">{buyer.email ?? buyer.phone}</p>
              </div>
            </div>

            <span
              className="mt-3 inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[9px] font-semibold"
              style={{
                background: "color-mix(in srgb, var(--store-primary) 10%, white)",
                color: "var(--store-primary)",
              }}
            >
              <span className="h-1.5 w-1.5 rounded-full" style={{ background: "var(--store-primary)" }} />
              লগইন করা আছে
            </span>

            <div className="mt-4 border-t border-black/[0.06] pt-4">
              <BuyerAccountNav slug={slug} />
            </div>

            <form action={buyerLogoutAction} className="mt-4 border-t border-black/[0.06] pt-3">
              <input type="hidden" name="slug" value={slug} />
              <button
                type="submit"
                className="muted inline-flex items-center gap-2 text-[11px] font-medium transition hover:text-red-600"
              >
                <LogOut className="h-3.5 w-3.5" />
                লগআউট
              </button>
            </form>
          </Surface>

          <Surface className="p-4">
            <p className="text-[10px] font-semibold tracking-[0.16em] text-black/40 uppercase">
              {context.store.name}
            </p>
            <Link
              href={storePath(slug, "/shop")}
              className="mt-2 inline-flex text-[11px] font-semibold hover:underline"
              style={{ color: "var(--store-primary)" }}
            >
              কেনাকাটা চালিয়ে যান →
            </Link>
          </Surface>
        </aside>

        <div className="min-w-0">{children}</div>
      </div>
    </div>
  );
}
