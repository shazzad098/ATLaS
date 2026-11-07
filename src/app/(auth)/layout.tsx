import Link from "next/link";
import { CheckCircle2 } from "lucide-react";
import { getMessages } from "@/lib/i18n/server";
import { LocaleToggle } from "@/components/locale-toggle";

/** Auth shell: marketing panel on the left, form on the right (PRD §3.1). */

export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  const { m } = await getMessages();

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="relative hidden flex-col justify-between bg-ink-900 p-10 text-white lg:flex">
        <Link href="/" className="text-lg font-semibold" aria-label={m.auth.brandHome}>
          ATLaS
        </Link>

        <div className="max-w-md space-y-6">
          <h1 className="text-3xl font-semibold leading-snug">{m.auth.asideTitle}</h1>
          <ul className="space-y-3 text-sm text-white/80">
            {m.auth.asideHighlights.map((item) => (
              <li key={item} className="flex gap-2">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-brand-300" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>

        <p className="text-xs text-white/50">{m.auth.asideFooter}</p>
      </div>

      <div className="flex min-h-screen items-start justify-center px-4 py-10 sm:px-8 lg:items-center lg:py-12">
        <div className="w-full max-w-md">
          <div className="mb-6 flex items-center justify-between gap-3 lg:hidden">
            <Link href="/" className="inline-block text-lg font-semibold">
              ATLaS
            </Link>
            <LocaleToggle />
          </div>
          <div className="mb-4 hidden justify-end lg:flex">
            <LocaleToggle />
          </div>
          {children}
        </div>
      </div>
    </div>
  );
}
