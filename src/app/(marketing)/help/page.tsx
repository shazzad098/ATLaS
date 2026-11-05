import { ButtonLink } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/shell";

/** Help center (PRD §4.1). Static content grouped by topic with anchors. */

export const metadata = {
  title: "হেল্প সেন্টার",
  description: "ATLaS সেটআপ, পেমেন্ট, ডেলিভারি, ডোমেইন, বিলিং ও API নিয়ে সাধারণ প্রশ্নের উত্তর।",
};

const TOPICS = [
  {
    id: "start",
    title: "শুরু করা",
    items: [
      {
        q: "অ্যাকাউন্ট খুলতে কী লাগবে?",
        a: "একটি বাংলাদেশি মোবাইল নম্বর। নম্বর যাচাই হয় ৬ ডিজিটের OTP দিয়ে। ইমেইল দেওয়া ঐচ্ছিক, তবে পাসওয়ার্ড রিসেট ও ইনভয়েস মেইলের জন্য দিলে সুবিধা।",
      },
      {
        q: "subdomain কখন লাইভ হয়?",
        a: "দোকান তৈরির সময়ই `your-shop.atlas.app` রেকর্ড তৈরি হয়। নামটি availability চেক করে নেওয়া হয়, তাই ডুপ্লিকেট slug গ্রহণ করা হয় না।",
      },
      {
        q: "onboarding checklist না শেষ করলে কী হয়?",
        a: "দোকান ড্রাফটে থাকে — কেউ দেখতে পায় না। চারটি ধাপ: প্রথম প্রোডাক্ট, ডেলিভারি চার্জ, পেমেন্ট মেথড, publish। সবগুলো টিক হলে publish বাটন সক্রিয় হয়।",
      },
    ],
  },
  {
    id: "payment",
    title: "পেমেন্ট",
    items: [
      {
        q: "অনলাইন পেমেন্ট কীভাবে চালু করব?",
        a: "Payments পেজে গেটওয়ে কানেক্ট করুন। sandbox mode-এ ডেমো ক্রেডেনশিয়াল দিয়েই পুরো flow টেস্ট করা যায়। আসল মার্চেন্ট অ্যাকাউন্টের কী দিলে লাইভ চালু হবে; কী এনক্রিপ্টেড অবস্থায় সংরক্ষিত থাকে।",
      },
      {
        q: "একই পেমেন্ট দুইবার কনফার্ম হলে?",
        a: "গেটওয়ের প্রতিটি ইভেন্ট `(provider, eventKey)` দিয়ে ইউনিকলি রাখা হয়, তাই ডুপ্লিকেট কলব্যাক দ্বিতীয়বার অর্ডার paid করে না। সন্দেহ হলে অর্ডারের timeline-এ সব ইভেন্ট দেখা যায়।",
      },
      {
        q: "COD অর্ডার কখন প্ল্যাটফর্ম ফির হিসাবে ধরা হয়?",
        a: "অর্ডারটি COD হিসেবে ডেলিভারি হয়ে merchant confirm করলে। বাতিল বা পুরো রিফান্ড হলে ওই ফির সারি reverse হয়, কোটা কাউন্টারও ফিরে যায়।",
      },
    ],
  },
  {
    id: "delivery",
    title: "ডেলিভারি",
    items: [
      {
        q: "ডেলিভারি চার্জ কীভাবে বসাব?",
        a: "Delivery পেজে zone তৈরি করুন (যেমন ঢাকা সিটি, ঢাকার বাইরে) এবং চার্জ ও ফ্রি-ডেলিভারি থ্রেশহোল্ড দিন। চেকআউটে কাস্টমারের ঠিকানা অনুযায়ী সঠিক zone মিলে যায়।",
      },
      {
        q: "তৃতীয় পক্ষের কুরিয়ার কখন পাওয়া যাবে?",
        a: "Basic প্ল্যান থেকে Pathao, Steadfast, RedX ও Paperfly কানেক্ট করা যায়। কুরিয়ার পেমেন্টে আলাদা ০.৫% ফি লাগে এবং সেটি প্ল্যাটফর্ম কমিশনের সাথে দ্বিগুণ হয় না।",
      },
    ],
  },
  {
    id: "design",
    title: "থিম ও ডিজাইন",
    items: [
      {
        q: "থিম বদলালে প্রোডাক্ট হারাবে?",
        a: "না। থিম শুধু চেহারা বদলায়; প্রোডাক্ট, ক্যাটাগরি, অর্ডার ও কাস্টমার একই থাকে। কিছু সেকশন নতুন থিমে না থাকলে সেগুলোর কনটেন্ট draft-এ সংরক্ষিত থাকে।",
      },
      {
        q: "কেন থিম বদলানোর বাটন বন্ধ?",
        a: "Free প্ল্যানে প্রথম নির্বাচনটি চূড়ান্ত, আর Basic প্ল্যানে দোকান publish করার পর থিম লক থাকে। Standard বা Pro-তে যেকোনো সময় বদলানো যায়।",
      },
      {
        q: "পরিবর্তন কি সাথে সাথে লাইভ হয়?",
        a: "না। এডিটগুলো draft-এ জমা হয়; Publish চাপলে একবারে atomic ভাবে লাইভ হয়। তাই অর্ধেক সাজানো দোকান কেউ দেখে ফেলবে না।",
      },
    ],
  },
  {
    id: "domain",
    title: "ডোমেইন",
    items: [
      {
        q: "নিজের ডোমেইন যোগ করব কীভাবে?",
        a: "Settings → Domains-এ ডোমেইন লিখুন। আমরা একটি TXT ভেরিফিকেশন রেকর্ড ও CNAME দেখাই; DNS-এ সেগুলো যোগ করলে status pending থেকে verified হয়ে active হয়। TLS আলাদা করে দেখানো হয়।",
      },
      {
        q: "custom domain আর subdomain একসাথে চলবে?",
        a: "Pro প্ল্যানে দুটোই একসাথে সক্রিয় থাকে। Standard-এ custom domain প্রাইমারি হয় এবং subdomain সেখানে redirect করে।",
      },
    ],
  },
  {
    id: "billing",
    title: "বিলিং ও প্ল্যান",
    items: [
      {
        q: "প্ল্যানের সীমা কখন কার্যকর হয়?",
        a: "সাথে সাথে — upgrade করলে কোটা বাড়ে, ডাউনগ্রেড করলে নতুন তৈরি বন্ধ হয় কিন্তু পুরোনো ডেটা পড়া ও এডিট করা যায়। প্রতিটি রিকোয়েস্টে সার্ভার entitlement যাচাই করে।",
      },
      {
        q: "পেমেন্ট ব্যর্থ হলে দোকান বন্ধ হয়ে যাবে?",
        a: "সাথে সাথে না। ৭ দিনের grace period-এ দোকান চালু থাকে, তারপর read-only (ডেটা এক্সপোর্ট ও renewal খোলা), তারপর সাসপেনশন — ডেটা মুছে যায় না।",
      },
      {
        q: "রিফান্ড কীভাবে কাজ করে?",
        a: "অর্ডার থেকে রিফান্ড রিকোয়েস্ট করুন; অনুমোদনের পর গেটওয়ে রিফান্ড হয় এবং ওই অর্ডারের প্ল্যাটফর্ম ফি বাতিল হয়। বিস্তারিত রিফান্ড নীতিতে।",
      },
    ],
  },
  {
    id: "api",
    title: "API ও ইন্টিগ্রেশন",
    items: [
      {
        q: "API access কোন প্ল্যানে?",
        a: "Free-তে শুধু পাবলিক read access, Basic-এ API + webhook, Standard-এ scoped API key, Pro-তে full access ও বেশি rate limit। বিস্তারিত ডেভেলপার পেজে।",
      },
      {
        q: "webhook সাইন করে কীভাবে?",
        a: "প্রতিটি ডেলিভারিতে HMAC-SHA256 সিগনেচার হেডার থাকে। বডি ও সিক্রেট দিয়ে মিলিয়ে দেখুন, তারপরই প্রসেস করুন — রিট্রাই একই ইভেন্ট কী নিয়ে আসে।",
      },
    ],
  },
];

