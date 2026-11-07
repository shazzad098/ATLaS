import Link from "next/link";
import {
  ArrowRight,
  ArrowUpRight,
  BadgeCheck,
  CalendarDays,
  Clock,
  CreditCard,
  FileText,
  MessageSquare,
  Package,
  PackageCheck,
  Receipt,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  Store,
  Timer,
  Wallet,
  ChevronDown,
} from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { getLocale } from "@/lib/i18n/server";

/** Refund + cancellation policy (PRD §4.1 "Refund/Cancellation Policy"). */

export const dynamic = "force-dynamic";

const COPY = {
  bn: {
    meta: {
      title: "রিফান্ড ও বাতিল নীতি",
      description: "ক্রেতার অর্ডার রিফান্ড, মার্চেন্টের সাবস্ক্রিপশন বাতিল এবং প্ল্যাটফর্ম ফি ফেরতের নিয়ম।",
    },
    hero: {
      badge: "রিফান্ড ও বাতিল নীতি",
      titleLead: "টাকা ফেরত, অর্ডার বাতিল আর ফি-র হিসাব —",
      titleAccent: "সব পরিষ্কার",
      body: "দুই ধরনের রিফান্ড আছে — ক্রেতার অর্ডার এবং মার্চেন্টের প্ল্যাটফর্ম সাবস্ক্রিপশন। দুটোর নিয়ম আলাদা, তাই নিচে ধাপে ধাপে আলাদা করে দেওয়া আছে।",
      updated: "সর্বশেষ হালনাগাদ: ২১ অক্টোবর ২০২৬",
      policyBadge: "প্ল্যাটফর্ম ডিফল্ট নীতি",
      primary: "সহায়তা নিন",
      secondary: "যোগাযোগ করুন",
    },
    glance: {
      eyebrow: "এক নজরে",
      title: "রিফান্ডের তিনটি সময়সীমা",
      liveBadge: "হালনাগাদ",
      facts: [
        { value: "৭ দিন", label: "পণ্য পাওয়ার পর সমস্যা জানানোর সময়" },
        { value: "৭–১০", label: "কর্মদিবসে গেটওয়ে রিফান্ড" },
        { value: "১৪ দিন", label: "ইনভয়েস নম্বরসহ ফেরতের অনুরোধ" },
      ],
      noteTitle: "মনে রাখুন",
      notes: [
        "পুরো বাতিল বা পুরো রিফান্ডে প্ল্যাটফর্ম ফি ফেরত",
        "আংশিক রিফান্ডে শুধু রিফান্ড হওয়া লাইনের অনুপাতে সমন্বয়",
        "গেটওয়ে চার্জ গেটওয়ের নিজস্ব নীতিতে প্রযোজ্য",
      ],
      contact: "প্রশ্ন আছে? টিকেট খুলুন",
      currency: "BDT · Asia/Dhaka",
    },
    audience: {
      label: "কার জন্য এই নীতি",
      items: [
        {
          title: "ক্রেতা",
          body: "অর্ডার ট্র্যাকিং থেকে রিটার্ন বা রিফান্ডের অনুরোধ করুন।",
          href: "#order-refund",
        },
        {
          title: "মার্চেন্ট",
          body: "অর্ডার অনুমোদন, ক্যাশ অন ডেলিভারি রিফান্ড ও সাবস্ক্রিপশন বাতিল সামলান।",
          href: "#request",
        },
        {
          title: "প্ল্যাটফর্ম ফি",
          body: "বাতিল বা রিফান্ডে কমিশন স্বয়ংক্রিয়ভাবে সমন্বয় হয়।",
          href: "#platform-fee",
        },
      ],
    },
    aside: {
      tocLabel: "এই নীতিতে",
      helpTitle: "নিজে সমাধান হচ্ছে না?",
      helpBody: "ইনভয়েস বা অর্ডার আইডি দিয়ে টিকেট খুলুন — কর্মদিবসে উত্তর পাবেন।",
      helpCta: "যোগাযোগ করুন",
    },
    nav: [
      { id: "order-refund", label: "ক্রেতার অর্ডার রিফান্ড" },
      { id: "process", label: "রিফান্ড প্রক্রিয়া" },
      { id: "platform-fee", label: "প্ল্যাটফর্ম ফি" },
      { id: "subscription", label: "সাবস্ক্রিপশন বাতিল" },
      { id: "subscription-refund", label: "সাবস্ক্রিপশন ফি ফেরত" },
      { id: "request", label: "অনুরোধ করবেন যেভাবে" },
      { id: "dispute", label: "বিরোধ ও প্রশ্ন" },
    ],
    orderRefund: {
      index: "০১",
      title: "ক্রেতার অর্ডার রিফান্ড",
      description: "প্রতিটি দোকানের নিজস্ব রিটার্ন নীতি থাকে; ATLaS প্রক্রিয়াটি চালায়, সিদ্ধান্তের দায় মার্চেন্টের।",
      bodyLead:
        "ক্রেতা অর্ডার ট্র্যাকিং পেজ থেকে রিটার্ন বা রিফান্ডের অনুরোধ করতে পারেন। অনুরোধটি মার্চেন্টের অর্ডার ডিটেইলে জমা হয় এবং স্ট্যাটাস",
      bodyStatus: "“রিটার্ন অনুরোধ”",
      bodyEnd: "হয়।",
      bodyApproval:
        "মার্চেন্ট অনুমোদন করলে গেটওয়ে দিয়ে রিফান্ড প্রসেস হয়; ক্যাশ অন ডেলিভারিতে রিফান্ডের ব্যবস্থা মার্চেন্ট নিজে করেন।",
      bodyDamaged:
        "পণ্য ভাঙা, ভুল পণ্য বা বর্ণনার সাথে মিল না থাকলে ডেলিভারির ৭ দিনের মধ্যে জানানো উচিত। ব্যবহৃত বা ক্ষতিগ্রস্ত পণ্য সাধারণত ফেরত নেওয়া হয় না, যদি না সমস্যাটি আগে থেকেই ছিল।",
      windowTitle: "৭ দিনের জানানোর উইন্ডো",
      windowBody: "পণ্য পাওয়ার দিন থেকে ৭ দিনের মধ্যে ছবি ও বিবরণসহ জানালে মার্চেন্টের যাচাই করা সহজ হয়।",
      needTitle: "প্রয়োজন হবে",
      needs: ["অর্ডার আইডি", "সমস্যার ছবি বা ভিডিও", "সংক্ষিপ্ত বিবরণ"],
    },
    process: {
      index: "০২",
      title: "রিফান্ড প্রক্রিয়া",
      description: "অনুরোধ থেকে টাকা ফেরা পর্যন্ত চারটি ধাপ। প্রতিটি ধাপ অর্ডার টাইমলাইনে দেখা যায়।",
      steps: [
        {
          title: "অনুরোধ জমা",
          body: "ক্রেতা অর্ডার ট্র্যাকিং পেজ থেকে রিটার্ন/রিফান্ডের অনুরোধ করেন; অনুরোধটি মার্চেন্টের অর্ডার ডিটেইলে জমা হয়।",
        },
        {
          title: "মার্চেন্ট যাচাই",
          body: "দোকানের নিজস্ব রিটার্ন নীতির ভিত্তিতে মার্চেন্ট অনুরোধটি অনুমোদন বা প্রত্যাখ্যান করেন।",
        },
        {
          title: "রিফান্ড প্রক্রিয়া",
          body: "অনুমোদিত হলে গেটওয়ে দিয়ে রিফান্ড যায়; ক্যাশ অন ডেলিভারির ক্ষেত্রে মার্চেন্ট নিজে ব্যবস্থা করেন।",
        },
        {
          title: "নিশ্চিতকরণ",
          body: "অর্ডার টাইমলাইন ও অডিট লগে প্রতিটি ধাপের রেকর্ড থাকে, তাই পরে যাচাই করা যায়।",
        },
      ],
    },
    platformFee: {
      index: "০৩",
      title: "রিফান্ড হলে প্ল্যাটফর্ম ফি",
      description: "কমিশন শুধু সফল অর্ডারের উপর থাকে; বাতিল বা রিফান্ড হলে সেটি স্বয়ংক্রিয়ভাবে সমন্বয় হয়।",
      columns: {
        situation: "পরিস্থিতি",
        fee: "প্ল্যাটফর্ম ফি",
        quota: "মাসিক কোটা",
      },
      rows: [
        {
          case: "পুরো অর্ডার বাতিল / পুরো রিফান্ড",
          fee: "ওই অর্ডারের কমিশন বাতিল",
          quota: "ব্যবহৃত কোটা ফেরত",
          tone: "success",
        },
        {
          case: "আংশিক রিফান্ড",
          fee: "শুধু রিফান্ড হওয়া লাইনের অনুপাতে ফি",
          quota: "আংশিক সমন্বয়",
          tone: "warning",
        },
        {
          case: "ডেলিভারি চার্জ",
          fee: "প্ল্যাটফর্ম ফি-র হিসাবে ধরা হয় না",
          quota: "প্রযোজ্য নয়",
          tone: "neutral",
        },
        {
          case: "গেটওয়ে চার্জ",
          fee: "গেটওয়ের নিজস্ব নীতি অনুযায়ী",
          quota: "প্রযোজ্য নয়",
          tone: "info",
        },
      ],
      note: "গেটওয়ে চার্জ গেটওয়ের নিজস্ব নীতি অনুযায়ী প্রযোজ্য এবং প্ল্যাটফর্ম কমিশনের সাথে মেশানো হয় না। তাই গেটওয়ে রিফান্ডে ব্যাংক বা গেটওয়ে কিছু চার্জ কাটতে পারে।",
    },
    subscription: {
      index: "০৪",
      title: "সাবস্ক্রিপশন বাতিল",
      description: "মার্চেন্ট যেকোনো সময় বিলিং পেজ থেকে বাতিল করতে পারেন — ডেটা মুছে যায় না।",
      atPeriodEnd: {
        badge: "প্রস্তাবিত",
        title: "সময় শেষে বাতিল",
        body: "চলতি পিরিয়ডের শেষ পর্যন্ত সব ফিচার চালু থাকে; এরপর অ্যাকাউন্ট ফ্রি প্ল্যানে নেমে আসে।",
        points: ["কোনো তাৎক্ষণিক ফিচার বন্ধ হয় না", "চলতি পিরিয়ডের জন্য চার্জ প্রযোজ্য", "ডেটা ও এক্সপোর্ট অ্যাক্সেস থাকে"],
      },
      immediate: {
        badge: "তাৎক্ষণিক",
        title: "সাথে সাথে বাতিল",
        body: "পেইড ফিচার বন্ধ হয়ে অ্যাকাউন্ট ফ্রি প্ল্যানে নেমে আসে; নতুন তৈরি কোটা অনুযায়ী সীমিত হয়।",
        points: ["পুরোনো ডেটা মুছে যায় না", "পড়া, এডিট ও এক্সপোর্ট খোলা থাকে", "নতুন তৈরি কোটা ছাড়ালে বন্ধ হয়"],
      },
      trialNote: "৭ দিনের ট্রায়ালে কোনো চার্জ হয় না, তাই ট্রায়াল বাতিলে ফেরত দেওয়ার কিছু থাকে না।",
    },
    subscriptionRefund: {
      index: "০৫",
      title: "সাবস্ক্রিপশন ফি ফেরত",
      description: "চলতি মাসের ফি সাধারণত ফেরতযোগ্য নয়; তবে নির্দিষ্ট কিছু ক্ষেত্রে সম্পূর্ণ ফেরত বা ক্রেডিট পাওয়া যায়।",
      rules: [
        {
          title: "চলতি মাসের ফি",
          body: "ইতিমধ্যে পরিশোধিত সাবস্ক্রিপশন ফি সাধারণত ফেরতযোগ্য নয়, কারণ পিরিয়ডের পুরো সময় সেবা চালু থাকে।",
        },
        {
          title: "প্ল্যাটফর্মের ত্রুটি",
          body: "ডাবল চার্জ, ভুল পরিমাণ বা প্ল্যাটফর্মের ত্রুটির কারণে হওয়া চার্জ সম্পূর্ণ ফেরত দেওয়া হয়।",
        },
        {
          title: "দীর্ঘ ডাউনটাইম",
          body: "সাসপেনশন বা একটানা ৭২ ঘণ্টার বেশি ডাউনটাইম হলে অনুরোধের ভিত্তিতে পরবর্তী ইনভয়েসে ক্রেডিট দেওয়া হয়।",
        },
        {
          title: "অনুরোধের সময়",
          body: "ইনভয়েস তৈরির ১৪ দিনের মধ্যে ইনভয়েস নম্বরসহ অনুরোধ করতে হবে; অনুমোদিত রিফান্ড সাধারণত ৭–১০ কর্মদিবসে ফেরে।",
        },
      ],
      windowTitle: "১৪ দিনের অনুরোধ উইন্ডো",
      windowBody: "ইনভয়েস নম্বর ও কারণ লিখে বিলিং → ইনভয়েস → সহায়তা থেকে টিকেট খুলুন।",
      cta: "টিকেট খুলুন",
    },
    request: {
      index: "০৬",
      title: "অনুরোধ করবেন যেভাবে",
      description: "ক্রেতা ও মার্চেন্ট — দুই পক্ষের জন্য আলাদা পথ।",
      buyer: {
        title: "ক্রেতার জন্য",
        steps: [
          "অর্ডার ট্র্যাকিং পেজ খুলুন।",
          "সমস্যাযুক্ত পণ্য ও কারণ নির্বাচন করুন।",
          "ছবি/বিবরণসহ রিটার্ন বা রিফান্ডের অনুরোধ জমা দিন।",
        ],
      },
      merchant: {
        title: "মার্চেন্টের জন্য",
        steps: [
          "অর্ডার → রিটার্ন/রিফান্ড অনুরোধ খুলুন।",
          "অনুমোদন বা প্রত্যাখ্যান করুন, কারণ লিখুন।",
          "ক্যাশ অন ডেলিভারির রিফান্ড নিজে সম্পন্ন করুন; গেটওয়ে রিফান্ড সিস্টেম সম্পন্ন করে।",
        ],
      },
      auditNote: "সব অনুরোধ অডিট লগে থাকে",
      helpCta: "সহায়তা কেন্দ্র",
    },
    dispute: {
      index: "০৭",
      title: "বিরোধ ও সচরাচর জিজ্ঞাসা",
      description: "ক্রেতা-মার্চেন্ট বিরোধে প্ল্যাটফর্ম মধ্যস্থতা করে; আইনগত ভোক্তা সুরক্ষা বিধি সবসময় এই নীতির উপরে।",
      cards: [
        {
          title: "মধ্যস্থতা",
          body: "ক্রেতা-মার্চেন্ট বিরোধে প্ল্যাটফর্ম প্রথমে দুই পক্ষের তথ্য নিয়ে মধ্যস্থতা করে; পণ্যের গুণমান বা ডেলিভারির সিদ্ধান্ত মার্চেন্টের।",
        },
        {
          title: "অ্যাকাউন্ট সাসপেনশন",
          body: "প্রমাণিত প্রতারণা, বারবার রিফান্ড এড়ানোর অভিযোগ বা নিষিদ্ধ পণ্য বিক্রয় হলে অ্যাকাউন্ট সাসপেন্ড হতে পারে।",
        },
        {
          title: "আইনগত অধিকার",
          body: "আইনগতভাবে প্রযোজ্য ভোক্তা সুরক্ষা বিধি সবসময় এই নীতির উপরে থাকবে।",
        },
      ],
      faqTitle: "সচরাচর জিজ্ঞাসা",
      faqCount: "{count}টি প্রশ্ন",
      faqs: [
        {
          q: "রিফান্ড কত দিনে ফেরত পাব?",
          a: "মার্চেন্ট অনুমোদনের পর গেটওয়ে রিফান্ড সাধারণত ৭–১০ কর্মদিবসে ফেরে। ক্যাশ অন ডেলিভারির ক্ষেত্রে রিফান্ডের ব্যবস্থা মার্চেন্ট নিজে করেন, তাই সময় দোকানের নীতির উপর নির্ভর করে।",
        },
        {
          q: "প্ল্যাটফর্ম ফি কি ফেরত পাব?",
          a: "পুরো অর্ডার বাতিল বা পুরো রিফান্ড হলে ওই অর্ডারের প্ল্যাটফর্ম কমিশন স্বয়ংক্রিয়ভাবে বাতিল হয় এবং মাসিক কোটা ফিরে আসে। আংশিক রিফান্ডে শুধু রিফান্ড হওয়া লাইনের অনুপাতে ফি পুনঃহিসাব হয়। গেটওয়ে চার্জ গেটওয়ের নিজস্ব নীতি অনুযায়ী প্রযোজ্য।",
        },
        {
          q: "সাবস্ক্রিপশন বাতিল করলে ডেটা মুছে যাবে?",
          a: "না। বাতিল বা ডাউনগ্রেড করলে শুধু কোটা ছাড়ানো নতুন তৈরি বন্ধ হয়; পুরোনো প্রোডাক্ট পড়া, এডিট ও এক্সপোর্ট সবসময় খোলা থাকে।",
        },
        {
          q: "ভাঙা বা ভুল পণ্য পেলে কী করব?",
          a: "পণ্য পাওয়ার ৭ দিনের মধ্যে অর্ডার ট্র্যাকিং পেজ থেকে ছবি ও বিবরণসহ রিটার্ন/রিফান্ডের অনুরোধ করুন। পণ্যের গুণমান ও ডেলিভারির সিদ্ধান্ত মার্চেন্টের, প্রয়োজনে প্ল্যাটফর্ম দুই পক্ষের তথ্য নিয়ে মধ্যস্থতা করে।",
        },
        {
          q: "সাথে সাথে সাবস্ক্রিপশন বাতিল করলে কী হয়?",
          a: "পেইড ফিচার বন্ধ হয়ে অ্যাকাউন্ট ফ্রি প্ল্যানে নেমে আসে; ডেটা মুছে যায় না। 'সময় শেষে বাতিল' নির্বাচন করলে চলতি পিরিয়ডের শেষ পর্যন্ত সব ফিচার চালু থাকে।",
        },
      ],
    },
    closing: {
      eyebrow: "শেষ কথা",
      body: "এই নীতিটি প্ল্যাটফর্মের ডিফল্ট অবস্থান বর্ণনা করে; প্রতিটি দোকানের নিজস্ব রিটার্ন নীতি দোকানের পেজে প্রকাশিত থাকে এবং সেটিই ক্রেতার সাথে চুক্তি।",
    },
    support: {
      eyebrow: "সাপোর্ট",
      title: "রিফান্ড নিয়ে প্রশ্ন আছে?",
      body: "ইনভয়েস নম্বর বা অর্ডার আইডি দিয়ে টিকেট খুলুন। কোন তথ্য দরকার তা নিচের সহায়তা কেন্দ্রে বিস্তারিত আছে।",
      primary: "টিকেট খুলুন",
      secondary: "সহায়তা কেন্দ্র",
    },
  },
  en: {
    meta: {
      title: "Refund and cancellation policy",
      description:
        "The rules for buyer order refunds, merchant subscription cancellations and returns of platform fees.",
    },
    hero: {
      badge: "Refund and cancellation policy",
      titleLead: "Refunds, cancellations and fee calculations —",
      titleAccent: "all made clear",
      body: "There are two kinds of refund — a buyer's order refund and a merchant's platform subscription. The rules differ, so both are set out step by step below.",
      updated: "Last updated: 21 October 2026",
      policyBadge: "Platform default policy",
      primary: "Get help",
      secondary: "Contact us",
    },
    glance: {
      eyebrow: "At a glance",
      title: "Three refund deadlines",
      liveBadge: "Updated",
      facts: [
        { value: "7 days", label: "To report a problem after delivery" },
        { value: "7–10", label: "Working days for a gateway refund" },
        { value: "14 days", label: "To request a return with an invoice number" },
      ],
      noteTitle: "Keep in mind",
      notes: [
        "A full cancellation or full refund returns the platform fee",
        "A partial refund adjusts only the refunded lines, pro rata",
        "Gateway charges follow the gateway's own policy",
      ],
      contact: "Questions? Open a ticket",
      currency: "BDT · Asia/Dhaka",
    },
    audience: {
      label: "Who this policy is for",
      items: [
        {
          title: "Buyers",
          body: "Request a return or refund from order tracking.",
          href: "#order-refund",
        },
        {
          title: "Merchants",
          body: "Handle order approvals, cash-on-delivery refunds and subscription cancellations.",
          href: "#request",
        },
        {
          title: "Platform fees",
          body: "Commission is adjusted automatically on a cancellation or refund.",
          href: "#platform-fee",
        },
      ],
    },
    aside: {
      tocLabel: "In this policy",
      helpTitle: "Can't work it out yourself?",
      helpBody: "Open a ticket with the invoice or order ID — you get an answer on working days.",
      helpCta: "Contact us",
    },
    nav: [
      { id: "order-refund", label: "Buyer order refunds" },
      { id: "process", label: "Refund process" },
      { id: "platform-fee", label: "Platform fee" },
      { id: "subscription", label: "Cancelling a subscription" },
      { id: "subscription-refund", label: "Subscription fee refunds" },
      { id: "request", label: "How to request" },
      { id: "dispute", label: "Disputes and questions" },
    ],
    orderRefund: {
      index: "01",
      title: "Refunds on buyer orders",
      description:
        "Every store sets its own return policy; ATLaS runs the process, while the decision rests with the merchant.",
      bodyLead:
        "A buyer can request a return or refund from the order tracking page. The request lands in the merchant's order details and the status becomes",
      bodyStatus: "“Return requested”",
      bodyEnd: ".",
      bodyApproval:
        "If the merchant approves it, the refund is processed through the gateway; for cash on delivery the merchant arranges the refund themselves.",
      bodyDamaged:
        "If an item arrives damaged or wrong, or does not match its description, it should be reported within 7 days of delivery. Used or damaged goods are generally not accepted back unless the fault was there from the start.",
      windowTitle: "A 7-day reporting window",
      windowBody:
        "Reporting within 7 days of receiving the item, with photos and a description, makes the merchant's review much easier.",
      needTitle: "You will need",
      needs: ["Order ID", "Photos or a video of the problem", "A short description"],
    },
    process: {
      index: "02",
      title: "The refund process",
      description:
        "Four steps from request to money back. Every step shows on the order timeline.",
      steps: [
        {
          title: "Request submitted",
          body: "The buyer files a return or refund request from the order tracking page; it lands in the merchant's order details.",
        },
        {
          title: "Merchant review",
          body: "The merchant approves or declines the request against the store's own return policy.",
        },
        {
          title: "Refund processed",
          body: "Once approved, the refund goes back through the gateway; for cash on delivery the merchant settles it themselves.",
        },
        {
          title: "Confirmation",
          body: "Every step is recorded on the order timeline and in the audit log, so it can be checked later.",
        },
      ],
    },
    platformFee: {
      index: "03",
      title: "The platform fee on a refund",
      description:
        "Commission applies only to successful orders; on a cancellation or refund it is adjusted automatically.",
      columns: {
        situation: "Situation",
        fee: "Platform fee",
        quota: "Monthly quota",
      },
      rows: [
        {
          case: "Full order cancellation / full refund",
          fee: "Commission on that order is cancelled",
          quota: "Quota restored",
          tone: "success",
        },
        {
          case: "Partial refund",
          fee: "Fee only on the refunded lines, pro rata",
          quota: "Partly adjusted",
          tone: "warning",
        },
        {
          case: "Delivery charge",
          fee: "Not counted as a platform fee",
          quota: "Not applicable",
          tone: "neutral",
        },
        {
          case: "Gateway charge",
          fee: "Per the gateway's own policy",
          quota: "Not applicable",
          tone: "info",
        },
      ],
      note: "Gateway charges follow the gateway's own policy and are never mixed into platform commission. A bank or a gateway may therefore deduct something on a gateway refund.",
    },
    subscription: {
      index: "04",
      title: "Cancelling a subscription",
      description:
        "A merchant can cancel at any time from the billing page — no data is deleted.",
      atPeriodEnd: {
        badge: "Recommended",
        title: "Cancel at period end",
        body: "Every feature stays on until the current period ends; the account then drops to the free plan.",
        points: [
          "Nothing is switched off immediately",
          "The current period is still charged",
          "Data and export access remain",
        ],
      },
      immediate: {
        badge: "Immediate",
        title: "Cancel immediately",
        body: "Paid features switch off and the account drops to the free plan; new records are capped by the quota.",
        points: [
          "Existing data is not deleted",
          "Read, edit and export stay open",
          "New records stop once the quota is exceeded",
        ],
      },
      trialNote:
        "The 7-day trial is never charged, so cancelling a trial leaves nothing to refund.",
    },
    subscriptionRefund: {
      index: "05",
      title: "Refunds of subscription fees",
      description:
        "The current month's fee is generally not refundable, though a full refund or credit is available in certain cases.",
      rules: [
        {
          title: "Current month's fee",
          body: "A subscription fee already paid is normally non-refundable, because the service stays available for the whole period.",
        },
        {
          title: "Platform fault",
          body: "A double charge, a wrong amount or a charge caused by a platform fault is refunded in full.",
        },
        {
          title: "Extended downtime",
          body: "For a suspension, or more than 72 hours of continuous downtime, a credit is applied to the next invoice on request.",
        },
        {
          title: "Request window",
          body: "Requests must be made within 14 days of the invoice date, quoting the invoice number; an approved refund usually arrives in 7–10 working days.",
        },
      ],
      windowTitle: "14-day request window",
      windowBody:
        "Open a ticket from Billing → Invoices → Support, quoting the invoice number and the reason.",
      cta: "Open a ticket",
    },
    request: {
      index: "06",
      title: "How to make a request",
      description: "Separate routes for buyers and for merchants.",
      buyer: {
        title: "For buyers",
        steps: [
          "Open the order tracking page.",
          "Select the item at fault and the reason.",
          "Submit a return or refund request with photos and a description.",
        ],
      },
      merchant: {
        title: "For merchants",
        steps: [
          "Open Orders → Return/refund requests.",
          "Approve or decline, and record the reason.",
          "Settle cash-on-delivery refunds yourself; gateway refunds are completed by the system.",
        ],
      },
      auditNote: "Every request is kept in the audit log",
      helpCta: "Help centre",
    },
    dispute: {
      index: "07",
      title: "Disputes and frequently asked questions",
      description:
        "The platform mediates buyer–merchant disputes; statutory consumer protection rules always sit above this policy.",
      cards: [
        {
          title: "Mediation",
          body: "In a buyer–merchant dispute the platform first mediates using information from both sides; the decision on product quality or delivery rests with the merchant.",
        },
        {
          title: "Account suspension",
          body: "An account may be suspended for proven fraud, repeated evasion of refunds or the sale of prohibited goods.",
        },
        {
          title: "Your legal rights",
          body: "Consumer protection rules that apply by law always sit above this policy.",
        },
      ],
      faqTitle: "Frequently asked questions",
      faqCount: "{count} questions",
      faqs: [
        {
          q: "How long does a refund take?",
          a: "Once the merchant approves it, a gateway refund usually arrives in 7–10 working days. For cash on delivery the merchant arranges the refund themselves, so the timing depends on the store's policy.",
        },
        {
          q: "Do I get the platform fee back?",
          a: "On a full order cancellation or a full refund, the platform commission on that order is cancelled automatically and the monthly quota is restored. On a partial refund, the fee is recalculated only on the refunded lines, pro rata. Gateway charges follow the gateway's own policy.",
        },
        {
          q: "Will cancelling my subscription delete my data?",
          a: "No. Cancelling or downgrading only stops new records beyond the quota; existing products stay readable, editable and exportable at all times.",
        },
        {
          q: "What if an item arrives broken or wrong?",
          a: "Request a return or refund from the order tracking page within 7 days of receiving it, with photos and a description. Decisions on product quality and delivery rest with the merchant; where needed, the platform mediates using information from both sides.",
        },
        {
          q: "What happens if I cancel immediately?",
          a: "Paid features switch off and the account drops to the free plan; no data is deleted. Choosing “cancel at period end” keeps every feature running until the end of the current period.",
        },
      ],
    },
    closing: {
      eyebrow: "Final word",
      body: "This policy describes the platform default; each store publishes its own return policy on its storefront, and that is the agreement with the buyer.",
    },
    support: {
      eyebrow: "Support",
      title: "Questions about refunds?",
      body: "Open a ticket with the invoice number or order ID. The help centre below explains exactly what to include.",
      primary: "Open a ticket",
      secondary: "Help centre",
    },
  },
} as const;

