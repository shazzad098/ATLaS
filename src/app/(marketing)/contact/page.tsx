import Link from "next/link";
import { redirect } from "next/navigation";
import { HelpCircle, Mail, MessageSquare, Phone } from "lucide-react";
import { createPublicTicket } from "@/lib/services/support-service";

/** Contact / Support page — creates a guest support ticket (PRD §4.1). */

export const metadata = {
  title: "যোগাযোগ — ATLaS",
  description: "ATLaS support team-এর সাথে যোগাযোগ করুন। Technical সমস্যা, billing প্রশ্ন বা partnership — আমরা সাহায্য করতে প্রস্তুত।",
};

const CATEGORIES = [
  { value: "general", label: "সাধারণ প্রশ্ন" },
  { value: "billing", label: "পেমেন্ট ও বিলিং" },
  { value: "technical", label: "Technical সমস্যা" },
  { value: "domain", label: "ডোমেইন ও সাবডোমেইন" },
  { value: "payment_gateway", label: "Payment Gateway" },
  { value: "courier", label: "কুরিয়ার ও ডেলিভারি" },
  { value: "partnership", label: "Partnership ও Enterprise" },
  { value: "other", label: "অন্যান্য" },
];

async function submitContactForm(formData: FormData) {
  "use server";

  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const subject = String(formData.get("subject") ?? "").trim();
  const bodyText = String(formData.get("body") ?? "").trim();
  const category = String(formData.get("category") ?? "general");

  if (!subject || !bodyText || !name) return;

  await createPublicTicket({
    name,
    email,
    subject: `[${category}] ${subject}`,
    body: bodyText,
  });

  redirect("/contact?sent=1");
}

