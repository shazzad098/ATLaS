import Link from "next/link";

/** Login-only shell: picture-only panel on the left, form on the right. */

export default function AuthLoginLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid h-screen lg:grid-cols-2">
      {/* Left: the picture fills the whole panel edge-to-edge; overflow is
          clipped, so the image can never force a scrollbar. */}
      <div className="relative hidden overflow-hidden lg:block">
        <img
          src="/images/auth/atlas_auth.jpg"
          alt="ATLaS — মার্চেন্ট তার দোকান, অর্ডার আর ইনভেন্টরি এক ড্যাশবোর্ড থেকে চালাচ্ছেন"
          className="absolute inset-0 h-full w-full object-cover"
        />
      </div>

      {/* Right: the auth form. */}
      <div className="flex h-screen items-center justify-center overflow-hidden px-4 py-6 sm:px-8">
        <div className="max-h-full w-full max-w-md overflow-y-auto">
          <Link href="/" className="mb-8 inline-block text-lg font-semibold lg:hidden">
            ATLaS
          </Link>
          {children}
        </div>
      </div>
    </div>
  );
}
