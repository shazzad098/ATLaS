import { BellRing, Radio } from "lucide-react";
import { requireSuperAdmin } from "@/lib/auth/session";
import { platformActivitySnapshot } from "@/lib/services/platform-activity-service";
import { PlatformNotificationsFeed } from "@/app/super-admin/_components/platform-notifications";

/**
 * Full Super Admin notification feed.
 *
 * Every merchant update (product, order, settings, staff, theme, billing,
 * support) is written to the AuditLog; this page renders those rows as
 * readable notifications with actor, tenant and action-specific detail. The
 * feed keeps syncing in the browser while the page is open.
 */

export const metadata = { title: "নোটিফিকেশন" };
export const dynamic = "force-dynamic";

export default async function SuperAdminNotificationsPage() {
  await requireSuperAdmin();
  const snapshot = await platformActivitySnapshot({ limit: 100 });

  const categories = new Set(snapshot.items.map((item) => item.category));

  return (
    <div className="space-y-5">
      <section className="rounded-2xl border border-slate-200/80 bg-white px-5 py-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)] sm:px-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2.5">
              <h1 className="text-[26px] leading-tight font-bold tracking-tight text-slate-900">
                নোটিফিকেশন
              </h1>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[10px] font-semibold text-emerald-700">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
                লাইভ
              </span>
            </div>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-500">
              মার্চেন্ট প্যানেল, অর্ডার, ক্যাটালগ, থিম, বিলিং বা সাপোর্ট — যেখান থেকেই কোনো
              আপডেট আসুক, তার বিস্তারিত এখানে দেখা যাবে। ফিড প্রতি ১২ সেকেন্ডে নিজে থেকেই সিঙ্ক হয়।
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-[11px] font-medium text-slate-600">
              <BellRing className="h-3.5 w-3.5 text-indigo-600" />
              {snapshot.items.length}টি সাম্প্রতিক আপডেট
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-[11px] font-medium text-slate-600">
              <Radio className="h-3.5 w-3.5 text-emerald-600" />
              {categories.size}টি ক্যাটাগরি
            </span>
          </div>
        </div>
      </section>

      <PlatformNotificationsFeed initial={snapshot} />

      <p className="text-[11px] leading-relaxed text-slate-400">
        নোটিফিকেশনগুলো immutable audit log থেকে তৈরি — কোনো এন্ট্রি মুছে ফেলা যায় না। বেল আইকনে
        নতুন আপডেটের সংখ্যা দেখায়; এই পেজ খোলার সঙ্গে সঙ্গে সব আপডেট পড়া হিসেবে গণ্য হয়।
      </p>
    </div>
  );
}
