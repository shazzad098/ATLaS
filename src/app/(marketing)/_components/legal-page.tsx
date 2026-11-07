import { Badge, Card, CardBody } from "@/components/ui/shell";
import { slugify } from "@/lib/slug";
import { getLocale } from "@/lib/i18n/server";

/**
 * Shared layout for the policy pages (Terms, Privacy, Refund).
 *
 * The content lives in the page files — this component only renders it, so all
 * three documents keep the same typography, anchor links and "last updated"
 * treatment without duplicating markup.
 */

const LABELS = {
  bn: { contents: "সূচিপত্র", updated: "সর্বশেষ হালনাগাদ" },
  en: { contents: "Contents", updated: "Last updated" },
} as const;

export type LegalSection = { heading: string; body: string[] };

export async function LegalPage({
  title,
  updated,
  intro,
  sections,
  footnote,
}: {
  title: string;
  updated: string;
  intro: string;
  sections: LegalSection[];
  footnote?: string;
}) {
  const labels = LABELS[await getLocale()];

  return (
    <div className="mx-auto grid max-w-5xl gap-8 px-4 py-12 lg:grid-cols-[220px_1fr]">
      <aside className="hidden lg:block">
        <div className="sticky top-24 space-y-2 text-sm">
          <p className="text-xs font-semibold tracking-wide text-ink-500 uppercase">{labels.contents}</p>
          <nav className="space-y-1">
            {sections.map((section) => (
              <a
                key={section.heading}
                href={`#${slugify(section.heading)}`}
                className="block text-ink-600 hover:text-ink-900"
              >
                {section.heading}
              </a>
            ))}
          </nav>
        </div>
      </aside>

      <div className="space-y-6">
        <div className="space-y-3">
          <Badge tone="neutral">
            {labels.updated}: {updated}
          </Badge>
          <h1 className="text-3xl font-semibold tracking-tight text-ink-900">{title}</h1>
          <p className="text-ink-600">{intro}</p>
        </div>

        <Card>
          <CardBody className="space-y-7">
            {sections.map((section) => (
              <section
                key={section.heading}
                id={slugify(section.heading)}
                className="scroll-mt-24 space-y-2"
              >
                <h2 className="text-base font-semibold text-ink-900">{section.heading}</h2>
                {section.body.map((paragraph) => (
                  <p key={paragraph} className="text-sm leading-relaxed text-ink-600">
                    {paragraph}
                  </p>
                ))}
              </section>
            ))}
          </CardBody>
        </Card>

        {footnote ? <p className="text-xs text-ink-500">{footnote}</p> : null}
      </div>
    </div>
  );
}