export default async function ContactPage({
  searchParams,
}: {
  searchParams: Promise<{ sent?: string }>;
}) {
  const params = await searchParams;
  const sent = params.sent === "1";

  return (
    <div className="bg-white">
      {/* Hero */}
      <section className="border-b border-[#e8eeeb] bg-gradient-to-b from-[#f0faf6] to-white py-14 sm:py-16">
        <div className="mx-auto max-w-[1160px] px-4 text-center sm:px-6">
          <span className="mb-4 inline-flex items-center gap-1.5 rounded-full border border-[#c3e9d8] bg-[#e7f7f0] px-3 py-1 text-[12px] font-semibold text-[#0b7a5b]">
            যোগাযোগ
          </span>
          <h1 className="text-3xl font-bold tracking-tight text-ink-900 sm:text-4xl">
            আমরা সাহায্য করতে প্রস্তুত
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-base leading-7 text-ink-600">
            Technical সমস্যা থেকে billing প্রশ্ন — সব বিষয়ে আমাদের support team সাহায্য করবে।
          </p>
        </div>
      </section>

      <section className="py-14 sm:py-16">
        <div className="mx-auto max-w-[1160px] px-4 sm:px-6">
          <div className="grid gap-10 lg:grid-cols-3 lg:items-start">
            {/* Contact info */}
            <div className="space-y-6">
              <div>
                <h2 className="text-lg font-bold text-ink-900">যোগাযোগের উপায়</h2>
                <p className="mt-2 text-[13.5px] leading-6 text-ink-500">
                  নিচের ফর্ম ব্যবহার করুন বা সরাসরি যোগাযোগ করুন।
                </p>
              </div>

              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#e7f7f0] text-[#0B8F68]">
                    <Mail className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-[13px] font-semibold text-ink-700">ইমেইল</p>
                    <p className="text-[13px] text-ink-500">support@atlas.example</p>
                    <p className="text-[12px] text-ink-400">২৪ ঘণ্টার মধ্যে উত্তর</p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#e8f1ff] text-[#2563EB]">
                    <Phone className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-[13px] font-semibold text-ink-700">ফোন সাপোর্ট</p>
                    <p className="text-[13px] text-ink-500">Standard ও Pro plan-এ</p>
                    <p className="text-[12px] text-ink-400">সকাল ৯টা — রাত ৯টা (BD)</p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#f1ebff] text-[#7C3AED]">
                    <MessageSquare className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-[13px] font-semibold text-ink-700">WhatsApp</p>
                    <p className="text-[13px] text-ink-500">Priority support</p>
                    <p className="text-[12px] text-ink-400">Pro plan merchant-দের জন্য</p>
                  </div>
                </div>
              </div>

              <div className="rounded-xl border border-[#e8eeeb] bg-[#f7faf9] p-4">
                <div className="flex items-center gap-2 text-[13px] font-semibold text-ink-700">
                  <HelpCircle className="h-4 w-4 text-[#0B7A5B]" />
                  Help Center
                </div>
                <p className="mt-1.5 text-[12.5px] text-ink-500">
                  সাধারণ সমস্যার জন্য{" "}
                  <Link href="/help" className="font-medium text-[#0B7A5B] hover:underline">
                    Help Center
                  </Link>{" "}
                  দেখুন — বেশিরভাগ প্রশ্নের উত্তর এখানেই আছে।
                </p>
              </div>

              <div className="rounded-xl border border-[#e8eeeb] bg-[#f7faf9] p-4">
                <p className="text-[13px] font-semibold text-ink-700">Merchant হলে</p>
                <p className="mt-1.5 text-[12.5px] text-ink-500">
                  Admin panel-এ লগইন করে সরাসরি{" "}
                  <Link href="/admin/support" className="font-medium text-[#0B7A5B] hover:underline">
                    Support
                  </Link>{" "}
                  পেজ থেকে টিকেট খুলুন — দ্রুত সাড়া পাবেন।
                </p>
              </div>
            </div>

            {/* Form */}
            <div className="rounded-xl border border-[#e8eeeb] bg-white p-6 shadow-[0_1px_8px_rgba(13,42,32,0.06)] lg:col-span-2">
              {sent ? (
                <div className="py-8 text-center">
                  <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-[#e7f7f0]">
                    <Mail className="h-7 w-7 text-[#0B8F68]" />
                  </div>
                  <h3 className="text-lg font-bold text-ink-900">আপনার বার্তা পাঠানো হয়েছে</h3>
                  <p className="mt-2 text-[14px] text-ink-500">
                    আমরা শীঘ্রই উত্তর দেব। সাধারণত ২৪ ঘণ্টার মধ্যে।
                  </p>
                  <Link
                    href="/"
                    className="mt-5 inline-flex items-center gap-1.5 rounded-[10px] bg-[#0BA678] px-5 py-2.5 text-[13px] font-semibold text-white transition hover:bg-[#099569]"
                  >
                    হোমে ফিরে যান
                  </Link>
                </div>
              ) : (
                <>
                  <h2 className="mb-5 text-lg font-bold text-ink-900">সাপোর্ট রিকোয়েস্ট পাঠান</h2>
                  <form action={submitContactForm} className="space-y-4">
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div>
                        <label className="mb-1.5 block text-[13px] font-medium text-ink-700">
                          নাম <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          name="name"
                          required
                          placeholder="আপনার নাম"
                          className="w-full rounded-lg border border-ink-200 px-3 py-2 text-[13.5px] text-ink-900 outline-none transition focus:border-[#0BA678] focus:ring-1 focus:ring-[#0BA678]"
                        />
                      </div>
                      <div>
                        <label className="mb-1.5 block text-[13px] font-medium text-ink-700">
                          ফোন নম্বর
                        </label>
                        <input
                          type="tel"
                          name="phone"
                          placeholder="01XXXXXXXXX"
                          className="w-full rounded-lg border border-ink-200 px-3 py-2 text-[13.5px] text-ink-900 outline-none transition focus:border-[#0BA678] focus:ring-1 focus:ring-[#0BA678]"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="mb-1.5 block text-[13px] font-medium text-ink-700">
                        ইমেইল
                      </label>
                      <input
                        type="email"
                        name="email"
                        placeholder="your@email.com"
                        className="w-full rounded-lg border border-ink-200 px-3 py-2 text-[13.5px] text-ink-900 outline-none transition focus:border-[#0BA678] focus:ring-1 focus:ring-[#0BA678]"
                      />
                    </div>

                    <div>
                      <label className="mb-1.5 block text-[13px] font-medium text-ink-700">
                        বিষয়
                      </label>
                      <select
                        name="category"
                        className="w-full rounded-lg border border-ink-200 px-3 py-2 text-[13.5px] text-ink-900 outline-none transition focus:border-[#0BA678] focus:ring-1 focus:ring-[#0BA678]"
                      >
                        {CATEGORIES.map((cat) => (
                          <option key={cat.value} value={cat.value}>
                            {cat.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="mb-1.5 block text-[13px] font-medium text-ink-700">
                        সংক্ষিপ্ত বিষয় <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        name="subject"
                        required
                        placeholder="আপনার সমস্যার সংক্ষিপ্ত বিবরণ"
                        className="w-full rounded-lg border border-ink-200 px-3 py-2 text-[13.5px] text-ink-900 outline-none transition focus:border-[#0BA678] focus:ring-1 focus:ring-[#0BA678]"
                      />
                    </div>

                    <div>
                      <label className="mb-1.5 block text-[13px] font-medium text-ink-700">
                        বিস্তারিত বিবরণ <span className="text-red-500">*</span>
                      </label>
                      <textarea
                        name="body"
                        required
                        rows={5}
                        placeholder="সমস্যাটি বিস্তারিত লিখুন — কী হচ্ছে, কখন হচ্ছে, কোন পেজে হচ্ছে।"
                        className="w-full resize-none rounded-lg border border-ink-200 px-3 py-2 text-[13.5px] text-ink-900 outline-none transition focus:border-[#0BA678] focus:ring-1 focus:ring-[#0BA678]"
                      />
                    </div>

                    <button
                      type="submit"
                      className="w-full rounded-[10px] bg-[#0BA678] py-2.5 text-[13.5px] font-semibold text-white shadow-[0_8px_18px_-10px_rgba(11,166,120,0.95)] transition hover:bg-[#099569]"
                    >
                      পাঠান
                    </button>
                  </form>
                </>
              )}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
