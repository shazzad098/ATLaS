/** Refund & Cancellation Policy page (PRD §4.1, §13). */

export const metadata = {
  title: "রিফান্ড ও বাতিল নীতি — ATLaS",
  description: "ATLaS subscription রিফান্ড, store cancellation ও order refund নীতি। Merchant ও Customer উভয়ের জন্য।",
};

const EFFECTIVE_DATE = "১ নভেম্বর ২০২৬";

export default function RefundPolicyPage() {
  return (
    <div className="bg-white">
      <div className="mx-auto max-w-[860px] px-4 py-14 sm:px-6 sm:py-16">
        <div className="mb-8 border-b border-[#e8eeeb] pb-6">
          <h1 className="text-3xl font-bold text-ink-900">রিফান্ড ও বাতিল নীতি</h1>
          <p className="mt-2 text-[13.5px] text-ink-500">
            কার্যকর তারিখ: {EFFECTIVE_DATE} · ATLaS Platform (atlas.example)
          </p>
        </div>

        <div className="space-y-8 text-ink-700">
          {/* Subscription Refund */}
          <section>
            <h2 className="text-lg font-bold text-ink-900">১. ATLaS Subscription রিফান্ড</h2>

            <h3 className="mt-4 text-[14px] font-semibold text-ink-800">ফ্রি ট্রায়াল</h3>
            <ul className="mt-2 space-y-1.5 text-[13.5px] leading-6">
              <li>৭ দিনের free trial — কোনো card বা payment দরকার নেই।</li>
              <li>Trial শেষে paid plan না নিলে automatically Free plan-এ যাবেন।</li>
              <li>Trial period-এ কোনো charge নেই।</li>
            </ul>

            <h3 className="mt-4 text-[14px] font-semibold text-ink-800">Subscription Cancellation</h3>
            <ul className="mt-2 space-y-1.5 text-[13.5px] leading-6">
              <li>যেকোনো সময় subscription cancel করা যাবে Billing পেজ থেকে।</li>
              <li>Cancel করলে current billing period শেষ পর্যন্ত service ব্যবহার করা যাবে।</li>
              <li>Period শেষে account Free plan-এ যাবে; data delete হবে না।</li>
            </ul>

            <h3 className="mt-4 text-[14px] font-semibold text-ink-800">Subscription Refund নীতি</h3>
            <div className="mt-3 rounded-xl border border-[#e8eeeb] bg-[#f7faf9] p-4">
              <p className="text-[13.5px] leading-6 text-ink-600">
                ATLaS subscription একটি SaaS service। সাধারণত <strong>subscription fee refundable নয়</strong>।
                তবে নিম্নলিখিত ক্ষেত্রে refund বিবেচনা করা হবে:
              </p>
              <ul className="mt-3 space-y-2 text-[13.5px] leading-6">
                <li>
                  <strong>Double charge:</strong> একই billing period-এ দুইবার charge হলে অতিরিক্ত
                  amount refund করা হবে।
                </li>
                <li>
                  <strong>Technical failure:</strong> ATLaS platform-এর কারণে service সম্পূর্ণ
                  unavailable থাকলে (৪৮+ ঘণ্টা, force majeure বাদে) pro-rata refund বিবেচনা করা হবে।
                </li>
                <li>
                  <strong>Billing error:</strong> Merchant-এর billing তথ্যে error থেকে wrong charge হলে।
                </li>
              </ul>
              <p className="mt-3 text-[13px] text-ink-500">
                Refund request-এর জন্য{" "}
                <a href="/contact" className="text-[#0B7A5B] hover:underline">
                  Contact পেজ
                </a>{" "}
                বা admin panel-এর Support থেকে টিকেট খুলুন। Request-এর ৭ কার্যদিবসের মধ্যে সিদ্ধান্ত
                জানানো হবে।
              </p>
            </div>

            <h3 className="mt-4 text-[14px] font-semibold text-ink-800">Plan Downgrade</h3>
            <ul className="mt-2 space-y-1.5 text-[13.5px] leading-6">
              <li>Downgrade current period শেষে effective হবে।</li>
              <li>Downgrade-এ existing data (product, order) delete হয় না।</li>
              <li>Quota exceed করলে নতুন create block হবে; upgrade prompt দেখাবে।</li>
            </ul>
          </section>

          {/* Platform Fee */}
          <section>
            <h2 className="text-lg font-bold text-ink-900">২. Platform Fee ও Overage</h2>
            <ul className="mt-3 space-y-2 text-[13.5px] leading-6">
              <li>
                <strong>"Per sale" fee</strong> = paid বা merchant-confirmed COD order (first time)।
                Cancelled বা fully refunded order-এ fee void হয়।
              </li>
              <li>
                <strong>Fee base:</strong> discount-adjusted merchandise subtotal — delivery fee ও
                refunded items বাদে।
              </li>
              <li>
                <strong>Partial return:</strong> Partial refund-এ line-level fee reverse হয়।
              </li>
              <li>
                <strong>COD:</strong> Merchant-confirmed COD order fee-eligible। Courier delivery ≠
                settled; settlement policy অনুযায়ী।
              </li>
              <li>
                Fee ledger transparent: প্রতিটি invoice-এ order reference ও fee rate দেখানো হয়।
                Immutable record।
              </li>
              <li>
                <strong>Third-party courier fee (০.৫%):</strong> Gateway fee থেকে আলাদা line item।
                Double-count হয় না।
              </li>
            </ul>
          </section>

          {/* Customer Order Refund */}
          <section>
            <h2 className="text-lg font-bold text-ink-900">৩. Customer Order Refund (Merchant-এর Store)</h2>
            <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-4">
              <p className="text-[13.5px] leading-6 text-amber-800">
                <strong>গুরুত্বপূর্ণ:</strong> Customer-Merchant লেনদেনের refund Merchant-এর নিজস্ব
                store policy অনুযায়ী। ATLaS এই refund-এর জন্য সরাসরি দায়বদ্ধ নয়।
              </p>
            </div>
            <p className="mt-4 text-[13.5px] leading-6">
              ATLaS platform Merchant-কে নিম্নলিখিত tools দেয়:
            </p>
            <ul className="mt-3 space-y-2 text-[13.5px] leading-6">
              <li>Order refund request system — admin panel থেকে।</li>
              <li>Return ও exchange management।</li>
              <li>Payment gateway refund initiation (gateway-এর refund SLA অনুযায়ী)।</li>
              <li>Refund status tracking ও notification।</li>
            </ul>
            <p className="mt-3 text-[13.5px] leading-6">
              Customer হিসেবে refund চাইতে সংশ্লিষ্ট Merchant-এর store-এর contact/policy page দেখুন
              বা সরাসরি Merchant-এর সাথে যোগাযোগ করুন।
            </p>
          </section>

          {/* Payment Gateway */}
          <section>
            <h2 className="text-lg font-bold text-ink-900">৪. Payment Gateway Refund</h2>
            <ul className="mt-3 space-y-2 text-[13.5px] leading-6">
              <li>
                বিকাশ, নগদ, SSLCommerz refund তাদের নিজস্ব policy ও timeline অনুযায়ী। ATLaS এই
                timeline নিয়ন্ত্রণ করে না।
              </li>
              <li>
                Online payment refund সাধারণত ৩–১৪ কার্যদিবসে process হয় (gateway-এর উপর নির্ভর)।
              </li>
              <li>COD payment ইতিমধ্যে cash-এ পাওয়া গেলে courier COD policy অনুযায়ী refund।</li>
            </ul>
          </section>

          {/* Contact */}
          <section>
            <h2 className="text-lg font-bold text-ink-900">৫. Refund Request প্রক্রিয়া</h2>
            <ol className="mt-3 space-y-2 text-[13.5px] leading-6 list-decimal list-inside">
              <li>
                Admin panel-এ লগইন করুন → Support পেজ → নতুন টিকেট খুলুন।
              </li>
              <li>Subject-এ "Refund Request" লিখুন; billing period, invoice number ও কারণ উল্লেখ করুন।</li>
              <li>৭ কার্যদিবসের মধ্যে আমাদের Finance টিম সাড়া দেবে।</li>
              <li>Approved হলে original payment method-এ refund process হবে।</li>
            </ol>
            <p className="mt-4 text-[13.5px] leading-6">
              সরাসরি যোগাযোগ:{" "}
              <a href="/contact" className="text-[#0B7A5B] hover:underline">
                Contact পেজ
              </a>{" "}
              বা billing@atlas.example
            </p>
          </section>
        </div>

        <div className="mt-10 flex flex-wrap gap-4 border-t border-[#e8eeeb] pt-8 text-[12.5px] text-ink-500">
          <a href="/terms" className="hover:text-[#0B7A5B] hover:underline">ব্যবহারের শর্তাবলী</a>
          <a href="/privacy" className="hover:text-[#0B7A5B] hover:underline">প্রাইভেসি পলিসি</a>
          <a href="/contact" className="hover:text-[#0B7A5B] hover:underline">যোগাযোগ</a>
        </div>
      </div>
    </div>
  );
}
