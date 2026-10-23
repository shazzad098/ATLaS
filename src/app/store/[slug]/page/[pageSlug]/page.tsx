import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { getStorefrontContext } from "@/lib/storefront";

/** Merchant-authored content page (PRD §4 — returns, contact, delivery notes). */

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string; pageSlug: string }>;
}) {
  const { slug, pageSlug } = await params;
  const context = await getStorefrontContext(slug);
  if (!context) return { title: "পাতা" };

  const page = await prisma.contentPage.findFirst({
    where: { storeId: context.store.id, slug: pageSlug, status: "ACTIVE" },
    select: { title: true },
  });
  return { title: page?.title ?? "পাতা পাওয়া যায়নি" };
}

export default async function ContentPageRoute({
  params,
}: {
  params: Promise<{ slug: string; pageSlug: string }>;
}) {
  const { slug, pageSlug } = await params;
  const context = await getStorefrontContext(slug);
  if (!context) notFound();

  const page = await prisma.contentPage.findFirst({
    where: { storeId: context.store.id, slug: pageSlug, status: "ACTIVE" },
  });
  if (!page) notFound();

  const body = page.bodyJson as { html?: string; text?: string };
  const text = body.text ?? body.html ?? "";

  return (
    <div className="atlas-shell py-12">
      <article className="mx-auto max-w-2xl">
        <h1 className="text-3xl font-semibold">{page.title}</h1>
        <div className="muted mt-6 text-sm leading-relaxed whitespace-pre-line">{text}</div>
      </article>
    </div>
  );
}
