import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  getStorefrontContext,
  storefrontAvailability,
  storefrontOrigin,
  storefrontUrl,
  storePath,
  themeContextFrom,
} from "@/lib/storefront";
import { readBuyerSession } from "@/lib/auth/customer-session";
import { getTheme } from "@/themes";
import { themeStyle } from "@/themes/css";

/**
 * Storefront shell (PRD §3.3, FR-07).
 *
 * Resolves the store from the URL segment, applies the merchant's theme tokens,
 * and renders the theme Header/Footer around every child page. A store that is
 * not published yet gets a plain "under construction" notice instead of a 404,
 * so merchants can share a preview link while building.
 */

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const context = await getStorefrontContext(slug);
  if (!context) return { title: "দোকান পাওয়া যায়নি" };

  const seo = context.settings.seo as {
    title?: string;
    description?: string;
    keywords?: string[];
    image?: string;
  };
  const title = seo.title ?? context.store.name;
  const description = seo.description ?? context.store.description ?? undefined;
  const canonical = storefrontUrl(context);
  const image = seo.image ? new URL(seo.image, `${storefrontOrigin(context)}/`).toString() : storefrontUrl(context, "/opengraph-image");
  const indexable = storefrontAvailability(context).visible;

  return {
    metadataBase: new URL(`${storefrontOrigin(context).replace(/\/$/, "")}/`),
    title: { default: title, template: `%s · ${context.store.name}` },
    description,
    keywords: seo.keywords,
    alternates: { canonical },
    robots: indexable
      ? { index: true, follow: true }
      : { index: false, follow: false },
    openGraph: {
      type: "website",
      locale: "bn_BD",
      siteName: context.store.name,
      title,
      description,
      url: canonical,
      images: [{ url: image, width: 1200, height: 630, alt: context.store.name }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [image],
    },
  };
}

export default async function StorefrontLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const context = await getStorefrontContext(slug);
  if (!context) notFound();

  const availability = storefrontAvailability(context);
  const theme = getTheme(context.theme.code);
  const buyer = await readBuyerSession(context.store.id);

  if (!availability.visible) {
    const message =
      availability.reason === "DRAFT"
        ? "এই দোকানটি এখনো তৈরি হচ্ছে।"
        : availability.reason === "TENANT_SUSPENDED"
          ? "এই অ্যাকাউন্টটি সাময়িকভাবে বন্ধ আছে।"
          : "এই দোকানটি এই মুহূর্তে বন্ধ আছে।";
    const detail =
      availability.reason === "DRAFT"
        ? "দোকানদার শীঘ্রই publish করবেন — কিছুক্ষণ পর আবার দেখুন।"
        : "সহায়তার জন্য দোকানদারের সাথে যোগাযোগ করুন।";

    return (
      <div
        className="store-surface grid min-h-screen place-items-center px-4"
        style={themeStyle(context.theme.config)}
      >
        <div className="max-w-md text-center">
          <p
            className="mx-auto grid h-12 w-12 place-items-center rounded-full text-lg font-bold text-white"
            style={{ background: "var(--store-primary)" }}
          >
            {context.store.name.trim().charAt(0)}
          </p>
          <h1 className="mt-4 text-xl font-semibold">{context.store.name}</h1>
          <p className="mt-2 text-sm font-medium">{message}</p>
          <p className="muted mt-1 text-sm">{detail}</p>
        </div>
      </div>
    );
  }

  const ctx = {
    ...themeContextFrom(context),
    account: {
      href: storePath(context.store.slug, buyer ? "/account" : "/account/login"),
      signedIn: Boolean(buyer),
      name: buyer?.name ?? null,
    },
  };

  return (
    <div className="store-surface flex min-h-screen flex-col" style={themeStyle(ctx.config)}>
      <theme.Header ctx={ctx} />
      <main className="min-w-0 flex-1">{children}</main>
      <theme.Footer ctx={ctx} />
    </div>
  );
}
