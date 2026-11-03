import { notFound, redirect } from "next/navigation";
import { readBuyerSession } from "@/lib/auth/customer-session";
import { getStorefrontContext, storePath } from "@/lib/storefront";
import { BuyerLoginForm } from "@/app/store/[slug]/account/_components/auth-forms";
import { BuyerAuthShell } from "@/app/store/[slug]/account/_components/auth-shell";

export const metadata = { title: "লগইন", robots: { index: false, follow: false } };

export default async function BuyerLoginPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ next?: string }>;
}) {
  const { slug } = await params;
  const context = await getStorefrontContext(slug);
  if (!context) notFound();

  const { next } = await searchParams;
  const buyer = await readBuyerSession(context.store.id);
  if (buyer) redirect(storePath(slug, "/account"));

  const accountPath = storePath(slug, "/account");
  const safeNext = next?.startsWith(storePath(slug, "/")) ? next : accountPath;

  return (
    <BuyerAuthShell
      slug={slug}
      storeName={context.store.name}
      tagline={context.store.description}
      mode="login"
    >
      <BuyerLoginForm slug={slug} next={safeNext} />
    </BuyerAuthShell>
  );
}
