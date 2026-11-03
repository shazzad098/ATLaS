import { notFound, redirect } from "next/navigation";
import { readBuyerSession } from "@/lib/auth/customer-session";
import { getStorefrontContext, storePath } from "@/lib/storefront";
import { BuyerSignupForm } from "@/app/store/[slug]/account/_components/auth-forms";
import { BuyerAuthShell } from "@/app/store/[slug]/account/_components/auth-shell";

export const metadata = { title: "অ্যাকাউন্ট খুলুন", robots: { index: false, follow: false } };

export default async function BuyerSignupPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const context = await getStorefrontContext(slug);
  if (!context) notFound();

  const buyer = await readBuyerSession(context.store.id);
  if (buyer) redirect(storePath(slug, "/account"));

  return (
    <BuyerAuthShell
      slug={slug}
      storeName={context.store.name}
      tagline={context.store.description}
      mode="signup"
    >
      <BuyerSignupForm slug={slug} />
    </BuyerAuthShell>
  );
}