export default function HelpPage() {
  return (
    <div className="mx-auto max-w-5xl space-y-10 px-4 py-12">
      <div className="max-w-2xl space-y-3">
        <h1 className="text-3xl font-semibold tracking-tight text-ink-900 sm:text-4xl">
          উত্তর খুঁজুন, নাহলে আমাদের লিখুন
        </h1>
        <p className="text-ink-600">
          সেটআপ থেকে API — বিষয় অনুযায়ী সাজানো। প্রশ্নটি না পেলে নিচের ফর্ম থেকে টিকেট খুলুন।
        </p>
      </div>

      <nav className="flex flex-wrap gap-2">
        {TOPICS.map((topic) => (
          <a
            key={topic.id}
            href={`#${topic.id}`}
            className="rounded-full border border-ink-200 bg-white px-3 py-1.5 text-xs font-medium text-ink-700 hover:bg-ink-50"
          >
            {topic.title}
          </a>
        ))}
      </nav>

      <div className="space-y-10">
        {TOPICS.map((topic) => (
          <section key={topic.id} id={topic.id} className="scroll-mt-24 space-y-3">
            <h2 className="text-xl font-semibold tracking-tight text-ink-900">{topic.title}</h2>
            <div className="space-y-2">
              {topic.items.map((item) => (
                <details
                  key={item.q}
                  className="group rounded-xl border border-ink-200 bg-white px-5 py-4 open:bg-ink-50"
                >
                  <summary className="cursor-pointer list-none text-sm font-medium text-ink-900 marker:hidden">
                    <span className="flex items-center justify-between gap-3">
                      {item.q}
                      <span className="text-ink-400 group-open:rotate-45">+</span>
                    </span>
                  </summary>
                  <p className="mt-2 text-sm text-ink-600">{item.a}</p>
                </details>
              ))}
            </div>
          </section>
        ))}
      </div>

      <Card className="border-brand-200 bg-brand-50">
        <CardBody className="flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-1">
            <p className="text-base font-semibold text-ink-900">উত্তর পাননি?</p>
            <p className="text-sm text-ink-600">
              দোকানের নাম বা অর্ডার নম্বরসহ লিখুন — কর্মদিবসে একই দিনে উত্তর দেওয়ার চেষ্টা করি।
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <ButtonLink href="/contact">যোগাযোগ করুন</ButtonLink>
            <ButtonLink href="/login" variant="outline">
              মার্চেন্ট লগইন
            </ButtonLink>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
