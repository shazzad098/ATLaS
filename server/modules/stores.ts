import { and, asc, eq, inArray, ne, sql } from "drizzle-orm";
import { db } from "../db";
import {
  contentPages,
  deliveryZones,
  domains,
  memberships,
  paymentMethods,
  products,
  storeSettings,
  storeThemes,
  stores,
  tenants,
  themes,
  themeVersions,
  type StoreAddress,
  type StoreContact,
  type User,
} from "../../drizzle/schema";
import { RESERVED_SLUGS, ROOT_STORE_DOMAIN, SLUG_RE, normalizeBdPhone } from "../../shared/domain";
import type { PlanCode } from "../../shared/plans";
import { buildDefaultConfig, THEME_BY_CODE } from "../../shared/themeContract";
import { fail, slugify } from "../lib/core";
import { consume } from "../lib/rateLimit";
import { getEntitlements, startSubscription } from "./billing";
import { audit, track } from "./ops";
import { requirePerm, requireWrite, roleId, type TenantScope } from "./tenancy";
import { tierAllowed } from "./themes";

/* ───────── Slug availability ───────── */
export async function checkSlug(raw: string) {
  const slug = slugify(raw).replace(/^-+|-+$/g, "").slice(0, 40);
  if (!SLUG_RE.test(slug)) return { slug, available: false, reason: "Use 3–40 lowercase letters, numbers or hyphens (must start and end with a letter or number).", suggestions: [] as string[] };
  if (RESERVED_SLUGS.includes(slug)) return { slug, available: false, reason: "This name is reserved.", suggestions: [`${slug}-shop`, `${slug}-bd`] };
  const taken = await db()
    .select({ slug: stores.slug })
    .from(stores)
    .where(inArray(stores.slug, [slug, `${slug}-bd`, `${slug}-shop`, `${slug}-store`, `${slug}-online`]));
  const takenSet = new Set(taken.map(t => t.slug));
  if (takenSet.has(slug))
    return {
      slug,
      available: false,
      reason: "This subdomain is already taken.",
      suggestions: [`${slug}-bd`, `${slug}-shop`, `${slug}-store`, `${slug}-online`].filter(s => !takenSet.has(s)).slice(0, 3),
    };
  return { slug, available: true, host: `${slug}.${ROOT_STORE_DOMAIN}`, suggestions: [] as string[] };
}

const DEFAULT_PAGES = (name: string) => [
  {
    slug: "about",
    title: "About us",
    type: "page" as const,
    body: {
      en: `${name} is a Bangladeshi online store. We carefully select every product and deliver across all 64 districts with cash on delivery.`,
      bn: `${name} একটি বাংলাদেশি অনলাইন স্টোর। আমরা প্রতিটি পণ্য যত্ন করে বাছাই করি এবং ৬৪ জেলায় ক্যাশ অন ডেলিভারিতে পৌঁছে দিই।`,
    },
  },
  {
    slug: "privacy-policy",
    title: "Privacy policy",
    type: "policy" as const,
    body: {
      en: "We collect your name, phone number and address only to process and deliver your orders. We never sell your data. You can ask us to delete your information at any time.",
      bn: "আপনার অর্ডার প্রসেস ও ডেলিভারির জন্যই শুধু নাম, ফোন নম্বর ও ঠিকানা সংগ্রহ করা হয়। আমরা কখনও আপনার তথ্য বিক্রি করি না।",
    },
  },
  {
    slug: "refund-policy",
    title: "Return & refund policy",
    type: "policy" as const,
    body: {
      en: "Products can be returned within 7 days of delivery if unused and in original packaging. Refunds are sent to the original payment method (bKash/Nagad/card) within 7 working days. COD orders are refunded via bKash.",
      bn: "ডেলিভারির ৭ দিনের মধ্যে অব্যবহৃত পণ্য মূল প্যাকেজিংসহ ফেরত দেওয়া যাবে। রিফান্ড ৭ কার্যদিবসের মধ্যে মূল পেমেন্ট মাধ্যমে পাঠানো হয়।",
    },
  },
  {
    slug: "terms",
    title: "Terms of service",
    type: "policy" as const,
    body: { en: "By placing an order you agree to provide accurate delivery information. Prices are in BDT and include VAT where applicable.", bn: "অর্ডার দেওয়ার মাধ্যমে আপনি সঠিক ডেলিভারি তথ্য দিতে সম্মত হচ্ছেন। সকল মূল্য বাংলাদেশি টাকায়।" },
  },
  {
    slug: "shipping-policy",
    title: "Delivery policy",
    type: "policy" as const,
    body: { en: "Inside Dhaka: 1–2 days. Outside Dhaka: 3–5 days. Delivery charge is shown at checkout.", bn: "ঢাকার ভিতরে ১–২ দিন, ঢাকার বাইরে ৩–৫ দিন। ডেলিভারি চার্জ চেকআউটে দেখানো হবে।" },
  },
];