const FACTS_ICONS = [Clock, CreditCard, Receipt];

const AUDIENCE_ICONS = [Package, Store, Wallet];

const STEP_ICONS = [MessageSquare, BadgeCheck, CreditCard, PackageCheck];

const REFUND_RULE_ICONS = [Receipt, RotateCcw, Timer, CalendarDays];

const DISPUTE_ICONS = [MessageSquare, ShieldCheck, BadgeCheck];

function SectionHeading({
  index,
  title,
  description,
}: {
  index: string;
  title: string;
  description?: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full border border-brand-200 bg-brand-50 text-[10px] font-bold text-brand-700">
        {index}
      </span>
      <div>
        <h2 className="text-xl font-bold tracking-tight text-ink-900 sm:text-2xl">{title}</h2>
        {description ? <p className="mt-1 max-w-2xl text-sm leading-relaxed text-ink-500">{description}</p> : null}
      </div>
    </div>
  );
}

const TONE = {
  success: "border-emerald-200 bg-emerald-50 text-emerald-700",
  warning: "border-amber-200 bg-amber-50 text-amber-700",
  neutral: "border-ink-200 bg-ink-50 text-ink-600",
  info: "border-sky-200 bg-sky-50 text-sky-700",
};

export async function generateMetadata() {
  const locale = await getLocale();
  return COPY[locale].meta;
}

