import { ButtonLink } from "@/components/ui/button";
import { Badge, Card, CardBody, Table, Td, Th } from "@/components/ui/shell";
import { THEME_CATALOG, THEME_SECTION_KEYS } from "@/lib/theme-catalog";

/** Public theme gallery (PRD §7). */

export const metadata = {
  title: "থিম গ্যালারি",
  description: "Nokshi, Bazar ও Studio — তিনটি তৈরি theme, একই সেকশন কাঠামো।",
};

const SECTION_LABEL: Record<string, string> = {
  Header: "হেডার",
  Hero: "হিরো",
  CategoryGrid: "ক্যাটাগরি",
  ProductGrid: "প্রোডাক্ট গ্রিড",
  PromoBanner: "প্রোমো ব্যানার",
  Testimonials: "রিভিউ",
  TrustBar: "ট্রাস্ট বার",
  Footer: "ফুটার",
};

export default function ThemesPage() {
  return (
    <div className="mx-auto max-w-6xl space-y-10 px-4 py-12">
      <div className="max-w-2xl space-y-3">
        <Badge tone="brand">থিম</Badge>
        <h1 className="text-3xl font-semibold tracking-tight text-ink-900 sm:text-4xl">থিম গ্যালারি</h1>
        <p className="text-ink-600">
          প্রতিটি থিমে একই সেকশন কাঠামো — রঙ, ফন্ট, হিরো আর সেকশনের ক্রম নিজের মতো সাজিয়ে নিন। থিম
          বদলালেও প্রোডাক্ট ও অর্ডার একই থাকে।
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {THEME_CATALOG.map((theme) => (
          <Card key={theme.code} className="overflow-hidden">
            <div className={`h-40 bg-gradient-to-br ${theme.preview.gradient}`}>
              <div className="flex h-full items-end gap-2 p-4">
                {theme.preview.swatches.map((swatch) => (
                  <span
                    key={swatch}
                    className="h-7 w-7 rounded-full border-2 border-white/70"
                    style={{ background: swatch }}
                  />
                ))}
              </div>
            </div>
            <CardBody className="space-y-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-base font-semibold text-ink-900">{theme.name}</p>
                <Badge tone="neutral">v{theme.version}</Badge>
              </div>
              <p className="text-xs font-medium text-ink-500">{theme.style}</p>
              <p className="text-sm text-ink-600">{theme.description}</p>
              <dl className="space-y-1 text-xs text-ink-500">
                <div>
                  <dt className="inline font-medium text-ink-700">উপযোগী: </dt>
                  <dd className="inline">{theme.industry}</dd>
                </div>
                <div>
                  <dt className="inline font-medium text-ink-700">প্ল্যান: </dt>
                  <dd className="inline">{theme.compatiblePlans.join(", ")}</dd>
                </div>
              </dl>
            </CardBody>
          </Card>
        ))}
      </div>

      <Card>
        <div className="border-b border-ink-100 px-5 py-4">
          <h2 className="text-sm font-semibold text-ink-900">সব থিমে যে সেকশনগুলো আছে</h2>
          <p className="text-xs text-ink-500">
            প্রতিটি সেকশন চালু/বন্ধ করা যায়, আর ক্রম (order) বদলানো যায় ডিজাইন স্ক্রিন থেকে।
          </p>
        </div>
        <Table>
          <thead>
            <tr>
              <Th>সেকশন</Th>
              <Th>কী দেখায়</Th>
            </tr>
          </thead>
          <tbody>
            {THEME_SECTION_KEYS.map((key) => (
              <tr key={key}>
                <Td className="font-medium text-ink-800">{SECTION_LABEL[key] ?? key}</Td>
                <Td className="text-xs text-ink-500">{SECTION_HELP[key] ?? ""}</Td>
              </tr>
            ))}
          </tbody>
        </Table>
      </Card>

      <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-brand-200 bg-brand-50 p-6">
        <div className="space-y-1">
          <p className="text-lg font-semibold text-ink-900">ডেমো দোকান ঘুরে দেখুন</p>
          <p className="text-sm text-ink-600">প্রতিটি থিম আসল প্রোডাক্ট ও অর্ডার দিয়ে চালু আছে।</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <ButtonLink href="/store/nokshi-demo">নকশি (editorial)</ButtonLink>
          <ButtonLink href="/store/dhaka-bazar" variant="outline">
            ঢাকা বাজার (dense)
          </ButtonLink>
        </div>
      </div>
    </div>
  );
}

const SECTION_HELP: Record<string, string> = {
  Header: "লোগো, নেভিগেশন, সার্চ ও ঘোষণা বার",
  Hero: "বড় শিরোনাম, সাবটাইটেল ও একটি CTA বাটন",
  CategoryGrid: "ক্যাটাগরি কার্ডের গ্রিড",
  ProductGrid: "নির্বাচিত/সর্বশেষ প্রোডাক্ট",
  PromoBanner: "অফার বা ঘোষণার ব্যানার",
  Testimonials: "কাস্টমারের রিভিউ",
  TrustBar: "রিটার্ন, COD, অরিজিনালিটির মতো প্রতিশ্রুতি",
  Footer: "দোকান পরিচিতি, লিংক কলাম ও নোট",
};