export type CreateStoreInput = {
  name: string;
  slug: string;
  category: string;
  description?: string;
  logoUrl?: string;
  primaryColor?: string;
  secondaryColor?: string;
  address: StoreAddress;
  contactPhone: string;
  contactEmail?: string;
  planCode: PlanCode;
  billingCycle: "monthly" | "yearly";
  themeCode?: string;
  locale?: "bn" | "en";
};

export async function createStore(user: User, input: CreateStoreInput, ip: string) {
  if (!user.phoneVerifiedAt) fail("FORBIDDEN", "Verify your mobile number before creating a store");
  if (!consume("store_create", String(user.id), 5, 60 * 60_000, ip).allowed) fail("RATE_LIMITED", "Too many stores created. Try again later.");
  const slugCheck = await checkSlug(input.slug);
  if (!slugCheck.available) fail("CONFLICT", slugCheck.reason ?? "Subdomain unavailable", { suggestions: slugCheck.suggestions });
  const contactPhone = normalizeBdPhone(input.contactPhone);
  if (!contactPhone) fail("VALIDATION", "Enter a valid Bangladesh contact number");
  const themeCode = input.themeCode && THEME_BY_CODE[input.themeCode] ? input.themeCode : input.category === "grocery" ? "bazar" : "nokshi";
  const [themeRow] = await db().select().from(themes).where(eq(themes.code, themeCode)).limit(1);
  if (!themeRow) fail("NOT_FOUND", "Theme not found");
  const [version] = await db()
    .select()
    .from(themeVersions)
    .where(and(eq(themeVersions.themeId, themeRow.id), eq(themeVersions.status, "published")))
    .orderBy(sql`${themeVersions.id} desc`)
    .limit(1);
  if (!version) fail("NOT_FOUND", "Theme version not found");

  const ownerRole = await roleId("owner");
  let result: { tenantId: number; storeId: number };
  try {
    result = await db().transaction(async tx => {
      const [tenant] = await tx.insert(tenants).values({ name: input.name.trim(), ownerUserId: user.id, lastActivityAt: new Date() }).$returningId();
      await tx.insert(memberships).values({ tenantId: tenant.id, userId: user.id, roleId: ownerRole, status: "active", acceptedAt: new Date() });
      const brand = { primary: input.primaryColor ?? THEME_BY_CODE[themeCode].defaults.colors.primary, secondary: input.secondaryColor ?? THEME_BY_CODE[themeCode].defaults.colors.secondary };
      const [store] = await tx
        .insert(stores)
        .values({
          tenantId: tenant.id,
          name: input.name.trim(),
          slug: slugCheck.slug,
          description: input.description ?? null,
          category: input.category,
          logoUrl: input.logoUrl ?? null,
          brandColorsJson: brand,
          status: "draft",
        })
        .$returningId();
      await tx.insert(storeSettings).values({
        storeId: store.id,
        locale: input.locale ?? "bn",
        addressJson: input.address,
        contactJson: { phone: contactPhone, email: input.contactEmail ?? user.email ?? undefined, whatsapp: contactPhone },
        seoJson: { title: `${input.name} — Online Shop in Bangladesh`, description: input.description ?? `Shop ${input.name} online with cash on delivery across Bangladesh.` },
        checkoutJson: { guestCheckout: true, codEnabled: true, orderNoteEnabled: true },
        taxJson: { enabled: false, ratePercent: 5, inclusive: true, label: "VAT" },
        notificationsJson: { orderCreated: true, paymentReceived: true, lowStock: true, billing: true, domain: true, customerSms: true, customerEmail: true, customerWhatsapp: false },
        onboardingJson: {},
      });
      await tx.insert(domains).values({
        tenantId: tenant.id,
        storeId: store.id,
        host: `${slugCheck.slug}.${ROOT_STORE_DOMAIN}`,
        type: "subdomain",
        verificationStatus: "active",
        tlsStatus: "issued",
        isPrimary: true,
        verifiedAt: new Date(),
      });
      for (const p of DEFAULT_PAGES(input.name.trim())) await tx.insert(contentPages).values({ storeId: store.id, slug: p.slug, title: p.title, type: p.type, bodyJson: p.body });
      await tx.insert(deliveryZones).values([
        { storeId: store.id, name: "Inside Dhaka", nameBn: "ঢাকার ভিতরে", districtsJson: ["Dhaka"], charge: "60.00", etaText: "1–2 days", sortOrder: 1 },
        { storeId: store.id, name: "Outside Dhaka", nameBn: "ঢাকার বাইরে", districtsJson: ["*"], charge: "120.00", etaText: "3–5 days", sortOrder: 2 },
      ]);
      await tx.insert(paymentMethods).values({ storeId: store.id, provider: "cod", mode: "live", status: "active", publicConfigJson: { label: "Cash on Delivery" } });
      const config = buildDefaultConfig(themeCode, { storeName: input.name.trim(), primary: input.primaryColor, secondary: input.secondaryColor, logoUrl: input.logoUrl });
      await tx.insert(storeThemes).values({ storeId: store.id, themeVersionId: version.id, draftConfigJson: config as unknown as Record<string, unknown>, isSelected: true, draftUpdatedAt: new Date() });
      await startSubscription(tenant.id, input.planCode, input.billingCycle, { trial: true }, tx);
      return { tenantId: tenant.id, storeId: store.id };
    });
  } catch (e) {
    if (String((e as Error).message).includes("Duplicate")) fail("CONFLICT", "This subdomain was just taken. Choose another.");
    throw e;
  }
  const ent = await getEntitlements(result.tenantId, { fresh: true });
  if (!tierAllowed(ent.limits, themeRow.tier)) fail("FEATURE_NOT_IN_PLAN", "Selected theme isn't available on this plan");
  await audit({ tenantId: result.tenantId, actorId: user.id, actorType: "merchant", action: "store.created", resourceType: "store", resourceId: result.storeId, ip, metadata: { slug: slugCheck.slug, plan: input.planCode } });
  await track("store_created", { tenantId: result.tenantId, storeId: result.storeId, userId: user.id, props: { plan: input.planCode, category: input.category } });
  await track("theme_selected", { tenantId: result.tenantId, storeId: result.storeId, userId: user.id, props: { theme: themeCode, onboarding: true } });
  return result;
}

