import { LegalPage } from "@/app/(marketing)/_components/legal-page";
import { getLocale } from "@/lib/i18n/server";

/** Privacy policy (PRD §13). */

export const dynamic = "force-dynamic";

const COPY = {
  bn: {
    meta: {
      title: "প্রাইভেসি পলিসি",
      description: "ATLaS কী ডেটা সংগ্রহ করে, কেন করে, কতদিন রাখে এবং আপনার অধিকার কী।",
    },
    title: "প্রাইভেসি পলিসি",
    updated: "২১ অক্টোবর ২০২৬",
    intro:
      "এই নীতিতে বলা হয়েছে ATLaS কোন তথ্য সংগ্রহ করে, কেন সংগ্রহ করে, কতদিন রাখে এবং আপনি কীভাবে সেগুলো দেখতে, এক্সপোর্ট করতে বা মুছতে পারেন।",
    sections: [
      {
        heading: "আমরা কী তথ্য সংগ্রহ করি",
        body: [
          "অ্যাকাউন্ট তথ্য: মোবাইল নম্বর, নাম, ইমেইল (ঐচ্ছিক), পাসওয়ার্ডের হ্যাশ। পাসওয়ার্ড কখনো প্লেইন টেক্সটে সংরক্ষিত হয় না।",
          "দোকান ও ক্যাটালগ তথ্য: ব্যবসার নাম, ঠিকানা, লোগো, পণ্যের ছবি ও বর্ণনা, দাম ও স্টক।",
          "অর্ডার তথ্য: ক্রেতার নাম, ফোন, ডেলিভারি ঠিকানা, অর্ডার লাইন, পেমেন্ট স্ট্যাটাস।",
          "প্রযুক্তিগত তথ্য: সেশন, IP ঠিকানা, ব্রাউজার/ডিভাইস, লগইন ইভেন্ট, API রিকোয়েস্ট কাউন্ট। নিরাপত্তা ও প্রতারণা প্রতিরোধে এগুলো প্রয়োজন।",
          "প্ল্যাটফর্ম অ্যানালিটিক্স: সাইনআপ, দোকান তৈরি, থিম নির্বাচন, checkout শুরু — ইভেন্টের নাম ও সময়, ব্যক্তিগত কথোপকথন নয়।",
        ],
      },
      {
        heading: "কেন ব্যবহার করা হয়",
        body: [
          "সেবা চালানো ও অর্ডার পূরণ করা, পেমেন্ট প্রসেস করা, ইনভয়েস ও ফি হিসাব রাখা।",
          "নিরাপত্তা: OTP যাচাই, রেট লিমিট, সন্দেহজনক লগইন শনাক্ত করা, অডিট লগ রাখা।",
          "সাপোর্ট: আপনি যে টিকেট খুলেছেন তার উত্তর দেওয়া এবং সমস্যার ইতিহাস দেখা।",
          "পণ্যের উন্নয়ন: কোন ফিচার ব্যবহার হচ্ছে তা সমষ্টিগতভাবে বোঝা — ব্যক্তিগত প্রোফাইল তৈরি করা নয়।",
        ],
      },
      {
        heading: "শেয়ারিং ও তৃতীয় পক্ষ",
        body: [
          "পেমেন্ট গেটওয়ে (bKash, Nagad, SSLCommerz) — লেনদেন সম্পন্ন করার জন্য প্রয়োজনীয় তথ্য।",
          "SMS ও ইমেইল প্রোভাইডার — OTP ও অর্ডার নোটিফিকেশন পাঠানোর জন্য শুধু নম্বর/ঠিকানা।",
          "কুরিয়ার পার্টনার — ডেলিভারির জন্য নাম, ফোন ও ঠিকানা, এবং কেবল মার্চেন্ট যখন শিপমেন্ট তৈরি করেন।",
          "আইনি বাধ্যবাধকতা থাকলে বা গুরুতর প্রতারণার তদন্তে সংশ্লিষ্ট কর্তৃপক্ষের কাছে তথ্য দেওয়া হতে পারে।",
          "আমরা ক্রেতার ব্যক্তিগত তথ্য বিজ্ঞাপনদাতার কাছে বিক্রি করি না।",
        ],
      },
      {
        heading: "কুকিজ ও সেশন",
        body: [
          "লগইন সেশন ধরে রাখতে তিনটি কুকি ব্যবহৃত হয়: অ্যাক্সেস টোকেন, রিফ্রেশ টোকেন ও CSRF টোকেন। এগুলো httpOnly এবং SameSite সেটিংসহ রাখা হয়।",
          "কোনো থার্ড-পার্টি অ্যাড ট্র্যাকিং কুকি ব্যবহার করা হয় না।",
        ],
      },
      {
        heading: "কতদিন সংরক্ষণ করা হয়",
        body: [
          "সক্রিয় অ্যাকাউন্টের ডেটা যতদিন অ্যাকাউন্ট চালু থাকে ততদিন রাখা হয়।",
          "অ্যাকাউন্ট মুছে ফেলার অনুরোধের পর সাধারণ ডেটা ৩০ দিনের মধ্যে মুছে ফেলা হয়; ইনভয়েস, ফি লেজার ও পেমেন্ট রেকর্ড আর্থিক রেকর্ড হিসেবে নির্ধারিত সময় (সাধারণত ৬ বছর) সংরক্ষিত থাকে।",
          "সেশন রেকর্ড মেয়াদ শেষে বা লগআউটের পর নিষ্ক্রিয় হয়; অডিট লগ নিরাপত্তা প্রয়োজনে দীর্ঘ সময় রাখা হয়।",
        ],
      },
      {
        heading: "নিরাপত্তা",
        body: [
          "পাসওয়ার্ড bcrypt দিয়ে হ্যাশ করা; OTP শুধু HMAC আকারে সংরক্ষিত।",
          "গেটওয়ে ক্রেডেনশিয়াল AES-256-GCM দিয়ে এনক্রিপ্ট করা এবং UI-তে কখনো ফেরত দেখানো হয় না।",
          "প্রতিটি ডেটাবেস কুয়েরি tenant/store আইডি দিয়ে স্কোপ করা; ক্লায়েন্টের পাঠানো tenant আইডি কখনো বিশ্বাস করা হয় না।",
          "প্রশাসনিক কাজ (সাসপেন্ড, ইমপারসোনেশন, প্ল্যান পরিবর্তন) কারণ ও সময়সহ অডিট লগে থাকে।",
        ],
      },
      {
        heading: "আপনার অধিকার",
        body: [
          "নিজের ডেটা দেখা ও CSV-তে এক্সপোর্ট করা — Products, Orders ও Customers পেজ থেকে।",
          "ভুল তথ্য সংশোধন করা — প্রোফাইল ও কাস্টমার রেকর্ড থেকে।",
          "অ্যাকাউন্ট মুছে ফেলার অনুরোধ — Account সেটিংস থেকে; অনুরোধ বাতিলও করা যায়।",
          "মার্কেটিং যোগাযোগ থেকে সরে আসা — নোটিফিকেশন সেটিংসে বন্ধ করা যায়; লেনদেন-সংক্রান্ত বার্তা চালু থাকবে।",
        ],
      },
      {
        heading: "যোগাযোগ ও পরিবর্তন",
        body: [
          "প্রাইভেসি নিয়ে প্রশ্ন বা অনুরোধ থাকলে যোগাযোগ পেজ থেকে টিকেট খুলুন।",
          "এই নীতিতে পরিবর্তন হলে অ্যাপের ভেতরে নোটিফিকেশন দিয়ে জানানো হবে; বড় পরিবর্তনে ইমেইলও পাঠানো হবে।",
        ],
      },
    ],
    footnote:
      "এই নীতিটি প্ল্যাটফর্মের বর্তমান ডেটা চর্চা বর্ণনা করে। আইনগত প্রকাশনার আগে স্থানীয় ডেটা সুরক্ষা আইনের সাথে মিলিয়ে যাচাই করা প্রয়োজন।",
  },
  en: {
    meta: {
      title: "Privacy policy",
      description: "What data ATLaS collects, why, how long it is kept, and what rights you have.",
    },
    title: "Privacy policy",
    updated: "21 October 2026",
    intro:
      "This policy explains what information ATLaS collects, why it is collected, how long it is kept, and how you can view, export or delete it.",
    sections: [
      {
        heading: "What we collect",
        body: [
          "Account data: mobile number, name, email (optional) and a password hash. Passwords are never stored in plain text.",
          "Store and catalogue data: business name, address, logo, product images and descriptions, prices and stock.",
          "Order data: the buyer's name, phone, delivery address, order lines and payment status.",
          "Technical data: sessions, IP address, browser and device, login events and API request counts. This is needed for security and fraud prevention.",
          "Platform analytics: signup, store creation, theme selection, checkout started — event names and timestamps, not private conversations.",
        ],
      },
      {
        heading: "Why we use it",
        body: [
          "To run the service and fulfil orders, process payments, and keep invoices and fee records straight.",
          "Security: OTP verification, rate limiting, spotting suspicious logins and keeping an audit log.",
          "Support: answering the tickets you open and understanding the history of a problem.",
          "Product development: understanding in aggregate which features are used — not building individual profiles.",
        ],
      },
      {
        heading: "Sharing and third parties",
        body: [
          "Payment gateways (bKash, Nagad, SSLCommerz) — the data needed to complete a transaction.",
          "SMS and email providers — only the number or address, to deliver OTPs and order notifications.",
          "Courier partners — name, phone and address for delivery, and only when the merchant creates a shipment.",
          "Where the law requires it, or in the investigation of serious fraud, information may be provided to the relevant authority.",
          "We do not sell buyer personal data to advertisers.",
        ],
      },
      {
        heading: "Cookies and sessions",
        body: [
          "Three cookies keep a login session: an access token, a refresh token and a CSRF token. They are set httpOnly and with SameSite settings.",
          "No third-party advertising cookies are used.",
        ],
      },
      {
        heading: "How long we keep it",
        body: [
          "Data for an active account is kept for as long as the account exists.",
          "After a deletion request, ordinary data is removed within 30 days; invoices, the fee ledger and payment records are kept for the period required for financial records (usually six years).",
          "Session records expire or are invalidated on logout; audit logs are kept longer for security purposes.",
        ],
      },
      {
        heading: "Security",
        body: [
          "Passwords are hashed with bcrypt; OTPs are stored only as an HMAC.",
          "Gateway credentials are encrypted with AES-256-GCM and are never shown back in the UI.",
          "Every database query is scoped by tenant and store id; a tenant id sent by the client is never trusted.",
          "Administrative actions (suspension, impersonation, plan changes) are recorded in the audit log with a reason and a timestamp.",
        ],
      },
      {
        heading: "Your rights",
        body: [
          "See and export your data as CSV — from the Products, Orders and Customers pages.",
          "Correct inaccurate information — from your profile and customer records.",
          "Request account deletion — from Account settings; the request can also be cancelled.",
          "Opt out of marketing — switch it off in notification settings; transactional messages continue.",
        ],
      },
      {
        heading: "Contact and changes",
        body: [
          "For any privacy question or request, open a ticket from the contact page.",
          "Changes to this policy are announced in-app, and material changes are also emailed.",
        ],
      },
    ],
    footnote:
      "This policy describes the platform's current data practices. It should be checked against local data-protection law before legal publication.",
  },
} as const;

export async function generateMetadata() {
  const locale = await getLocale();
  return COPY[locale].meta;
}

export default async function PrivacyPage() {
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
