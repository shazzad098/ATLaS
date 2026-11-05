import { ButtonLink } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/shell";
import { ContactForm } from "@/app/(marketing)/contact/_components/contact-form";

/** Contact + support entry point (PRD §4.1). */

export const metadata = {
  title: "যোগাযোগ",
  description: "ATLaS টিমের সাথে যোগাযোগ করুন — প্ল্যান, টেকনিক্যাল সহায়তা বা অংশীদারিত্বের জন্য।",
};

const CHANNELS = [
  {
    title: "সাপোর্ট টিকেট",
    body: "মার্চেন্ট অ্যাকাউন্ট থাকলে অ্যাডমিনের সাপোর্ট পেজ থেকে টিকেট খুলুন — অর্ডার ও দোকানের তথ্য স্বয়ংক্রিয়ভাবে যুক্ত হয়।",
    action: { href: "/login", label: "লগইন করে টিকেট খুলুন" },
  },
  {
    title: "প্ল্যান ও প্রাইসিং",
    body: "Basic, Standard ও Pro-র মূল্য ব্যবসায়িক সম্মতির ভিত্তিতে ঠিক হয়। আপনার দোকানের সাইজ জানালে আমরা কোটেশন দেব।",
    action: { href: "/pricing", label: "প্ল্যান ম্যাট্রিক্স দেখুন" },
  },
  {
    title: "ডেভেলপার সহায়তা",
    body: "REST API, OTP login, rate limit ও webhook signature — সব ডকুমেন্টেশন ডেভেলপার পেজে।",
    action: { href: "/developers", label: "API ডকুমেন্টেশন" },
  },
];

const HIGHLIGHTS = [
  "কর্মদিবসে একই দিনে উত্তর",
  "সকাল ১০টা – রাত ৮টা (Asia/Dhaka)",
  "বাংলায় সাপোর্ট",
];

function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-brand-200 bg-white/85 px-3 py-1 text-[11px] font-semibold tracking-wide text-brand-800 shadow-xs backdrop-blur">
      <span className="h-1.5 w-1.5 rounded-full bg-brand-500" />
      {children}
    </span>
  );
}

