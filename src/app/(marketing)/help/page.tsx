import { ButtonLink } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/shell";
import { getLocale } from "@/lib/i18n/server";

/** Help center (PRD §4.1). Static content grouped by topic with anchors. */

export const dynamic = "force-dynamic";

const COPY = {
  bn: {
    meta: {
      title: "হেল্প সেন্টার",
      description: "ATLaS সেটআপ, পেমেন্ট, ডেলিভারি, ডোমেইন, বিলিং ও API নিয়ে সাধারণ প্রশ্নের উত্তর।",
    },
    hero: {
      title: "উত্তর খুঁজুন, নাহলে আমাদের লিখুন",
      body: "সেটআপ থেকে API — বিষয় অনুযায়ী সাজানো। প্রশ্নটি না পেলে নিচের ফর্ম থেকে টিকেট খুলুন।",
    },
    cta: {
      title: "উত্তর পাননি?",
      body: "দোকানের নাম বা অর্ডার নম্বরসহ লিখুন — কর্মদিবসে একই দিনে উত্তর দেওয়ার চেষ্টা করি।",
      contact: "যোগাযোগ করুন",
      login: "মার্চেন্ট লগইন",
    },
    topics: [
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
    ],
  },
  en: {
    meta: {
      title: "Help centre",
      description: "Answers to common questions about ATLaS setup, payments, delivery, domains, billing and the API.",
    },
    hero: {
      title: "Find an answer, or write to us",
      body: "Everything from setup to the API, grouped by topic. If your question is not here, open a ticket with the form below.",
    },
    cta: {
      title: "Did not find it?",
      body: "Write with your store name or order number — we try to answer the same working day.",
      contact: "Contact us",
      login: "Merchant login",
    },
    topics: [
      {
        id: "start",
        title: "Getting started",
        items: [
          {
            q: "What do I need to open an account?",
            a: "A Bangladeshi mobile number. It is verified with a 6-digit OTP. An email is optional, but it helps with password resets and invoice mail.",
          },
          {
            q: "When does the subdomain go live?",
            a: "The `your-shop.atlas.app` record is created when the store is created. The name is checked for availability first, so duplicate slugs are never accepted.",
          },
          {
            q: "What happens if I do not finish the onboarding checklist?",
            a: "The store stays in draft and nobody can see it. There are four steps: first product, delivery charge, payment method, publish. The publish button unlocks when all four are ticked.",
          },
        ],
      },
      {
        id: "payment",
        title: "Payments",
        items: [
          {
            q: "How do I turn on online payments?",
            a: "Connect the gateway on the Payments page. Sandbox mode lets you run the whole flow with demo credentials. Add your real merchant account keys to go live; the keys are stored encrypted.",
          },
          {
            q: "What if the same payment is confirmed twice?",
            a: "Every gateway event is stored uniquely by `(provider, eventKey)`, so a duplicate callback cannot mark the order paid a second time. If you are unsure, the order timeline shows every event.",
          },
          {
            q: "When does a COD order count for the platform fee?",
            a: "When the order is delivered as cash on delivery and the merchant confirms it. If the order is cancelled or fully refunded the fee row is reversed and the quota counter goes back.",
          },
        ],
      },
      {
        id: "delivery",
        title: "Delivery",
        items: [
          {
            q: "How do I set delivery charges?",
            a: "Create zones on the Delivery page (Dhaka city, outside Dhaka) with a charge and a free-delivery threshold. Checkout matches the shopper's address to the right zone.",
          },
          {
            q: "When do third-party couriers become available?",
            a: "From the Basic plan you can connect Pathao, Steadfast, RedX and Paperfly. Courier payments carry a separate 0.5% fee that does not double up with the platform commission.",
          },
        ],
      },
      {
        id: "design",
        title: "Themes and design",
        items: [
          {
            q: "Do I lose products if I change the theme?",
            a: "No. The theme only changes appearance; products, categories, orders and customers stay the same. If a new theme lacks a section, that content is kept in the draft.",
          },
          {
            q: "Why is the theme switch disabled?",
            a: "On the free plan the first choice is final, and on Basic the theme locks once the store is published. Standard and Pro can change it at any time.",
          },
          {
            q: "Do changes go live immediately?",
            a: "No. Edits are collected in a draft; publishing makes them live atomically in one go, so nobody sees a half-styled shop.",
          },
        ],
      },
      {
        id: "domain",
        title: "Domains",
        items: [
          {
            q: "How do I add my own domain?",
            a: "Enter it under Settings → Domains. We show a TXT verification record and a CNAME; once those are in DNS the status moves from pending to verified and active. TLS is reported separately.",
          },
          {
            q: "Can a custom domain and a subdomain run together?",
            a: "On Pro both stay active. On Standard the custom domain becomes primary and the subdomain redirects to it.",
          },
        ],
      },
      {
        id: "billing",
        title: "Billing and plans",
        items: [
          {
            q: "When do plan limits apply?",
            a: "Immediately — upgrading raises the quota, downgrading stops new records beyond it while existing data stays readable and editable. The server checks entitlements on every request.",
          },
          {
            q: "Does a failed payment shut my store?",
            a: "Not straight away. The store stays open through a 7-day grace period, then read-only (exports and renewal stay open), then suspended — and the data is never deleted.",
          },
          {
            q: "How do refunds work?",
            a: "Request a refund from the order; once approved the gateway is refunded and the platform fee for that order is voided. The refund policy has the details.",
          },
        ],
      },
      {
        id: "api",
        title: "API and integrations",
        items: [
          {
            q: "Which plan includes API access?",
            a: "Free is public read only, Basic adds the API and webhooks, Standard adds scoped API keys, and Pro gets full access with higher rate limits. The developer page has the details.",
          },
          {
            q: "How are webhooks signed?",
            a: "Every delivery carries an HMAC-SHA256 signature header. Compare it using the body and your secret before processing — a retry arrives with the same event key.",
          },
        ],
      },
    ],
  },
} as const;

export async function generateMetadata() {
  const locale = await getLocale();
  return COPY[locale].meta;
}

export default async function HelpPage() {
  const locale = await getLocale();
  const t = COPY[locale];

  return (
    <div className="mx-auto max-w-5xl space-y-10 px-4 py-12">
      <div className="max-w-2xl space-y-3">
        <h1 className="text-3xl font-semibold tracking-tight text-ink-900 sm:text-4xl">{t.hero.title}</h1>
        <p className="text-ink-600">{t.hero.body}</p>
      </div>

      <nav className="flex flex-wrap gap-2">
        {t.topics.map((topic) => (
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
        {t.topics.map((topic) => (
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
            <p className="text-base font-semibold text-ink-900">{t.cta.title}</p>
            <p className="text-sm text-ink-600">{t.cta.body}</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <ButtonLink href="/contact">{t.cta.contact}</ButtonLink>
            <ButtonLink href="/login" variant="outline">
              {t.cta.login}
            </ButtonLink>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
