import { ButtonLink } from "@/components/ui/button";
import { Badge, Card, CardBody } from "@/components/ui/shell";
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

export default function ContactPage() {
  return (
    <div className="mx-auto max-w-6xl space-y-10 px-4 py-12">
      <div className="max-w-2xl space-y-3">
        <Badge tone="brand">যোগাযোগ</Badge>
        <h1 className="text-3xl font-semibold tracking-tight text-ink-900 sm:text-4xl">
          কীভাবে সাহায্য করতে পারি?
        </h1>
        <p className="text-ink-600">
          ফর্মটি প্ল্যাটফর্ম সাপোর্ট ইনবক্সে যায়। কর্মদিবসে সাধারণত একই দিনে উত্তর পাবেন — সকাল ১০টা
          থেকে রাত ৮টা (Asia/Dhaka)।
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.15fr_1fr]">
        <Card>
          <CardBody className="space-y-4">
            <div className="space-y-1">
              <h2 className="text-sm font-semibold text-ink-900">বার্তা পাঠান</h2>
              <p className="text-xs text-ink-500">
                যত নির্দিষ্ট লিখবেন তত দ্রুত সমাধান সম্ভব — দোকানের নাম বা অর্ডার নম্বর যোগ করুন।
              </p>
            </div>
            <ContactForm />
          </CardBody>
        </Card>

        <div className="space-y-4">
          {CHANNELS.map((channel) => (
            <Card key={channel.title}>
              <CardBody className="space-y-2">
                <p className="text-sm font-semibold text-ink-900">{channel.title}</p>
                <p className="text-sm text-ink-600">{channel.body}</p>
                <ButtonLink href={channel.action.href} variant="outline" size="sm">
                  {channel.action.label}
                </ButtonLink>
              </CardBody>
            </Card>
          ))}

          <Card className="border-brand-200 bg-brand-50">
            <CardBody className="space-y-1.5">
              <p className="text-sm font-semibold text-ink-900">জরুরি পেমেন্ট সমস্যা?</p>
              <p className="text-sm text-ink-600">
                অর্ডার পেজে পেমেন্ট স্ট্যাটাস দেখুন। সন্দেহজনক ডুপ্লিকেট চার্জ হলে অর্ডার নম্বরসহ টিকেট
                খুলুন — webhook লগ থেকে আমরা মিলিয়ে দেখব।
              </p>
            </CardBody>
          </Card>
        </div>
      </div>

      <div className="rounded-xl border border-ink-200 bg-ink-50 p-6">
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
    </div>
  );
}
