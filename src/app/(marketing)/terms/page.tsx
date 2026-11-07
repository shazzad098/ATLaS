import { LegalPage } from "@/app/(marketing)/_components/legal-page";
import { getLocale } from "@/lib/i18n/server";

/** Terms of service (PRD §13). */

export const dynamic = "force-dynamic";

const COPY = {
  bn: {
    meta: {
      title: "শর্তাবলী",
      description: "ATLaS ব্যবহারের শর্ত — অ্যাকাউন্ট, প্ল্যান, পেমেন্ট, কনটেন্ট ও দায়সীমা।",
    },
    title: "শর্তাবলী",
    updated: "২১ অক্টোবর ২০২৬",
    intro:
      "ATLaS ব্যবহার করে আপনি এই শর্তাবলীতে সম্মত হচ্ছেন। প্ল্যাটফর্মে অ্যাকাউন্ট খোলা, দোকান চালানো ও পেমেন্ট নেওয়া — সবই এই শর্তের অধীন।",
    sections: [
      {
        heading: "অ্যাকাউন্ট ও যোগ্যতা",
        body: [
          "অ্যাকাউন্ট খুলতে সঠিক মোবাইল নম্বর দিতে হবে এবং OTP দিয়ে নম্বরটি যাচাই করতে হবে। নম্বরের মালিকানার দায় ব্যবহারকারীর।",
          "একটি অ্যাকাউন্টের অধীনে একাধিক দোকান থাকতে পারে; প্রতিটি দোকান আলাদা tenant হিসেবে গণ্য হয় এবং তার ডেটা আলাদা থাকে।",
          "১৮ বছরের কম বয়সী ব্যক্তি, বা বাংলাদেশে বৈধভাবে ব্যবসা পরিচালনার অধিকার নেই এমন ব্যক্তির অ্যাকাউন্ট খোলা যাবে না।",
        ],
      },
      {
        heading: "প্ল্যান, ট্রায়াল ও ফি",
        body: [
          "ফ্রি প্ল্যানে নির্দিষ্ট সংখ্যক প্রোডাক্ট ও মাসিক অর্ডার পর্যন্ত কোনো সাবস্ক্রিপশন ফি নেই। paid প্ল্যানে ৭ দিনের ট্রায়াল থাকে; ট্রায়ালে কার্ড লাগে না।",
          "ট্রায়াল শেষে paid প্ল্যানে রূপান্তর না হলে অ্যাকাউন্ট স্বয়ংক্রিয়ভাবে ফ্রি প্ল্যানে ফিরে যায়।",
          "প্রতিটি প্ল্যানে নির্দিষ্ট সংখ্যক অর্ডার ফি-মুক্ত; এর পরে অর্ডারের ডিসকাউন্ট-সমন্বিত পণ্যমূল্যের উপর প্ল্যান অনুযায়ী কমিশন প্রযোজ্য। ডেলিভারি চার্জ ও রিফান্ড হওয়া লাইন কমিশনের হিসাবে ধরা হয় না।",
          "মাসিক ইনভয়েসে সাবস্ক্রিপশন ও অর্জিত কমিশন আলাদা লাইনে, অর্ডার রেফারেন্সসহ দেখানো হয়। নির্ধারিত সময়ে পরিশোধ না হলে ৭ দিনের grace period শুরু হয়।",
          "Basic, Standard ও Pro প্ল্যানের মূল্য ব্যবসায়িক সম্মতির ভিত্তিতে নির্ধারিত হয়; চূড়ান্ত মূল্য অ্যাকাউন্ট ম্যানেজারের কোটেশনে উল্লেখ থাকবে।",
        ],
      },
      {
        heading: "মার্চেন্টের দায়িত্ব",
        body: [
          "দোকানে প্রকাশিত পণ্যের বর্ণনা, দাম, স্টক, ডেলিভারি সময় ও রিটার্ন নীতি সঠিক রাখার দায় মার্চেন্টের।",
          "নিষিদ্ধ বা নিয়ন্ত্রিত পণ্য (যেমন অবৈধ ওষুধ, অস্ত্র, নকল ব্র্যান্ড) বিক্রি করা যাবে না। এমন অভিযোগ প্রমাণিত হলে দোকান সাসপেন্ড করা হতে পারে।",
          "কাস্টমারের ব্যক্তিগত তথ্য শুধু অর্ডার পূরণের জন্য ব্যবহার করা যাবে; তৃতীয় পক্ষের কাছে বিক্রি করা যাবে না।",
          "প্ল্যাটফর্মের দুর্বলতা খুঁজে পেলে দায়িত্বশীলভাবে জানাতে হবে; অনুমতি ছাড়া নিরাপত্তা পরীক্ষা চালানো যাবে না।",
        ],
      },
      {
        heading: "পেমেন্ট ও পেমেন্ট গেটওয়ে",
        body: [
          "অনলাইন পেমেন্ট সরাসরি মার্চেন্টের গেটওয়ে অ্যাকাউন্টে যায়। গেটওয়ের নিজস্ব শর্ত, ফি ও সেটেলমেন্ট সময়সূচি প্রযোজ্য।",
          "ক্যাশ অন ডেলিভারিতে কালেকশন ও রিকনসিলিয়েশনের দায় মার্চেন্ট ও কুরিয়ারের মধ্যে।",
          "সন্দেহজনক লেনদেন প্রতিরোধে প্ল্যাটফর্ম নির্দিষ্ট অর্ডার বা দোকান সাময়িকভাবে পর্যালোচনায় রাখতে পারে; সেক্ষেত্রে মার্চেন্টকে জানানো হবে।",
        ],
      },
      {
        heading: "কনটেন্ট ও মেধাস্বত্ব",
        body: [
          "মার্চেন্ট নিজের আপলোড করা ছবি, টেক্সট ও লোগোর মালিক থাকে এবং সেগুলো প্ল্যাটফর্মে দেখানোর অনুমতি দেয়।",
          "থিম, টেমপ্লেট, কোড ও প্ল্যাটফর্মের ডিজাইন ATLaS-এর সম্পত্তি; অনুমতি ছাড়া পুনর্ব্যবহার বা পুনর্বিক্রয় করা যাবে না।",
          "অভিযোগ পেলে কপিরাইট লঙ্ঘনকারী কনটেন্ট সরানো হতে পারে।",
        ],
      },
      {
        heading: "সেবা বন্ধ, ডাউনগ্রেড ও ডেটা",
        body: [
          "প্ল্যান ডাউনগ্রেড করলে কোটা ছাড়ানো নতুন তৈরি বন্ধ হয়, কিন্তু পুরোনো ডেটা পড়া, এডিট ও এক্সপোর্ট করা যায়।",
          "বিলিং সমস্যায় সাসপেনশনের সময় দোকান maintenance পেজ দেখায়; ডেটা সংরক্ষিত থাকে এবং পেমেন্টের পর সাথে সাথে আবার চালু হয়।",
          "অ্যাকাউন্ট মুছে ফেলার অনুরোধ করলে আর্থিক রেকর্ড সংরক্ষণ বিধি অনুযায়ী নির্দিষ্ট সময় পর্যন্ত রাখা হয়, বাকি ডেটা মুছে ফেলা হয়।",
        ],
      },
      {
        heading: "সীমাবদ্ধতা ও দায়",
        body: [
          "প্ল্যাটফর্ম 'যেমন আছে' ভিত্তিতে দেওয়া হয়। ইন্টারনেট, গেটওয়ে বা কুরিয়ারের তৃতীয় পক্ষীয় ব্যর্থতার জন্য ATLaS দায়ী নয়।",
          "কোনো অবস্থাতেই ATLaS-এর দায় ওই বিলিং সময়ের মধ্যে মার্চেন্টের প্রদত্ত সাবস্ক্রিপশন ফি-র বেশি হবে না।",
          "সেবা বন্ধ করার আগে যুক্তিসঙ্গত নোটিশ দেওয়া হবে, তবে নিরাপত্তা বা আইনি কারণে তাৎক্ষণিক স্থগিতাদেশ সম্ভব।",
        ],
      },
      {
        heading: "শর্ত পরিবর্তন ও যোগাযোগ",
        body: [
          "শর্তে বড় পরিবর্তন হলে অ্যাপের ভেতরে নোটিফিকেশন ও ইমেইলে জানানো হবে। পরিবর্তনের পর সেবা ব্যবহার চালিয়ে গেলে নতুন শর্তে সম্মতি ধরা হবে।",
          "প্রশ্ন থাকলে যোগাযোগ পেজ থেকে টিকেট খুলুন; উত্তর কর্মদিবসে দেওয়া হয়।",
        ],
      },
    ],
    footnote:
      "এই দস্তাবেজটি প্ল্যাটফর্মের বর্তমান নীতি বর্ণনা করে এবং এটি কোনো আইনি পরামর্শ নয়। চূড়ান্ত প্রকাশনার আগে স্থানীয় আইন বিশেষজ্ঞের যাচাই প্রয়োজন।",
  },
  en: {
    meta: {
      title: "Terms of service",
      description: "The terms for using ATLaS — accounts, plans, payments, content and liability.",
    },
    title: "Terms of service",
    updated: "21 October 2026",
    intro:
      "By using ATLaS you agree to these terms. Opening an account, running a store and taking payments on the platform are all governed by them.",
    sections: [
      {
        heading: "Accounts and eligibility",
        body: [
          "You must provide a correct mobile number and verify it with the OTP. Responsibility for the ownership of that number rests with the user.",
          "One account may hold several stores; each store is treated as a separate tenant and its data is kept separate.",
          "Accounts may not be opened by anyone under 18, or by anyone without the legal right to run a business in Bangladesh.",
        ],
      },
      {
        heading: "Plans, trials and fees",
        body: [
          "The free plan carries no subscription fee up to a set number of products and monthly orders. Paid plans include a 7-day trial; no card is required for the trial.",
          "If the trial is not converted to a paid plan, the account returns to the free plan automatically.",
          "Each plan includes a set number of fee-free orders; beyond that a commission applies to the discount-adjusted merchandise value, according to the plan. Delivery charges and refunded lines are excluded from the commission base.",
          "The monthly invoice shows the subscription and the accrued commission on separate lines, with order references. Failure to pay by the due date starts a 7-day grace period.",
          "Pricing for Basic, Standard and Pro is set by commercial agreement; the binding price is the one in the account manager's quote.",
        ],
      },
      {
        heading: "Merchant responsibilities",
        body: [
          "The merchant is responsible for keeping product descriptions, prices, stock, delivery times and return policies accurate.",
          "Prohibited or regulated goods (for example illegal medicines, weapons or counterfeit brands) may not be sold. A store may be suspended if such a complaint is substantiated.",
          "Customer personal data may be used only to fulfil orders and may not be sold to third parties.",
          "If you find a vulnerability in the platform, report it responsibly; do not run security tests without permission.",
        ],
      },
      {
        heading: "Payments and gateways",
        body: [
          "Online payments go directly to the merchant's own gateway account. The gateway's own terms, fees and settlement schedule apply.",
          "Collection and reconciliation of cash on delivery are between the merchant and the courier.",
          "To prevent suspected fraud the platform may place an order or store under temporary review; the merchant is told when that happens.",
        ],
      },
      {
        heading: "Content and intellectual property",
        body: [
          "The merchant owns the images, text and logos they upload and grants the platform permission to display them.",
          "Themes, templates, code and the platform design are the property of ATLaS and may not be reused or resold without permission.",
          "On a substantiated complaint, content that infringes copyright may be removed.",
        ],
      },
      {
        heading: "Downgrades, suspension and data",
        body: [
          "Downgrading stops new records beyond the quota, but existing data stays readable, editable and exportable.",
          "During a billing suspension the store shows a maintenance page; the data is retained and the store comes back as soon as payment is settled.",
          "On an account deletion request, financial records are kept for the period required by record-keeping rules and the remaining data is deleted.",
        ],
      },
      {
        heading: "Limitation of liability",
        body: [
          "The platform is provided as is. ATLaS is not liable for third-party failures of the internet, a payment gateway or a courier.",
          "In no event will ATLaS's liability exceed the subscription fees paid by the merchant for the billing period concerned.",
          "Reasonable notice is given before a service is withdrawn, though a suspension may be immediate for security or legal reasons.",
        ],
      },
      {
        heading: "Changes and contact",
        body: [
          "Material changes to these terms are announced in-app and by email. Continuing to use the service after a change counts as acceptance.",
          "If anything is unclear, open a ticket from the contact page; answers are given on working days.",
        ],
      },
    ],
    footnote:
      "This document describes the platform's current policy and is not legal advice. Have it reviewed by a local legal specialist before final publication.",
  },
} as const;

export async function generateMetadata() {
  const locale = await getLocale();
  return COPY[locale].meta;
}

export default async function TermsPage() {
  const locale = await getLocale();
  const t = COPY[locale];

  return (
    <LegalPage
      title={t.title}
      updated={t.updated}
      intro={t.intro}
      sections={t.sections.map((section) => ({ heading: section.heading, body: [...section.body] }))}
      footnote={t.footnote}
    />
  );
}