/* ───────── Onboarding checklist ───────── */
export async function onboardingChecklist(scope: TenantScope) {
  const [settings] = await db().select().from(storeSettings).where(eq(storeSettings.storeId, scope.storeId)).limit(1);
  const flags = settings?.onboardingJson ?? {};
  const [pc] = await db()
    .select({ n: sql<number>`count(*)` })
    .from(products)
    .where(and(eq(products.storeId, scope.storeId), ne(products.status, "archived")));
  const online = await db()
    .select({ id: paymentMethods.id })
    .from(paymentMethods)
    .where(and(eq(paymentMethods.storeId, scope.storeId), eq(paymentMethods.status, "active"), ne(paymentMethods.provider, "cod")));
  const items = [
    { key: "addProduct", title: "Add your first product", description: "Photos, price, variants and stock.", done: Number(pc?.n ?? 0) > 0, link: "/app/products/new" },
    { key: "configureDelivery", title: "Configure delivery", description: "Review delivery zones, charges and courier.", done: !!flags.deliveryConfigured, link: "/app/delivery" },
    { key: "choosePayment", title: "Choose payment methods", description: "COD is on. Connect bKash, Nagad or SSLCommerz.", done: !!flags.paymentConfigured || online.length > 0, link: "/app/payments" },
    { key: "publishStore", title: "Publish your store", description: "Go live at your ATLaS subdomain.", done: scope.store.status === "published", link: "/app" },
  ];
  return { items, completed: items.filter(i => i.done).length, total: items.length };
}

