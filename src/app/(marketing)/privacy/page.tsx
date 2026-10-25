/** Privacy Policy page (PRD §4.1, §13). */

export const metadata = {
  title: "প্রাইভেসি পলিসি — ATLaS",
  description: "ATLaS-এ আপনার ডেটা কীভাবে সংগ্রহ, ব্যবহার ও সুরক্ষিত রাখা হয়। ব্যক্তিগত উপাত্ত সুরক্ষা অধ্যাদেশ ২০২৫ অনুযায়ী।",
};

const EFFECTIVE_DATE = "১ নভেম্বর ২০২৬";

export default function PrivacyPage() {
  return (
    <div className="bg-white">
      <div className="mx-auto max-w-[860px] px-4 py-14 sm:px-6 sm:py-16">
        <div className="mb-8 border-b border-[#e8eeeb] pb-6">
          <h1 className="text-3xl font-bold text-ink-900">প্রাইভেসি পলিসি</h1>
          <p className="mt-2 text-[13.5px] text-ink-500">
            কার্যকর তারিখ: {EFFECTIVE_DATE} · ATLaS Platform (atlas.example)
          </p>
          <p className="mt-3 text-[13.5px] leading-6 text-ink-600">
            ATLaS আপনার গোপনীয়তাকে সম্মান করে। এই নীতিতে আমরা ব্যাখ্যা করি কোন তথ্য সংগ্রহ করা হয়,
            কেন করা হয় এবং কীভাবে সুরক্ষিত রাখা হয়। বাংলাদেশের ব্যক্তিগত উপাত্ত সুরক্ষা অধ্যাদেশ ২০২৫
            অনুযায়ী।
          </p>
        </div>

        <div className="space-y-8 text-ink-700">
          <section>
            <h2 className="text-lg font-bold text-ink-900">১. আমরা কোন তথ্য সংগ্রহ করি</h2>

            <h3 className="mt-4 text-[14px] font-semibold text-ink-800">Merchant Account তথ্য</h3>
            <ul className="mt-2 space-y-1.5 text-[13.5px] leading-6">
              <li>নাম, ফোন নম্বর, ইমেইল ঠিকানা</li>
              <li>Business name, category, address ও contact number</li>
              <li>Password (Argon2id/bcrypt hash — কখনো plaintext নয়)</li>
              <li>OTP verification log (rate limit ও security-র জন্য)</li>
              <li>Login events, IP address ও user agent</li>
              <li>Session token (hashed)</li>
            </ul>

            <h3 className="mt-4 text-[14px] font-semibold text-ink-800">Store ও Business তথ্য</h3>
            <ul className="mt-2 space-y-1.5 text-[13.5px] leading-6">
              <li>Store name, slug, description, logo</li>
              <li>Product, variant, price ও inventory data</li>
              <li>Order, payment ও refund records</li>
              <li>Customer তথ্য (Merchant-এর store-র কাস্টমার)</li>
              <li>Delivery zone ও courier configuration</li>
              <li>Theme settings ও customization</li>
            </ul>

            <h3 className="mt-4 text-[14px] font-semibold text-ink-800">Payment তথ্য</h3>
            <ul className="mt-2 space-y-1.5 text-[13.5px] leading-6">
              <li>Payment gateway credentials (AES-256-GCM encrypted — database-এ raw secret নয়)</li>
              <li>Payment transaction reference (provider transaction ID)</li>
              <li>Payment status, amount ও fee records</li>
              <li><strong>Card data ATLaS store করে না।</strong></li>
            </ul>

            <h3 className="mt-4 text-[14px] font-semibold text-ink-800">Technical তথ্য</h3>
            <ul className="mt-2 space-y-1.5 text-[13.5px] leading-6">
              <li>Platform usage metrics ও analytics events</li>
              <li>API request logs ও error reports</li>
              <li>Webhook delivery records</li>
              <li>Audit logs (immutable, financial records-এর মতো)</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-bold text-ink-900">২. তথ্য কীভাবে ব্যবহার করা হয়</h2>
            <ul className="mt-3 space-y-2 text-[13.5px] leading-6">
              <li>Platform service provide করতে — store, order, payment ও delivery management।</li>
              <li>Account authentication ও security verify করতে।</li>
              <li>Subscription billing ও invoice তৈরি করতে।</li>
              <li>Order notification ও alerts পাঠাতে (SMS/email/WhatsApp-ready)।</li>
              <li>Product improvement ও bug fix করতে (anonymized/aggregated)।</li>
              <li>Legal obligation পূরণ করতে (tax, audit, compliance)।</li>
              <li>Fraud detection ও platform abuse প্রতিরোধ করতে।</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-bold text-ink-900">৩. Data Sharing ও Third Parties</h2>
            <ul className="mt-3 space-y-2 text-[13.5px] leading-6">
              <li>
                <strong>Payment Providers:</strong> বিকাশ, নগদ, SSLCommerz — payment process করতে
                প্রয়োজনীয় তথ্য share। প্রতিটির নিজস্ব privacy policy প্রযোজ্য।
              </li>
              <li>
                <strong>Courier Partners:</strong> Pathao, Steadfast, RedX — delivery ও tracking-এর
                জন্য প্রয়োজনীয় order ও customer address তথ্য।
              </li>
              <li>
                <strong>Hosting/Infrastructure:</strong> Managed cloud services — data encrypted।
              </li>
              <li>
                <strong>SMS/Email Providers:</strong> Notification পাঠাতে।
              </li>
              <li>
                আমরা আপনার personal data বিক্রি করি না। Third-party data sharing সীমিত ও
                service delivery-র জন্য প্রয়োজনীয়।
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-bold text-ink-900">৪. Tenant Isolation ও Security</h2>
            <ul className="mt-3 space-y-2 text-[13.5px] leading-6">
              <li>
                <strong>Tenant Isolation:</strong> প্রতিটি store একটি logical boundary। একটি
                store-এর data অন্য store থেকে completely isolated। Server-side query সবসময়
                store/tenant ID দিয়ে scoped।
              </li>
              <li>
                <strong>Encryption:</strong> Data at rest encrypted। Gateway secret KMS/secret
                manager-এ। TLS সব connection-এ।
              </li>
              <li>
                <strong>Access Control:</strong> RBAC-based permissions। Super Admin access
                audit-logged ও time-limited।
              </li>
              <li>
                <strong>Audit Trail:</strong> সব privileged action audit log-এ। Financial records
                immutable।
              </li>
              <li>
                <strong>Backup:</strong> Daily backup। Data breach-এ incident response runbook।
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-bold text-ink-900">৫. আপনার অধিকার</h2>
            <ul className="mt-3 space-y-2 text-[13.5px] leading-6">
              <li>
                <strong>Data Export:</strong> যেকোনো সময় আপনার product, order ও customer data CSV
                export করতে পারবেন।
              </li>
              <li>
                <strong>Data Correction:</strong> Account settings থেকে আপনার তথ্য update করুন।
              </li>
              <li>
                <strong>Account Deletion:</strong> Account deletion request করা যাবে। Retention
                policy অনুযায়ী data মুছে ফেলা হবে। Financial records legal obligation অনুযায়ী
                রাখা হতে পারে।
              </li>
              <li>
                <strong>Consent:</strong> Marketing communication থেকে opt-out করতে পারবেন।
              </li>
              <li>
                ব্যক্তিগত উপাত্ত সুরক্ষা অধ্যাদেশ ২০২৫ অনুযায়ী আপনার অধিকার সংরক্ষিত।
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-bold text-ink-900">৬. Customer Data (Merchant-এর Store-এর)</h2>
            <p className="mt-3 text-[13.5px] leading-6">
              Merchant-এর store-এ কেনাকাটা করা Customer-দের data (নাম, ফোন, ঠিকানা, order history)
              সংক্রান্ত:
            </p>
            <ul className="mt-3 space-y-2 text-[13.5px] leading-6">
              <li>এই data-র controller হলেন Merchant; ATLaS হলো processor।</li>
              <li>
                Merchant-দের তাদের Customer-দের privacy policy জানাতে হবে এবং data minimization
                নীতি মেনে চলতে হবে।
              </li>
              <li>Courier data sharing-এ delivery উদ্দেশ্যে সীমিত তথ্য।</li>
              <li>ATLaS Customer data বাণিজ্যিক উদ্দেশ্যে ব্যবহার করে না।</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-bold text-ink-900">৭. Cookies ও Tracking</h2>
            <ul className="mt-3 space-y-2 text-[13.5px] leading-6">
              <li>Session cookie authentication-এর জন্য। HTTPOnly, Secure, SameSite।</li>
              <li>Analytics: platform improvement-এর জন্য anonymized event tracking।</li>
              <li>Third-party advertising cookie ব্যবহার করা হয় না।</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-bold text-ink-900">৮. Data Retention</h2>
            <ul className="mt-3 space-y-2 text-[13.5px] leading-6">
              <li>Active account: data account active থাকলে retain হয়।</li>
              <li>Cancelled account: deletion request-এর পর ৩০ দিনে personal data মুছে ফেলা হয়।</li>
              <li>Financial records (invoice, fee ledger, order): legal/audit requirement অনুযায়ী দীর্ঘমেয়াদে।</li>
              <li>Audit logs: immutable, long-term retention।</li>
              <li>Backup: ৩০ দিনের rolling backup।</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-bold text-ink-900">৯. যোগাযোগ</h2>
            <p className="mt-3 text-[13.5px] leading-6">
              Privacy সংক্রান্ত যেকোনো প্রশ্ন বা অনুরোধের জন্য আমাদের{" "}
              <a href="/contact" className="text-[#0B7A5B] hover:underline">
                Contact পেজ
              </a>{" "}
              ব্যবহার করুন অথবা privacy@atlas.example-এ ইমেইল করুন।
            </p>
          </section>
        </div>

        <div className="mt-10 flex flex-wrap gap-4 border-t border-[#e8eeeb] pt-8 text-[12.5px] text-ink-500">
          <a href="/terms" className="hover:text-[#0B7A5B] hover:underline">ব্যবহারের শর্তাবলী</a>
          <a href="/refund-policy" className="hover:text-[#0B7A5B] hover:underline">রিফান্ড পলিসি</a>
          <a href="/contact" className="hover:text-[#0B7A5B] hover:underline">যোগাযোগ</a>
        </div>
      </div>
    </div>
  );
}