export default async function RefundPolicyPage() {
  const locale = await getLocale();
  const t = COPY[locale];
  const faqCount = t.dispute.faqCount.replace("{count}", String(t.dispute.faqs.length));

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

        <div className="relative mx-auto grid max-w-6xl items-center gap-12 px-4 pt-14 pb-16 sm:pt-20 lg:grid-cols-[1.05fr_0.95fr] lg:gap-14 lg:pb-24">
          <div>
            <div className="animate-fade-up inline-flex items-center gap-2 rounded-full border border-brand-200 bg-white/80 px-3 py-1 text-[11px] font-semibold text-brand-800 shadow-xs backdrop-blur">
              <Sparkles className="h-3.5 w-3.5" />
              {t.hero.badge}
            </div>

            <h1
              className="animate-fade-up mt-5 text-3xl leading-[1.22] font-bold tracking-tight text-ink-900 sm:text-[44px] sm:leading-[1.16]"
              style={{ animationDelay: "80ms" }}
            >
              {t.hero.titleLead}{" "}
              <span className="relative inline-block bg-gradient-to-r from-brand-700 via-brand-600 to-brand-500 bg-clip-text text-transparent">
                {t.hero.titleAccent}
                <svg
                  viewBox="0 0 300 18"
                  preserveAspectRatio="none"
                  aria-hidden="true"
                  className="absolute -bottom-1.5 left-0 h-3 w-full text-brand-400 sm:h-4"
                >
                  <path
                    d="M3 12C48 4 96 15 147 9c51-6 99 4 150-3"
                    fill="none"
                    stroke="currentColor"
                    strokeLinecap="round"
                    strokeWidth="4"
                  />
                </svg>
              </span>
            </h1>

            <p
              className="animate-fade-up mt-7 max-w-xl text-sm leading-relaxed text-ink-600 sm:text-base"
              style={{ animationDelay: "160ms" }}
            >
              {t.hero.body}
            </p>

            <div
              className="animate-fade-up mt-7 flex flex-wrap items-center gap-2"
              style={{ animationDelay: "220ms" }}
            >
              <span className="inline-flex items-center gap-1.5 rounded-full border border-ink-200 bg-white px-3 py-1 text-[11px] font-medium text-ink-600">
                <CalendarDays className="h-3.5 w-3.5 text-brand-600" />
                {t.hero.updated}
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-[11px] font-medium text-emerald-700">
                <ShieldCheck className="h-3.5 w-3.5" />
                {t.hero.policyBadge}
              </span>
            </div>

            <div className="animate-fade-up mt-8 flex flex-wrap items-center gap-3" style={{ animationDelay: "300ms" }}>
              <ButtonLink href="/help" size="lg">
                {t.hero.primary}
                <ArrowRight className="h-4 w-4" />
              </ButtonLink>
              <ButtonLink href="/contact" variant="outline" size="lg">
                {t.hero.secondary}
              </ButtonLink>
            </div>
          </div>

          {/* At-a-glance card */}
          <div className="animate-fade-up relative mx-auto w-full max-w-md lg:max-w-none" style={{ animationDelay: "200ms" }}>
            <div aria-hidden="true" className="absolute -inset-6 rounded-[2.5rem] bg-gradient-to-br from-brand-200/60 via-white to-accent-400/25 blur-2xl" />

            <div className="relative rounded-3xl border border-white/80 bg-white/85 p-5 shadow-2xl shadow-brand-900/10 backdrop-blur">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[10px] font-semibold tracking-[0.18em] text-ink-500 uppercase">{t.glance.eyebrow}</p>
                  <p className="mt-1 text-sm font-semibold text-ink-900">{t.glance.title}</p>
                </div>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2 py-1 text-[10px] font-semibold text-emerald-700">
                  <span className="animate-pulse-dot h-1.5 w-1.5 rounded-full bg-emerald-500" />
                  {t.glance.liveBadge}
                </span>
              </div>

              <div className="mt-4 grid grid-cols-3 gap-2">
                {t.glance.facts.map((fact, index) => {
                  const Icon = FACTS_ICONS[index];
                  return (
                    <div key={fact.label} className="rounded-2xl border border-ink-100 bg-white p-3">
                      <span className="grid h-7 w-7 place-items-center rounded-lg bg-brand-50 text-brand-700">
                        <Icon className="h-3.5 w-3.5" />
                      </span>
                      <p className="mt-2 text-lg font-bold tracking-tight text-ink-900">{fact.value}</p>
                      <p className="mt-0.5 text-[10px] leading-snug text-ink-500">{fact.label}</p>
                    </div>
                  );
                })}
              </div>

              <div className="mt-4 rounded-2xl border border-ink-100 bg-ink-50/70 p-4">
                <p className="text-[10px] font-semibold tracking-[0.16em] text-ink-500 uppercase">{t.glance.noteTitle}</p>
                <ul className="mt-2.5 space-y-2">
                  {t.glance.notes.map((item) => (
                    <li key={item} className="flex items-start gap-2 text-[11px] leading-relaxed text-ink-600">
                      <span className="mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded-full bg-brand-100 text-brand-700">
                        <svg viewBox="0 0 12 12" aria-hidden="true" className="h-2.5 w-2.5" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="m2 6 2.5 2.5L10 3.5" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </span>
                      {item}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="mt-3 flex items-center justify-between gap-2 px-1">
                <Link href="/contact" className="inline-flex items-center gap-1 text-[11px] font-semibold text-brand-700 hover:text-brand-800">
                  {t.glance.contact}
                  <ArrowUpRight className="h-3 w-3" />
                </Link>
                <span className="text-[10px] text-ink-400">{t.glance.currency}</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Audience strip */}
      <section aria-label={t.audience.label} className="border-b border-ink-100 bg-ink-50/45 py-6">
        <div className="mx-auto grid max-w-6xl gap-3 px-4 sm:grid-cols-3">
          {t.audience.items.map((audience, index) => {
            const Icon = AUDIENCE_ICONS[index];
            return (
              <a
                key={audience.title}
                href={audience.href}
                className="group flex items-start gap-3 rounded-2xl border border-white/80 bg-white/75 p-4 shadow-xs backdrop-blur transition duration-300 hover:-translate-y-0.5 hover:border-brand-200 hover:bg-white hover:shadow-md"
              >
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-700 transition group-hover:bg-brand-600 group-hover:text-white">
                  <Icon className="h-4 w-4" />
                </span>
                <span className="min-w-0">
                  <span className="flex items-center gap-1.5 text-sm font-semibold text-ink-900">
                    {audience.title}
                    <ArrowUpRight className="h-3 w-3 text-ink-300 transition group-hover:text-brand-600" />
                  </span>
                  <span className="mt-0.5 block text-xs leading-relaxed text-ink-500">{audience.body}</span>
                </span>
              </a>
            );
          })}
        </div>
      </section>

      {/* Document */}
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-12 lg:grid-cols-[220px_minmax(0,1fr)] lg:gap-14 lg:py-16">
        <aside className="hidden lg:block">
          <div className="sticky top-24 space-y-4">
            <div className="rounded-2xl border border-ink-200 bg-white p-4 shadow-xs">
              <p className="px-2 text-[10px] font-semibold tracking-[0.18em] text-ink-500 uppercase">{t.aside.tocLabel}</p>
              <nav className="mt-2 space-y-0.5">
                {t.nav.map((item, index) => (
                  <a
                    key={item.id}
                    href={`#${item.id}`}
                    className="group flex items-center gap-2 rounded-lg px-2 py-1.5 text-xs text-ink-600 transition hover:bg-brand-50 hover:text-brand-800"
                  >
                    <span className="w-4 font-mono text-[9px] text-ink-300 group-hover:text-brand-500">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    {item.label}
                  </a>
                ))}
              </nav>
            </div>

            <div className="rounded-2xl border border-brand-200 bg-brand-50/70 p-4">
              <span className="grid h-8 w-8 place-items-center rounded-lg bg-white text-brand-700 shadow-xs">
                <MessageSquare className="h-4 w-4" />
              </span>
              <p className="mt-3 text-sm font-semibold text-ink-900">{t.aside.helpTitle}</p>
              <p className="mt-1 text-[11px] leading-relaxed text-ink-600">
                {t.aside.helpBody}
              </p>
              <Link href="/contact" className="mt-3 inline-flex items-center gap-1 text-[11px] font-semibold text-brand-700 hover:text-brand-800">
                {t.aside.helpCta}
                <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
          </div>
        </aside>

        <div className="min-w-0 space-y-14">
          {/* 01 — Buyer order refund */}
          <section id="order-refund" className="scroll-mt-24">
            <SectionHeading
              index={t.orderRefund.index}
              title={t.orderRefund.title}
              description={t.orderRefund.description}
            />

            <div className="mt-5 grid gap-4 lg:grid-cols-[1.12fr_0.88fr]">
              <div className="space-y-4 rounded-2xl border border-ink-200 bg-white p-5 shadow-xs sm:p-6">
                <p className="text-sm leading-relaxed text-ink-600">
                  {t.orderRefund.bodyLead}{" "}
                  <span className="font-semibold text-ink-800">{t.orderRefund.bodyStatus}</span>
                  {t.orderRefund.bodyEnd}
                </p>
                <p className="text-sm leading-relaxed text-ink-600">
                  {t.orderRefund.bodyApproval}
                </p>
                <p className="text-sm leading-relaxed text-ink-600">
                  {t.orderRefund.bodyDamaged}
                </p>
              </div>

              <div className="rounded-2xl border border-brand-200 bg-brand-50/60 p-5 sm:p-6">
                <span className="grid h-9 w-9 place-items-center rounded-xl bg-white text-brand-700 shadow-xs">
                  <Clock className="h-4 w-4" />
                </span>
                <p className="mt-3 text-sm font-semibold text-ink-900">{t.orderRefund.windowTitle}</p>
                <p className="mt-1.5 text-xs leading-relaxed text-ink-600">
                  {t.orderRefund.windowBody}
                </p>
                <div className="mt-4 rounded-xl border border-brand-100 bg-white/80 p-3">
                  <p className="text-[10px] font-semibold tracking-wide text-brand-700 uppercase">{t.orderRefund.needTitle}</p>
                  <ul className="mt-1.5 space-y-1 text-[11px] text-ink-600">
                    <li>• {t.orderRefund.needs[0]}</li>
                    <li>• {t.orderRefund.needs[1]}</li>
                    <li>• {t.orderRefund.needs[2]}</li>
                  </ul>
                </div>
              </div>
            </div>
          </section>

          {/* 02 — Process */}
          <section id="process" className="scroll-mt-24">
            <SectionHeading
              index={t.process.index}
              title={t.process.title}
              description={t.process.description}
            />

            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              {t.process.steps.map((step, index) => {
                const Icon = STEP_ICONS[index];
                return (
                  <div
                    key={step.title}
                    className="group relative overflow-hidden rounded-2xl border border-ink-200 bg-white p-5 shadow-xs transition duration-300 hover:-translate-y-0.5 hover:border-brand-200 hover:shadow-md"
                  >
                    <span className="absolute -right-2 -top-3 font-mono text-5xl font-bold text-ink-50 transition group-hover:text-brand-50">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <span className="relative grid h-9 w-9 place-items-center rounded-xl bg-brand-50 text-brand-700 transition group-hover:bg-brand-600 group-hover:text-white">
                      <Icon className="h-4 w-4" />
                    </span>
                    <h3 className="relative mt-3 text-sm font-semibold text-ink-900">{step.title}</h3>
                    <p className="relative mt-1.5 text-[13px] leading-relaxed text-ink-600">{step.body}</p>
                  </div>
                );
              })}
            </div>
          </section>

          {/* 03 — Platform fee */}
          <section id="platform-fee" className="scroll-mt-24">
            <SectionHeading
              index={t.platformFee.index}
              title={t.platformFee.title}
              description={t.platformFee.description}
            />

            <div className="mt-5 overflow-hidden rounded-2xl border border-ink-200 bg-white shadow-xs">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[620px] text-left text-sm">
                  <thead>
                    <tr className="border-b border-ink-100 bg-ink-50/70 text-[10px] font-semibold tracking-[0.12em] text-ink-500 uppercase">
                      <th className="px-5 py-3">{t.platformFee.columns.situation}</th>
                      <th className="px-5 py-3">{t.platformFee.columns.fee}</th>
                      <th className="px-5 py-3">{t.platformFee.columns.quota}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-ink-100">
                    {t.platformFee.rows.map((row) => (
                      <tr key={row.case} className="align-top transition hover:bg-ink-50/40">
                        <td className="px-5 py-4 text-[13px] font-semibold text-ink-800">{row.case}</td>
                        <td className="px-5 py-4">
                          <span className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-medium ${TONE[row.tone]}`}>
                            {row.fee}
                          </span>
                        </td>
                        <td className="px-5 py-4 text-[13px] text-ink-600">{row.quota}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="mt-4 flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50/70 p-4">
              <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-white text-amber-700 shadow-xs">
                <CreditCard className="h-3.5 w-3.5" />
              </span>
              <p className="text-xs leading-relaxed text-amber-900/80">
                {t.platformFee.note}
              </p>
            </div>
          </section>

          {/* 04 — Subscription cancel */}
          <section id="subscription" className="scroll-mt-24">
            <SectionHeading
              index={t.subscription.index}
              title={t.subscription.title}
              description={t.subscription.description}
            />

            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border border-brand-200 bg-brand-50/55 p-5">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-white px-2.5 py-1 text-[10px] font-semibold text-brand-700 shadow-xs">
                  <BadgeCheck className="h-3 w-3" />
                  {t.subscription.atPeriodEnd.badge}
                </span>
                <h3 className="mt-3 text-sm font-semibold text-ink-900">{t.subscription.atPeriodEnd.title}</h3>
                <p className="mt-1.5 text-[13px] leading-relaxed text-ink-600">
                  {t.subscription.atPeriodEnd.body}
                </p>
                <ul className="mt-3 space-y-1.5 text-xs text-ink-600">
                  <li>• {t.subscription.atPeriodEnd.points[0]}</li>
                  <li>• {t.subscription.atPeriodEnd.points[1]}</li>
                  <li>• {t.subscription.atPeriodEnd.points[2]}</li>
                </ul>
              </div>

              <div className="rounded-2xl border border-ink-200 bg-white p-5">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-ink-50 px-2.5 py-1 text-[10px] font-semibold text-ink-600">
                  <Timer className="h-3 w-3" />
                  {t.subscription.immediate.badge}
                </span>
                <h3 className="mt-3 text-sm font-semibold text-ink-900">{t.subscription.immediate.title}</h3>
                <p className="mt-1.5 text-[13px] leading-relaxed text-ink-600">
                  {t.subscription.immediate.body}
                </p>
                <ul className="mt-3 space-y-1.5 text-xs text-ink-600">
                  <li>• {t.subscription.immediate.points[0]}</li>
                  <li>• {t.subscription.immediate.points[1]}</li>
                  <li>• {t.subscription.immediate.points[2]}</li>
                </ul>
              </div>
            </div>

            <div className="mt-4 flex items-start gap-3 rounded-2xl border border-ink-200 bg-ink-50/60 p-4">
              <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-white text-brand-700 shadow-xs">
                <Sparkles className="h-3.5 w-3.5" />
              </span>
              <p className="text-xs leading-relaxed text-ink-600">
                {t.subscription.trialNote}
              </p>
            </div>
          </section>

          {/* 05 — Subscription refund */}
          <section id="subscription-refund" className="scroll-mt-24">
            <SectionHeading
              index={t.subscriptionRefund.index}
              title={t.subscriptionRefund.title}
              description={t.subscriptionRefund.description}
            />

            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              {t.subscriptionRefund.rules.map((rule, index) => {
                const Icon = REFUND_RULE_ICONS[index];
                return (
                  <div key={rule.title} className="rounded-2xl border border-ink-200 bg-white p-4 shadow-xs">
                    <div className="flex items-center gap-2">
                      <span className="grid h-7 w-7 place-items-center rounded-lg bg-brand-50 text-brand-700">
                        <Icon className="h-3.5 w-3.5" />
                      </span>
                      <h3 className="text-xs font-semibold text-ink-900">{rule.title}</h3>
                    </div>
                    <p className="mt-2 text-xs leading-relaxed text-ink-600">{rule.body}</p>
                  </div>
                );
              })}
            </div>

            <div className="mt-4 flex flex-col gap-3 rounded-2xl border border-brand-200 bg-brand-50/55 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-3">
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-white text-brand-700 shadow-xs">
                  <CalendarDays className="h-4 w-4" />
                </span>
                <div>
                  <p className="text-xs font-semibold text-ink-900">{t.subscriptionRefund.windowTitle}</p>
                  <p className="mt-0.5 text-[11px] text-ink-600">{t.subscriptionRefund.windowBody}</p>
                </div>
              </div>
              <ButtonLink href="/contact" variant="outline" size="sm" className="shrink-0">
                {t.subscriptionRefund.cta}
                <ArrowUpRight className="h-3.5 w-3.5" />
              </ButtonLink>
            </div>
          </section>

          {/* 06 — How to request */}
          <section id="request" className="scroll-mt-24">
            <SectionHeading
              index={t.request.index}
              title={t.request.title}
              description={t.request.description}
            />

            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border border-ink-200 bg-white p-5">
                <div className="flex items-center gap-2">
                  <span className="grid h-8 w-8 place-items-center rounded-lg bg-brand-50 text-brand-700">
                    <Package className="h-4 w-4" />
                  </span>
                  <h3 className="text-sm font-semibold text-ink-900">{t.request.buyer.title}</h3>
                </div>
                <ol className="mt-3 space-y-2 text-[13px] leading-relaxed text-ink-600">
                  <li className="flex gap-2"><span className="font-mono text-[10px] text-brand-600">01</span> {t.request.buyer.steps[0]}</li>
                  <li className="flex gap-2"><span className="font-mono text-[10px] text-brand-600">02</span> {t.request.buyer.steps[1]}</li>
                  <li className="flex gap-2"><span className="font-mono text-[10px] text-brand-600">03</span> {t.request.buyer.steps[2]}</li>
                </ol>
              </div>

              <div className="rounded-2xl border border-ink-200 bg-white p-5">
                <div className="flex items-center gap-2">
                  <span className="grid h-8 w-8 place-items-center rounded-lg bg-brand-50 text-brand-700">
                    <Store className="h-4 w-4" />
                  </span>
                  <h3 className="text-sm font-semibold text-ink-900">{t.request.merchant.title}</h3>
                </div>
                <ol className="mt-3 space-y-2 text-[13px] leading-relaxed text-ink-600">
                  <li className="flex gap-2"><span className="font-mono text-[10px] text-brand-600">01</span> {t.request.merchant.steps[0]}</li>
                  <li className="flex gap-2"><span className="font-mono text-[10px] text-brand-600">02</span> {t.request.merchant.steps[1]}</li>
                  <li className="flex gap-2"><span className="font-mono text-[10px] text-brand-600">03</span> {t.request.merchant.steps[2]}</li>
                </ol>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-3 rounded-2xl border border-ink-200 bg-ink-50/60 p-4">
              <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-ink-600">
                <FileText className="h-3.5 w-3.5 text-brand-600" />
                {t.request.auditNote}
              </span>
              <span className="hidden h-3 w-px bg-ink-200 sm:block" />
              <ButtonLink href="/help" variant="ghost" size="sm" className="ml-auto">
                {t.request.helpCta}
                <ArrowRight className="h-3.5 w-3.5" />
              </ButtonLink>
            </div>
          </section>

          {/* 07 — Dispute + FAQ */}
          <section id="dispute" className="scroll-mt-24">
            <SectionHeading
              index={t.dispute.index}
              title={t.dispute.title}
              description={t.dispute.description}
            />

            <div className="mt-5 grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
              <div className="space-y-3">
                {t.dispute.cards.map((item, index) => {
                  const Icon = DISPUTE_ICONS[index];
                  return (
                    <div key={item.title} className="flex gap-3 rounded-2xl border border-ink-200 bg-white p-4">
                      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-brand-50 text-brand-700">
                        <Icon className="h-4 w-4" />
                      </span>
                      <div>
                        <p className="text-xs font-semibold text-ink-900">{item.title}</p>
                        <p className="mt-1 text-[11px] leading-relaxed text-ink-600">{item.body}</p>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="rounded-2xl border border-ink-200 bg-white p-4 shadow-xs sm:p-5">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-sm font-semibold text-ink-900">{t.dispute.faqTitle}</h3>
                  <span className="rounded-full bg-ink-50 px-2 py-0.5 text-[10px] font-medium text-ink-500">{faqCount}</span>
                </div>
                <div className="mt-3 divide-y divide-ink-100">
                  {t.dispute.faqs.map((faq) => (
                    <details key={faq.q} className="group py-3">
                      <summary className="flex cursor-pointer list-none items-start justify-between gap-3 text-[13px] font-medium text-ink-800 [&::-webkit-details-marker]:hidden">
                        {faq.q}
                        <ChevronDown className="mt-0.5 h-3.5 w-3.5 shrink-0 text-ink-400 transition group-open:rotate-180" />
                      </summary>
                      <p className="mt-2 pr-5 text-xs leading-relaxed text-ink-600">{faq.a}</p>
                    </details>
                  ))}
                </div>
              </div>
            </div>

            <div className="mt-5 rounded-2xl border border-ink-200 bg-ink-50/60 p-5">
              <p className="text-[10px] font-semibold tracking-[0.16em] text-ink-500 uppercase">{t.closing.eyebrow}</p>
              <p className="mt-1.5 text-xs leading-relaxed text-ink-600">
                {t.closing.body}
              </p>
            </div>
          </section>
        </div>
      </div>

      {/* Support CTA */}
      <section className="relative overflow-hidden border-t border-brand-800/20 bg-ink-900 py-14 text-white">
        <div aria-hidden="true" className="pointer-events-none absolute inset-0">
          <div className="absolute -top-24 left-1/4 h-72 w-72 rounded-full bg-brand-500/20 blur-3xl" />
          <div className="absolute -bottom-32 right-0 h-80 w-80 rounded-full bg-accent-400/10 blur-3xl" />
          <div className="absolute inset-0 bg-[radial-gradient(rgba(255,255,255,0.12)_1px,transparent_1px)] [background-size:24px_24px] opacity-30 [mask-image:radial-gradient(ellipse_at_center,black,transparent_75%)]" />
        </div>

        <div className="relative mx-auto grid max-w-6xl gap-6 px-4 sm:grid-cols-[1fr_auto] sm:items-center">
          <div>
            <p className="text-[10px] font-semibold tracking-[0.2em] text-brand-200 uppercase">{t.support.eyebrow}</p>
            <h2 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">{t.support.title}</h2>
            <p className="mt-2 max-w-xl text-sm leading-relaxed text-white/70">
              {t.support.body}
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <ButtonLink href="/contact" variant="inverse" size="lg">
              {t.support.primary}
              <ArrowRight className="h-4 w-4" />
            </ButtonLink>
            <ButtonLink href="/help" variant="inverse-outline" size="lg">
              {t.support.secondary}
            </ButtonLink>
          </div>
        </div>
      </section>
    </div>
  );
}