export default function ContactPage() {
  return (
    <div className="overflow-hidden bg-white">
      {/* Hero */}
      <section className="relative overflow-hidden border-b border-ink-100 bg-gradient-to-b from-brand-50/90 via-white to-white">
        <div aria-hidden="true" className="pointer-events-none absolute inset-0">
          <div className="animate-drift absolute -top-56 left-1/2 h-[34rem] w-[34rem] -translate-x-1/2 rounded-full bg-brand-200/45 blur-3xl" />
          <div className="animate-float-slow absolute -left-28 top-32 h-72 w-72 rounded-full bg-brand-100/80 blur-3xl" />
          <div className="animate-float absolute -right-24 top-10 h-72 w-72 rounded-full bg-accent-400/15 blur-3xl" />
          <div className="absolute inset-0 bg-[radial-gradient(#d5d9e2_1px,transparent_1px)] [background-size:22px_22px] opacity-40 [mask-image:radial-gradient(ellipse_at_center,black,transparent_72%)]" />
        </div>

        <div className="relative mx-auto grid max-w-6xl items-center gap-10 px-4 pt-14 pb-16 sm:pt-20 lg:grid-cols-[1.05fr_0.95fr] lg:pb-20">
          <div>
            <div className="animate-fade-up">
              <Eyebrow>যোগাযোগ ও সাপোর্ট</Eyebrow>
            </div>

            <h1
              className="animate-fade-up mt-5 text-3xl leading-[1.25] font-bold tracking-tight text-ink-900 sm:text-[44px] sm:leading-[1.18]"
              style={{ animationDelay: "80ms" }}
            >
              কীভাবে <span className="text-brand-700">সাহায্য করতে পারি?</span>
            </h1>

            <p
              className="animate-fade-up mt-6 max-w-xl text-sm leading-relaxed text-ink-600 sm:text-base"
              style={{ animationDelay: "160ms" }}
            >
              ফর্মটি প্ল্যাটফর্ম সাপোর্ট ইনবক্সে যায়। যত নির্দিষ্ট লিখবেন — দোকানের নাম, অর্ডার নম্বর
              বা প্ল্যান — তত দ্রুত সমাধান পাবেন। প্রতিটি বার্তা মানুষ পড়ে, রিপ্লাই সবসময় বাংলায়।
            </p>

            <div className="animate-fade-up mt-6 flex flex-wrap gap-2" style={{ animationDelay: "240ms" }}>
              {HIGHLIGHTS.map((item) => (
                <span
                  key={item}
                  className="inline-flex items-center gap-1.5 rounded-full border border-brand-200 bg-brand-50/70 px-3 py-1 text-[11px] font-medium text-brand-800 transition hover:border-brand-300 hover:bg-brand-100"
                >
                  <svg
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                    className="h-3 w-3"
                    fill="none"
                    stroke="currentColor"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2.2}
                  >
                    <path d="m5 10.5 3.4 3.4 7.6-8" />
                  </svg>
                  {item}
                </span>
              ))}
            </div>
          </div>

          {/* Support illustration */}
          <div
            className="animate-fade-up relative mx-auto w-full max-w-md lg:max-w-lg"
            style={{ animationDelay: "200ms" }}
          >
            <div
              aria-hidden="true"
              className="absolute -inset-6 rounded-[2.5rem] bg-gradient-to-br from-brand-200/60 via-white to-accent-400/25 blur-2xl"
            />

            <div className="relative overflow-hidden rounded-3xl border border-white/80 bg-white/85 p-2 shadow-2xl shadow-brand-900/10 backdrop-blur">
              <img
                src="/images/contact/atlas_contact.jpg"
                alt="ATLaS সাপোর্ট টিম — হেডসেট পরা সহায়তা কর্মী ল্যাপটপে গ্রাহকের বার্তার উত্তর দিচ্ছেন"
                className="w-full rounded-2xl object-cover"
                loading="eager"
              />
            </div>

            <div className="animate-float absolute top-10 -left-3 hidden items-center gap-2 rounded-xl border border-ink-200/80 bg-white/95 px-3 py-2 shadow-lg shadow-ink-900/5 backdrop-blur sm:flex">
              <span className="grid h-6 w-6 place-items-center rounded-lg bg-brand-50 text-brand-700">
                <svg
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                  className="h-3.5 w-3.5"
                  fill="none"
                  stroke="currentColor"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.7}
                >
                  <circle cx="12" cy="12" r="8.5" />
                  <path d="M12 7.5V12l3 2" />
                </svg>
              </span>
              <span className="text-[11px] font-semibold text-ink-800">১ কর্মদিবসে উত্তর</span>
            </div>

            <div
              className="animate-float-slow absolute -bottom-4 left-6 hidden items-center gap-2 rounded-xl border border-ink-200/80 bg-white/95 px-3 py-2 shadow-lg shadow-ink-900/5 backdrop-blur sm:flex"
              style={{ animationDelay: "0.6s" }}
            >
              <span className="grid h-6 w-6 place-items-center rounded-lg bg-brand-600 text-white">
                <svg
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                  className="h-3.5 w-3.5"
                  fill="none"
                  stroke="currentColor"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.7}
                >
                  <path d="M4 5h9M8.5 5c0 4.5-2.6 8.2-5.5 10" />
                  <path d="M6 10.5c1.6 2.2 3.6 3.6 6 4.5" />
                  <path d="M13 20l4-11 4 11M14.6 16h4.8" />
                </svg>
              </span>
              <span className="text-[11px] font-semibold text-ink-800">বাংলায় সাপোর্ট</span>
            </div>
          </div>
        </div>
      </section>

      {/* Form + channels */}
      <section className="mx-auto max-w-6xl px-4 py-14 sm:py-20">
        <div className="grid gap-6 lg:grid-cols-[1.15fr_1fr]">
          <Card className="reveal self-start shadow-sm">
            <CardBody className="space-y-4 p-6">
              <div className="space-y-1">
                <h2 className="text-base font-semibold text-ink-900">বার্তা পাঠান</h2>
                <p className="text-xs text-ink-500">
                  যত নির্দিষ্ট লিখবেন তত দ্রুত সমাধান সম্ভব — দোকানের নাম বা অর্ডার নম্বর যোগ করুন।
                </p>
              </div>
              <ContactForm />
            </CardBody>
          </Card>

          <div className="reveal space-y-4" style={{ animationDelay: "90ms" }}>
            {CHANNELS.map((channel) => (
              <Card
                key={channel.title}
                className="transition duration-300 hover:-translate-y-0.5 hover:border-brand-200 hover:shadow-md"
              >
                <CardBody className="space-y-2 p-5">
                  <p className="text-sm font-semibold text-ink-900">{channel.title}</p>
                  <p className="text-sm text-ink-600">{channel.body}</p>
                  <ButtonLink href={channel.action.href} variant="outline" size="sm">
                    {channel.action.label}
                  </ButtonLink>
                </CardBody>
              </Card>
            ))}

            <Card className="border-brand-200 bg-brand-50 transition duration-300 hover:-translate-y-0.5 hover:shadow-md">
              <CardBody className="space-y-1.5 p-5">
                <p className="text-sm font-semibold text-ink-900">জরুরি পেমেন্ট সমস্যা?</p>
                <p className="text-sm text-ink-600">
                  অর্ডার পেজে পেমেন্ট স্ট্যাটাস দেখুন। সন্দেহজনক ডুপ্লিকেট চার্জ হলে অর্ডার নম্বরসহ
                  টিকেট খুলুন — webhook লগ থেকে আমরা মিলিয়ে দেখব।
                </p>
              </CardBody>
            </Card>
          </div>
        </div>
      </section>

      {/* Quick answers */}
      <section className="mx-auto max-w-6xl px-4 pb-16 sm:pb-20">
        <div className="reveal rounded-2xl border border-ink-200 bg-ink-50/70 p-6 transition duration-300 hover:bg-ink-50 sm:p-8">
          <h2 className="text-lg font-semibold text-ink-900">উত্তর আগেই পেয়ে যেতে পারেন</h2>
          <p className="mt-1 text-sm text-ink-600">
            সেটআপ, পেমেন্ট, ডোমেইন আর বিলিং — সবচেয়ে সাধারণ প্রশ্নগুলোর উত্তর হেল্প সেন্টারে আছে।
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <ButtonLink href="/help" variant="outline" size="sm">
              হেল্প সেন্টার
            </ButtonLink>
            <ButtonLink href="/how-it-works" variant="ghost" size="sm">
              কীভাবে শুরু করবেন
            </ButtonLink>
            <ButtonLink href="/refund-policy" variant="ghost" size="sm">
              রিফান্ড নীতি
            </ButtonLink>
          </div>
        </div>
      </section>
    </div>
  );
}
