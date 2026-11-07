import Link from "next/link";
import { getMessages } from "@/lib/i18n/server";
import { LocaleToggle } from "@/components/locale-toggle";

/** Login-only shell: picture-only panel on the left, form on the right. */

export default async function AuthLoginLayout({ children }: { children: React.ReactNode }) {
  const { m } = await getMessages();

  return (
    <div className="grid h-screen lg:grid-cols-2">
      {/* Left: the picture fills the whole panel edge-to-edge; overflow is
          clipped, so the image can never force a scrollbar. */}
      <div className="relative hidden overflow-hidden lg:block">
        <img
          src="/images/auth/atlas_auth.jpg"
          alt={m.auth.imageAlt}
          className="absolute inset-0 h-full w-full object-cover"
        />
      </div>

      {/* Right: the auth form. */}
      <div className="flex h-screen items-center justify-center overflow-hidden px-4 py-6 sm:px-8">
        <div className="max-h-full w-full max-w-md overflow-y-auto">
          <div className="mb-6 flex items-center justify-between gap-3">
            <Link href="/" className="inline-block text-lg font-semibold lg:hidden">
              ATLaS
            </Link>
            <LocaleToggle className="ml-auto" />
          </div>
          {children}
        </div>
      </div>
    </div>
  );
}