export async function markOnboarding(storeId: number, key: "deliveryConfigured" | "paymentConfigured") {
  const [s] = await db().select().from(storeSettings).where(eq(storeSettings.storeId, storeId)).limit(1);
  await db()
    .update(storeSettings)
    .set({ onboardingJson: { ...(s?.onboardingJson ?? {}), [key]: true } })
    .where(eq(storeSettings.storeId, storeId));
}

export async function publishStore(scope: TenantScope, actorId: number) {
  requireWrite(scope, "settings.manage");
  const [sel] = await db().select().from(storeThemes).where(and(eq(storeThemes.storeId, scope.storeId), eq(storeThemes.isSelected, true))).limit(1);
  if (sel && !sel.publishedConfigJson) await db().update(storeThemes).set({ publishedConfigJson: sel.draftConfigJson, publishedAt: new Date() }).where(eq(storeThemes.id, sel.id));
  const first = scope.store.publishedAt === null;
  await db()
    .update(stores)
    .set({ status: "published", publishedAt: scope.store.publishedAt ?? new Date() })
    .where(eq(stores.id, scope.storeId));
  storeCache.clear();
  await audit({ tenantId: scope.tenantId, actorId, actorType: "merchant", action: "store.published", resourceType: "store", resourceId: scope.storeId, impersonationId: scope.impersonationId });
  if (first) await track("store_published", { tenantId: scope.tenantId, storeId: scope.storeId, userId: actorId });
}
export async function unpublishStore(scope: TenantScope, actorId: number) {
  requireWrite(scope, "settings.manage");
  await db().update(stores).set({ status: "draft" }).where(eq(stores.id, scope.storeId));
  storeCache.clear();
  await audit({ tenantId: scope.tenantId, actorId, actorType: "merchant", action: "store.unpublished", resourceType: "store", resourceId: scope.storeId, impersonationId: scope.impersonationId });
}

/* ───────── Settings ───────── */
export async function getSettings(storeId: number) {
  const [s] = await db().select().from(storeSettings).where(eq(storeSettings.storeId, storeId)).limit(1);
  return s ?? null;
}

export async function updateProfile(
  scope: TenantScope,
  patch: { name?: string; description?: string; category?: string; logoUrl?: string | null; brandColors?: { primary: string; secondary: string }; address?: StoreAddress; contact?: StoreContact; locale?: "bn" | "en"; seo?: { title?: string; description?: string; ogImage?: string } },
  actorId: number
) {
  requireWrite(scope, "settings.manage");
  const storePatch: Partial<typeof stores.$inferInsert> = {};
  if (patch.name) storePatch.name = patch.name.trim();
  if (patch.description !== undefined) storePatch.description = patch.description;
  if (patch.category) storePatch.category = patch.category;
  if (patch.logoUrl !== undefined) storePatch.logoUrl = patch.logoUrl;
  if (patch.brandColors) storePatch.brandColorsJson = patch.brandColors;
  if (Object.keys(storePatch).length) await db().update(stores).set(storePatch).where(eq(stores.id, scope.storeId));
  if (patch.name) await db().update(tenants).set({ name: patch.name.trim() }).where(eq(tenants.id, scope.tenantId));
  const settingsPatch: Partial<typeof storeSettings.$inferInsert> = {};
  if (patch.address) settingsPatch.addressJson = patch.address;
  if (patch.contact) {
    const phone = patch.contact.phone ? normalizeBdPhone(patch.contact.phone) : undefined;
    if (patch.contact.phone && !phone) fail("VALIDATION", "Invalid contact number");
    settingsPatch.contactJson = { ...patch.contact, phone: phone ?? undefined };
  }
  if (patch.locale) settingsPatch.locale = patch.locale;
  if (patch.seo) settingsPatch.seoJson = patch.seo;
  if (Object.keys(settingsPatch).length) await db().update(storeSettings).set(settingsPatch).where(eq(storeSettings.storeId, scope.storeId));
  storeCache.clear();
  await audit({ tenantId: scope.tenantId, actorId, actorType: "merchant", action: "store.profile_updated", resourceType: "store", resourceId: scope.storeId, impersonationId: scope.impersonationId });
}

