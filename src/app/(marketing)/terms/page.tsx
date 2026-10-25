/** Terms of Service page (PRD §4.1, §13). */

export const metadata = {
  title: "ব্যবহারের শর্তাবলী — ATLaS",
  description: "ATLaS SaaS platform ব্যবহারের শর্তাবলী। Merchant, customer ও platform-এর মধ্যে চুক্তির শর্ত।",
};

const EFFECTIVE_DATE = "১ নভেম্বর ২০২৬";

export default function TermsPage() {
  return (
    <div className="bg-white">
      <div className="mx-auto max-w-[860px] px-4 py-14 sm:px-6 sm:py-16">
        <div className="mb-8 border-b border-[#e8eeeb] pb-6">
          <h1 className="text-3xl font-bold text-ink-900">ব্যবহারের শর্তাবলী</h1>
          <p className="mt-2 text-[13.5px] text-ink-500">
            কার্যকর তারিখ: {EFFECTIVE_DATE} · ATLaS Platform (atlas.example)
          </p>
        </div>

        <div className="prose prose-sm max-w-none space-y-8 text-ink-700">
          <section>
            <h2 className="text-lg font-bold text-ink-900">১. সংজ্ঞা ও পরিচিতি</h2>
            <p className="mt-3 text-[14px] leading-7">
              এই শর্তাবলী ("শর্ত") ATLaS ("প্ল্যাটফর্ম", "আমরা") এবং আপনার ("Merchant", "User",
              "আপনি") মধ্যে প্রযোজ্য। ATLaS একটি multi-tenant SaaS e-commerce platform যা
              Bangladesh-এর ক্ষুদ্র ও মাঝারি ব্যবসার জন্য online store তৈরি, পরিচালনা ও
              payment/delivery integration প্রদান করে।
            </p>
            <ul className="mt-3 space-y-1.5 text-[13.5px]">
              <li><strong>Merchant:</strong> যে ব্যক্তি বা প্রতিষ্ঠান ATLaS-এ store তৈরি করে পণ্য বিক্রি করেন।</li>
              <li><strong>Customer/Shopper:</strong> যে ব্যক্তি Merchant-এর storefront থেকে কেনাকাটা করেন।</li>
              <li><strong>Platform:</strong> ATLaS SaaS service, API, dashboard ও storefront।</li>
              <li><strong>Content:</strong> Merchant-এর product, image, text ও অন্যান্য data।</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-bold text-ink-900">২. Account ও Registration</h2>
            <ul className="mt-3 space-y-2 text-[13.5px] leading-6">
              <li>Account তৈরিতে সঠিক ও আপডেট তথ্য দিতে হবে।</li>
              <li>Bangladesh mobile number OTP দিয়ে verify করতে হবে।</li>
              <li>Account-এর নিরাপত্তার দায়িত্ব আপনার। Password share করবেন না।</li>
              <li>একটি account থেকে একাধিক store পরিচালনা করা যাবে।</li>
              <li>আপনার বয়স কমপক্ষে ১৮ বছর হতে হবে বা অভিভাবকের সম্মতি থাকতে হবে।</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-bold text-ink-900">৩. Subscription ও বিলিং</h2>
            <ul className="mt-3 space-y-2 text-[13.5px] leading-6">
              <li>
                <strong>Free Plan:</strong> ২৫ product, ১০০MB storage। প্রথম ৫০ completed sale
                fee-free; এরপর প্রতি sale-এ ২.৫% platform fee।
              </li>
              <li>
                <strong>Paid Plan:</strong> Monthly বা yearly billing। ৭ দিনের free trial, কার্ড
                ছাড়াই।
              </li>
              <li>
                Payment failure-এ ৭ দিনের grace period। Grace period-এর পরে store read-only ও
                পরবর্তীতে suspend হতে পারে।
              </li>
              <li>
                <strong>Fee Semantics:</strong> "Per sale" = paid বা merchant-confirmed COD order।
                Cancelled/fully refunded order-এ fee void। Fee base = discount-adjusted merchandise
                subtotal, delivery ও refunded items বাদে।
              </li>
              <li>
                Third-party courier ব্যবহারে additional ০.৫% fee প্রযোজ্য — gateway fee থেকে
                আলাদা।
              </li>
              <li>
                Payment gateway (বিকাশ/নগদ/SSLCommerz) fees ATLaS platform fee থেকে আলাদা।
              </li>
              <li>Downgrade-এ existing data delete হয় না; quota exceed করলে নতুন create block হয়।</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-bold text-ink-900">৪. Merchant দায়িত্ব ও নিষিদ্ধ কার্যক্রম</h2>
            <p className="mt-3 text-[13.5px] leading-6">
              Merchant নিম্নলিখিত বিষয়ে সম্পূর্ণ দায়বদ্ধ:
            </p>
            <ul className="mt-3 space-y-2 text-[13.5px] leading-6">
              <li>পণ্যের description, price ও quality-র সঠিকতা।</li>
              <li>Bangladesh-এর আইন অনুযায়ী ব্যবসা পরিচালনা।</li>
              <li>Payment gateway-এর terms ও conditions মেনে চলা।</li>
              <li>Customer data সুরক্ষা ও ব্যক্তিগত উপাত্ত সুরক্ষা অধ্যাদেশ ২০২৫ মেনে চলা।</li>
              <li>Tax/VAT সংক্রান্ত নিয়মকানুন মেনে চলা।</li>
            </ul>
            <p className="mt-3 text-[13.5px] font-semibold leading-6">নিষিদ্ধ:</p>
            <ul className="mt-2 space-y-2 text-[13.5px] leading-6">
              <li>অবৈধ পণ্য বা সেবা বিক্রি।</li>
              <li>ভুয়া review বা testimonial।</li>
              <li>Platform-এর abuse বা DoS attack।</li>
              <li>অন্য merchant-এর data access করার চেষ্টা।</li>
              <li>Payment system-এর fraud বা manipulation।</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-bold text-ink-900">৫. Data ও Privacy</h2>
            <ul className="mt-3 space-y-2 text-[13.5px] leading-6">
              <li>ATLaS কোনো card data store করে না।</li>
              <li>Gateway secret AES-256-GCM encryption-এ store হয়।</li>
              <li>Tenant isolation: প্রতিটি store একটি logical boundary — অন্য store-এর data accessible নয়।</li>
              <li>Data export: যেকোনো সময় আপনার data CSV/export করতে পারবেন।</li>
              <li>Deletion: account deletion request করলে retention policy অনুযায়ী data মুছে ফেলা হবে।</li>
              <li>Financial records (fee ledger, invoice) immutable — মুছে ফেলা হয় না।</li>
              <li>বিস্তারিতের জন্য আমাদের <a href="/privacy" className="text-[#0B7A5B] hover:underline">Privacy Policy</a> দেখুন।</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-bold text-ink-900">৬. Platform Availability ও SLA</h2>
            <ul className="mt-3 space-y-2 text-[13.5px] leading-6">
              <li>MVP target: ৯৯.৫% monthly uptime।</li>
              <li>Planned maintenance-এ আগাম notification দেওয়া হবে।</li>
              <li>Subscription expiry warning: renewal-এর ৭, ৩, ১ দিন আগে।</li>
              <li>Suspension-এ storefront maintenance page দেখাবে; data retain থাকবে।</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-bold text-ink-900">৭. Intellectual Property</h2>
            <ul className="mt-3 space-y-2 text-[13.5px] leading-6">
              <li>ATLaS platform, theme ও code-এর intellectual property ATLaS-এর।</li>
              <li>Merchant-এর product content, images ও data Merchant-এর।</li>
              <li>ATLaS-কে platform operation-এর জন্য content ব্যবহারের license দেওয়া হলো।</li>
              <li>Marketing উদ্দেশ্যে Merchant-এর brand উল্লেখ করতে ATLaS-কে অনুমতি দেওয়া হলো (opt-out করা যাবে)।</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-bold text-ink-900">৮. Suspension ও Termination</h2>
            <ul className="mt-3 space-y-2 text-[13.5px] leading-6">
              <li>ATLaS যেকোনো সময় notice দিয়ে account suspend বা terminate করতে পারে।</li>
              <li>Platform abuse, fraud, আইন লঙ্ঘনে immediate suspension সম্ভব।</li>
              <li>Merchant যেকোনো সময় account বন্ধ করতে পারবেন; pending order ও financial obligation থাকলে সেটা settle করতে হবে।</li>
              <li>Termination-এর পরে data retention policy অনুযায়ী data রাখা হবে।</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-bold text-ink-900">৯. দায়বদ্ধতার সীমা</h2>
            <p className="mt-3 text-[13.5px] leading-6">
              ATLaS platform একটি technology service। Merchant-Customer লেনদেন, পণ্যের quality,
              delivery বা COD collection-এর জন্য ATLaS সরাসরি দায়বদ্ধ নয়। Payment gateway বা
              courier-এর failure-এর জন্য ATLaS দায়বদ্ধ নয়। আমাদের maximum liability আপনার শেষ
              ৩ মাসের subscription fee-এর মধ্যে সীমিত।
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-ink-900">১০. পরিবর্তন ও আপডেট</h2>
            <p className="mt-3 text-[13.5px] leading-6">
              ATLaS এই শর্তাবলী পরিবর্তন করতে পারে। উল্লেখযোগ্য পরিবর্তনে ই-মেইল বা in-app
              notification দেওয়া হবে। পরিবর্তনের পরে platform ব্যবহার অব্যাহত রাখলে নতুন শর্ত
              গ্রহণ করা হয়েছে বলে ধরা হবে।
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-ink-900">১১. প্রযোজ্য আইন</h2>
            <p className="mt-3 text-[13.5px] leading-6">
              এই শর্তাবলী Bangladesh-এর আইন অনুযায়ী পরিচালিত হবে। যেকোনো বিরোধ Dhaka-র আদালতে
              নিষ্পত্তি হবে। এই শর্তাবলী legal advice নয়; Bangladesh-এর digital commerce,
              consumer protection, tax/VAT ও payment provider terms সম্পর্কে local legal/compliance
              review করার পরামর্শ দেওয়া হচ্ছে।
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-ink-900">১২. যোগাযোগ</h2>
            <p className="mt-3 text-[13.5px] leading-6">
              শর্তাবলী সংক্রান্ত যেকোনো প্রশ্নে আমাদের{" "}
              <a href="/contact" className="text-[#0B7A5B] hover:underline">
                Contact পেজ
              </a>{" "}
              বা{" "}
              <a href="/help" className="text-[#0B7A5B] hover:underline">
                Help Center
              </a>{" "}
              ব্যবহার করুন।
            </p>
          </section>
        </div>

        <div className="mt-10 flex flex-wrap gap-4 border-t border-[#e8eeeb] pt-8 text-[12.5px] text-ink-500">
          <a href="/privacy" className="hover:text-[#0B7A5B] hover:underline">প্রাইভেসি পলিসি</a>
          <a href="/refund-policy" className="hover:text-[#0B7A5B] hover:underline">রিফান্ড পলিসি</a>
          <a href="/contact" className="hover:text-[#0B7A5B] hover:underline">যোগাযোগ</a>
        </div>
      </div>
    </div>
  );
}
