import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { getStorefrontContext, storePath, storefrontUrl } from "@/lib/storefront";
import { listDeliveryZones } from "@/lib/services/cart-service";
import { formatBdt } from "@/lib/money";
import { StoreBreadcrumb, Surface } from "@/app/store/[slug]/_components/storefront-ui";

/** Merchant-authored content page (PRD §4 — returns, contact, delivery notes). */

const DEFAULT_PAGE_TITLES: Record<string, string> = {
  returns: "রিটার্ন ও রিফান্ড নীতি",
  contact: "যোগাযোগ",
  delivery: "ডেলিভারি তথ্য",
  privacy: "প্রাইভেসি নীতি",
  terms: "শর্তাবলী",
};

function defaultPageTitle(pageSlug: string): string | null {
  return DEFAULT_PAGE_TITLES[pageSlug] ?? null;
}

/**
 * The starter themes link to `/page/returns`, `/page/contact` and
 * `/page/delivery`. A newly created store has no rows yet, so render a useful
 * default instead of a 404 until the merchant replaces it with their own text.
 */
async function defaultPageBody(
  pageSlug: string,
  context: NonNullable<Awaited<ReturnType<typeof getStorefrontContext>>>,
): Promise<string | null> {
  const policy = context.settings.policy as {
    returnsText?: unknown;
    privacyText?: unknown;
    termsText?: unknown;
  };

  if (pageSlug === "returns") {
    const configured = String(policy.returnsText ?? "").trim();
    if (configured) return configured;
    return [
      `${context.store.name}-এ কেনা পণ্য পাওয়ার পর ৭ দিনের মধ্যে রিটার্নের অনুরোধ করতে পারেন।`,
      "",
      "শর্ত:",
      "• পণ্য অব্যবহৃত ও মূল প্যাকেজিংসহ থাকতে হবে।",
      "• ব্যবহারযোগ্য/খোলা কসমেটিকস বা ডিজিটাল পণ্য ফেরতযোগ্য নয়।",
      "• ডেলিভারি চার্জ সাধারণত ফেরতযোগ্য নয়, তবে ভুল বা ক্ষতিগ্রস্ত পণ্যের ক্ষেত্রে ব্যতিক্রম।",
      "",
      "রিটার্নের জন্য অর্ডার নম্বরসহ দোকানের যোগাযোগ নম্বরে message করুন।",
    ].join("\n");
  }

  if (pageSlug === "privacy") {
    const configured = String(policy.privacyText ?? "").trim();
    if (configured) return configured;
    return `${context.store.name} অর্ডার সম্পন্ন করতে আপনার নাম, মোবাইল নম্বর, ঠিকানা ও পেমেন্টের তথ্য ব্যবহার করে। ডেলিভারির জন্য প্রয়োজনীয় তথ্য কুরিয়ারকে দেওয়া হয়; অন্য কারও কাছে বিক্রি করা হয় না।`;
  }

  if (pageSlug === "terms") {
    const configured = String(policy.termsText ?? "").trim();
    if (configured) return configured;
    return `${context.store.name} থেকে অর্ডার করার মাধ্যমে আপনি পণ্যের দাম, ডেলিভারি চার্জ ও রিটার্ন নীতিতে সম্মত হচ্ছেন। অর্ডার নিশ্চিত হলে stock ও দাম যাচাই করে অর্ডার প্রসেস করা হয়।`;
  }

  if (pageSlug === "contact") {
    const contact = (context.settings.contact ?? {}) as {
      phone?: unknown;
      email?: unknown;
      whatsapp?: unknown;
    };
    const rows = [
      `দোকান: ${context.store.name}`,
      contact.phone ? `ফোন: ${String(contact.phone)}` : "",
      contact.whatsapp ? `WhatsApp: ${String(contact.whatsapp)}` : "",
      contact.email ? `ইমেইল: ${String(contact.email)}` : "",
    ].filter(Boolean);
    return rows.length > 1
      ? rows.join("\n")
      : `${context.store.name}-এর যোগাযোগের তথ্য এখনো যোগ করা হয়নি। অর্ডারের সময় দেওয়া নম্বরেই যোগাযোগ করুন।`;
  }

  if (pageSlug === "delivery") {
    const zones = await listDeliveryZones(context.store.id, { activeOnly: true });
    if (zones.length === 0) {
      return "ডেলিভারি এলাকা ও চার্জ এখনো সেট করা হয়নি। চেকআউটে আপনার এলাকা দেখে চার্জ নিশ্চিত হবে।";
    }
    return [
      `${context.store.name} নিচের এলাকায় ডেলিভারি দেয়:`,
      "",
      ...zones.map((zone) =>
        zone.freeAbove && Number(zone.freeAbove) > 0
          ? `• ${zone.name} — ${formatBdt(zone.charge)} (${formatBdt(zone.freeAbove)}-এর উপরে ফ্রি)`
          : `• ${zone.name} — ${formatBdt(zone.charge)}`,
      ),
      "",
      "ডেলিভারি সময় ও চার্জ অর্ডারের সময় চূড়ান্তভাবে দেখানো হয়।",
    ].join("\n");
  }

  return null;
}

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
    select: { title: true, bodyJson: true },
  });

  const fallbackTitle = defaultPageTitle(pageSlug);
  if (!page && !fallbackTitle) return { title: "পাতা পাওয়া যায়নি" };

  const body = (page?.bodyJson ?? {}) as { text?: string; html?: string };
  const description = (body.text ?? body.html ?? "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 160);
  const title = page?.title ?? fallbackTitle!;
  const canonical = storefrontUrl(context, `/page/${pageSlug}`);
  return {
    title,
    description: description || undefined,
    alternates: { canonical },
    openGraph: { url: canonical, title, description: description || undefined },
  };
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

  const fallbackTitle = defaultPageTitle(pageSlug);
  if (!page && !fallbackTitle) notFound();

  const body = (page?.bodyJson ?? {}) as { html?: string; text?: string };
  const text = page ? (body.text ?? body.html ?? "") : ((await defaultPageBody(pageSlug, context)) ?? "");
  const title = page?.title ?? fallbackTitle!;
  const contact = (context.settings.contact ?? {}) as { phone?: unknown; email?: unknown };

  return (
    <div className="atlas-shell py-8 sm:py-10">
      <StoreBreadcrumb
        slug={slug}
        items={[{ label: "হোম", href: "/" }, { label: title }]}
      />

      <div className="mt-5 grid gap-6 lg:grid-cols-[1fr_16rem] lg:items-start">
        <Surface className="p-6 sm:p-8">
          <p
            className="text-[10px] font-semibold tracking-[0.22em] uppercase"
            style={{ color: "var(--store-primary)" }}
          >
            দোকানের তথ্য
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">{title}</h1>
          <div className="muted mt-6 text-sm leading-relaxed whitespace-pre-line">{text}</div>
        </Surface>

        <Surface className="h-fit p-5 lg:sticky lg:top-24">
          <p className="text-sm font-semibold">{context.store.name}</p>
          <p className="muted mt-1 text-[11px] leading-relaxed">
            প্রশ্ন থাকলে সরাসরি যোগাযোগ করুন — আমরা সাহায্য করব।
          </p>
          <dl className="mt-4 space-y-2 text-[11px]">
            {contact.phone ? (
              <div>
                <dt className="muted">ফোন</dt>
                <dd className="mt-0.5 font-medium">{String(contact.phone)}</dd>
              </div>
            ) : null}
            {contact.email ? (
              <div>
                <dt className="muted">ইমেইল</dt>
                <dd className="mt-0.5 font-medium break-all">{String(contact.email)}</dd>
              </div>
            ) : null}
          </dl>
          <div className="mt-5 space-y-2 border-t border-black/[0.06] pt-4 text-[11px]">
            <Link
              href={storePath(context.store.slug, "/shop")}
              className="block font-medium hover:underline"
              style={{ color: "var(--store-primary)" }}
            >
              সব পণ্য দেখুন
            </Link>
            <Link
              href={storePath(context.store.slug, "/account/orders")}
              className="block font-medium hover:underline"
              style={{ color: "var(--store-primary)" }}
            >
              অর্ডার ট্র্যাক করুন
            </Link>
            <Link
              href={storePath(context.store.slug, "/page/contact")}
              className="block font-medium hover:underline"
              style={{ color: "var(--store-primary)" }}
            >
              যোগাযোগ করুন
            </Link>
          </div>
        </Surface>
      </div>
    </div>
  );
}