export async function updateStoreSettings(
  scope: TenantScope,
  patch: {
    checkout?: { guestCheckout: boolean; codEnabled: boolean; orderNoteEnabled: boolean; minOrder?: number };
    tax?: { enabled: boolean; ratePercent: number; inclusive: boolean; label: string };
    notifications?: Record<string, boolean>;
    scheduledExport?: string | null;
  },
  actorId: number
) {
  requireWrite(scope, "settings.manage");
  if (patch.scheduledExport && patch.scheduledExport !== "none" && scope.ent.limits.reportsLevel !== "advanced_scheduled")
    fail("FEATURE_NOT_IN_PLAN", "Scheduled reports are available on the Pro plan.", { requiredPlan: "pro" });
  const set: Partial<typeof storeSettings.$inferInsert> = {};
  if (patch.checkout) set.checkoutJson = patch.checkout;
  if (patch.tax) {
    if (patch.tax.ratePercent < 0 || patch.tax.ratePercent > 30) fail("VALIDATION", "Tax rate must be between 0 and 30%");
    set.taxJson = patch.tax;
  }
  if (patch.notifications) set.notificationsJson = patch.notifications;
  if (patch.scheduledExport !== undefined) set.scheduledExport = patch.scheduledExport;
  await db().update(storeSettings).set(set).where(eq(storeSettings.storeId, scope.storeId));
  await audit({ tenantId: scope.tenantId, actorId, actorType: "merchant", action: "store.settings_updated", metadata: { fields: Object.keys(set) }, impersonationId: scope.impersonationId });
}

/* ───────── Content pages (about / policies) ───────── */
export async function listPages(storeId: number) {
  return db().select().from(contentPages).where(eq(contentPages.storeId, storeId)).orderBy(asc(contentPages.slug));
}
export async function upsertPage(scope: TenantScope, input: { id?: number; slug: string; title: string; body: { en: string; bn?: string }; type: "policy" | "page"; status: "draft" | "published" }) {
  requireWrite(scope, "settings.manage");
  const slug = slugify(input.slug);
  if (input.id) {
    await db()
      .update(contentPages)
      .set({ slug, title: input.title, bodyJson: input.body, type: input.type, status: input.status })
      .where(and(eq(contentPages.id, input.id), eq(contentPages.storeId, scope.storeId)));
    return input.id;
  }
  const [row] = await db().insert(contentPages).values({ storeId: scope.storeId, slug, title: input.title, bodyJson: input.body, type: input.type, status: input.status }).$returningId();
  return row.id;
}
export async function deletePage(scope: TenantScope, id: number) {
  requireWrite(scope, "settings.manage");
  await db().delete(contentPages).where(and(eq(contentPages.id, id), eq(contentPages.storeId, scope.storeId)));
}

/* ───────── Public store lookup ───────── */
type Store = typeof stores.$inferSelect;
const storeCache = new Map<string, { store: Store | null; until: number }>();
export function clearStoreCache() {
  storeCache.clear();
}
export async function storeBySlug(slug: string): Promise<Store | null> {
  const c = storeCache.get(slug);
  if (c && c.until > Date.now()) return c.store;
  const [s] = await db().select().from(stores).where(eq(stores.slug, slug)).limit(1);
  storeCache.set(slug, { store: s ?? null, until: Date.now() + 15_000 });
  return s ?? null;
}
export async function storeByHost(host: string): Promise<Store | null> {
  const h = host.toLowerCase().split(":")[0];
  if (h.endsWith(`.${ROOT_STORE_DOMAIN}`)) return storeBySlug(h.slice(0, -(ROOT_STORE_DOMAIN.length + 1)));
  const [d] = await db()
    .select({ storeId: domains.storeId })
    .from(domains)
    .where(and(eq(domains.host, h), eq(domains.verificationStatus, "active")))
    .limit(1);
  if (!d) return null;
  const [s] = await db().select().from(stores).where(eq(stores.id, d.storeId)).limit(1);
  return s ?? null;
}

export async function storeSummary(scope: TenantScope) {
  requirePerm(scope, "overview.view");
  const settings = await getSettings(scope.storeId);
  const doms = await db().select().from(domains).where(eq(domains.storeId, scope.storeId));
  return { store: scope.store, settings, domains: doms };
}
