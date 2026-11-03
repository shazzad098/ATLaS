import { notFound, redirect } from "next/navigation";
import { KeyRound, UserRound } from "lucide-react";
import { readBuyerSession } from "@/lib/auth/customer-session";
import { getStorefrontContext, storePath } from "@/lib/storefront";
import { formatDate } from "@/lib/dates";
import { getBuyerAccount } from "@/lib/services/customer-account";
import { BuyerPasswordForm, BuyerProfileForm } from "../../_components/profile-forms";
import { Surface } from "@/app/store/[slug]/_components/storefront-ui";

export const metadata = { title: "প্রোফাইল", robots: { index: false, follow: false } };

export default async function BuyerProfilePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const context = await getStorefrontContext(slug);
  if (!context) notFound();

  const buyer = await readBuyerSession(context.store.id);
  if (!buyer) redirect(storePath(slug, "/account/login"));

  const account = await getBuyerAccount(context.store.id, buyer.id);

  return (
    <div className="space-y-5">
      <header>
        <p
          className="text-[10px] font-semibold tracking-[0.22em] uppercase"
          style={{ color: "var(--store-primary)" }}
        >
          অ্যাকাউন্ট
        </p>
        <h1 className="mt-1.5 text-2xl font-semibold tracking-tight">প্রোফাইল</h1>
        <p className="muted mt-1 text-sm">
          অ্যাকাউন্টের তথ্য ও ডেলিভারি ঠিকানা হালনাগাদ করুন। মোবাইল নম্বর পরিবর্তন করতে support-এ
          যোগাযোগ করুন।
        </p>
      </header>

      <Surface className="p-4 sm:p-5">
        <div className="mb-4 flex items-center gap-2.5 border-b border-black/[0.06] pb-3">
          <span
            className="grid h-8 w-8 place-items-center rounded-lg"
            style={{
              background: "color-mix(in srgb, var(--store-primary) 10%, white)",
              color: "var(--store-primary)",
            }}
          >
            <UserRound className="h-4 w-4" strokeWidth={1.8} />
          </span>
          <div>
            <h2 className="text-sm font-semibold">ব্যক্তিগত তথ্য</h2>
            <p className="muted text-[11px]">নাম, ইমেইল ও ডেলিভারি ঠিকানা</p>
          </div>
        </div>
        <BuyerProfileForm slug={slug} account={account} />
      </Surface>

      <Surface className="p-4 sm:p-5">
        <div className="mb-4 flex items-center gap-2.5 border-b border-black/[0.06] pb-3">
          <span
            className="grid h-8 w-8 place-items-center rounded-lg"
            style={{
              background: "color-mix(in srgb, var(--store-primary) 10%, white)",
              color: "var(--store-primary)",
            }}
          >
            <KeyRound className="h-4 w-4" strokeWidth={1.8} />
          </span>
          <div>
            <h2 className="text-sm font-semibold">পাসওয়ার্ড</h2>
            <p className="muted text-[11px]">নিয়মিত পাসওয়ার্ড বদলালে অ্যাকাউন্ট নিরাপদ থাকে।</p>
          </div>
        </div>
        <BuyerPasswordForm slug={slug} />
      </Surface>

      <p className="muted text-[11px]">
        অ্যাকাউন্ট খোলা হয়েছে {formatDate(account.createdAt)}
        {account.lastLoginAt ? ` · সর্বশেষ লগইন ${formatDate(account.lastLoginAt)}` : ""}
      </p>
    </div>
  );
}
