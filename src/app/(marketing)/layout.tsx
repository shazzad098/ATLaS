import Link from "next/link";
import { SiteHeader } from "@/components/marketing/site-header";
import { getMessages } from "@/lib/i18n/server";

/** Marketing chrome for the public site. */

export default async function MarketingLayout({ children }: { children: React.ReactNode }) {
  const { m } = await getMessages();

  const footerGroups = [
    {
      title: m.footer.product,
      links: [
        { href: "/signup", label: m.footer.startFree },
        { href: "/pricing", label: m.footer.pricing },
        { href: "/themes", label: m.footer.themes },
        { href: "/how-it-works", label: m.footer.howItWorks },
      ],
    },
    {
      title: m.footer.company,
      links: [
        { href: "/help", label: m.footer.help },
        { href: "/contact", label: m.footer.contact },
        { href: "/developers", label: m.footer.developers },
        { href: "/login", label: m.footer.merchantLogin },
      ],
    },
    {
      title: m.footer.legal,
      links: [
        { href: "/terms", label: m.footer.terms },
        { href: "/privacy", label: m.footer.privacy },
        { href: "/refund-policy", label: m.footer.refund },
        { href: "/about", label: m.footer.about },
      ],
    },
  ];

  return (
    <div className="flex min-h-screen flex-col bg-white">
      <SiteHeader />

      <main className="min-w-0 flex-1">{children}</main>

      <footer className="border-t border-ink-200 bg-ink-50">
        <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 sm:grid-cols-2 lg:grid-cols-5">
          <div className="space-y-2 lg:col-span-2">
            <div className="flex items-center gap-2 font-semibold">
              <span className="grid h-7 w-7 place-items-center rounded-lg bg-brand-600 text-xs font-bold text-white">
                A
              </span>
              <span className="text-ink-900">ATLaS</span>
            </div>
            <p className="max-w-xs text-sm text-ink-500">{m.footer.tagline}</p>
            <p className="text-xs text-ink-400">{m.footer.apiLine}</p>
          </div>

          {footerGroups.map((group) => (
            <div key={group.title} className="space-y-2 text-sm">
              <p className="font-semibold text-ink-900">{group.title}</p>
              {group.links.map((link) => (
                <Link key={link.href} href={link.href} className="block text-ink-600 hover:text-ink-900">
                  {link.label}
                </Link>
              ))}
            </div>
          ))}
        </div>

        <div className="border-t border-ink-200 py-4">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2 px-4 text-xs text-ink-500">
            <p>{m.footer.copyright.replace("{year}", String(new Date().getFullYear()))}</p>
            <Link href="/developers" className="hover:text-ink-900">
              API v1 · OpenAPI 3.1
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
