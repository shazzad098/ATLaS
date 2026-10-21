import { z } from "zod";
import { prisma } from "@/lib/db";
import { AppError, ConflictError, NotFoundError } from "@/lib/errors";
import { assertPermission, type ActorContext } from "@/lib/rbac";
import { assertStoreAccess } from "@/lib/tenant";
import { assertFeature, loadEntitlementSnapshot } from "@/lib/entitlements";
import { isValidSlug, randomSuffix, slugify } from "@/lib/slug";
import { toDecimalString } from "@/lib/money";
import { notify, NOTIFICATION_TYPES } from "@/lib/notifications";
import { recordAudit } from "@/lib/audit";
import { ensureThemeCatalog, resolveStoreTheme, selectTheme } from "@/lib/services/theme-service";
import { ensureSubdomain, subdomainHost } from "@/lib/services/domain-service";

/**
 * Store lifecycle + settings (FR-02, FR-04).
 *
 * Creating a store provisions everything a merchant needs to sell: settings,
 * a platform subdomain, the payment methods, a default delivery zone and a
 * first theme. Publishing is a deliberate, entitlement-checked step.
 */

export const storeInputSchema = z.object({
  name: z.string().min(2, "দোকানের নাম দিন।").max(120),
  slug: z.string().max(60).optional(),
  description: z.string().max(600).default(""),
  themeCode: z.string().max(40).optional(),
  locale: z.enum(["bn", "en"]).default("bn"),
});

export type StoreInput = z.infer<typeof storeInputSchema>;

export const DEFAULT_DELIVERY_ZONES = [
  { name: "ঢাকা সিটির ভিতরে", charge: "60.00", freeAbove: null, areas: ["ঢাকা"], isDefault: true },
  { name: "ঢাকার বাইরে", charge: "120.00", freeAbove: null, areas: ["চট্টগ্রাম", "সিলেট", "রাজশাহী", "খুলনা"], isDefault: false },
];

async function uniqueStoreSlug(desired: string): Promise<string> {
  const base = slugify(desired, { maxLength: 50 }) || "store";
  let candidate = base;
  if (!isValidSlug(candidate)) candidate = `store-${randomSuffix(4)}`;

  for (let attempt = 0; attempt < 30; attempt += 1) {
    const clash = await prisma.store.findUnique({ where: { slug: candidate }, select: { id: true } });
    if (!clash) return candidate;
    candidate = `${base.slice(0, 48)}-${randomSuffix(4)}`;
  }
  throw new ConflictError("এই নামে store তৈরি করা যাচ্ছে না, অন্য নাম দিন।");
}

export async function listStores(tenantId: string) {
  return prisma.store.findMany({
    where: { tenantId, deletedAt: null },
    orderBy: { createdAt: "asc" },
    include: {
      settings: true,
      domains: { where: { isPrimary: true }, select: { host: true, verificationStatus: true } },
      _count: { select: { products: true, orders: true } },
    },
  });
}

/** Creates a store and its full default configuration in one transaction. */
export async function createStore(actor: ActorContext, raw: unknown) {
  assertPermission(actor, "store:write");

  const input = storeInputSchema.parse(raw);
  const snapshot = await loadEntitlementSnapshot(actor.tenantId);
  assertFeature(snapshot, "publishStore");

  const slug = await uniqueStoreSlug(input.slug || input.name);
  await ensureThemeCatalog();

  const themeEntry = input.themeCode ? input.themeCode : "nokshi";

  const store = await prisma.$transaction(async (tx) => {
    const created = await tx.store.create({
      data: {
        tenantId: actor.tenantId,
        name: input.name,
        slug,
        description: input.description || null,
        status: "DRAFT",
      },
    });

    await tx.storeSettings.create({
      data: {
        storeId: created.id,
        locale: input.locale,
        addressJson: { line1: "", area: "", city: "Dhaka", district: "Dhaka", postcode: "" } as never,
        contactJson: { phone: "", email: "", whatsapp: "" } as never,
        seoJson: { title: input.name, description: input.description, ogImage: "" } as never,
        checkoutJson: {
          codAutoConfirm: true,
          minOrderTotal: "0.00",
          requirePhoneVerification: false,
          termsUrl: "",
        } as never,
        taxJson: { mode: "INCLUSIVE", ratePercent: 0, vatRegistered: false } as never,
        policyJson: { returnsDays: 7, returnsText: "", privacyText: "", termsText: "" } as never,
        notificationsJson: {
          orderCreated: true,
          paymentReceived: true,
          lowStock: true,
          channels: ["in_app"],
        } as never,
      },
    });

    for (const zone of DEFAULT_DELIVERY_ZONES) {
      await tx.deliveryZone.create({
        data: {
          storeId: created.id,
          name: zone.name,
          areas: zone.areas as never,
          charge: toDecimalString(zone.charge) as never,
          freeAbove: zone.freeAbove ? (toDecimalString(zone.freeAbove) as never) : null,
          isDefault: zone.isDefault,
          isActive: true,
        },
      });
    }

    // COD is on by default; the gateways start disabled until keys are added.
    await tx.paymentMethod.create({
      data: { storeId: created.id, provider: "COD", isEnabled: true, publicConfigJson: {} as never },
    });
    for (const provider of ["BKASH", "NAGAD", "SSLCOMMERZ"] as const) {
      await tx.paymentMethod.create({
        data: {
          storeId: created.id,
          provider,
          isEnabled: false,
          publicConfigJson: { sandbox: true } as never,
        },
      });
    }

    return created;
  });

  await ensureSubdomain(store.id);

  const themeVersion = await prisma.themeVersion.findFirst({
    where: { theme: { code: themeEntry } },
    include: { theme: true },
  });
  if (themeVersion) {
    await prisma.storeTheme.create({
      data: {
        storeId: store.id,
        themeVersionId: themeVersion.id,
        isSelected: true,
        configJson: {} as never,
        draftConfigJson: {} as never,
        publishedAt: null,
      },
    });
    // Selecting through the service keeps validation + audit in one path.
    try {
      await selectTheme(actor, store.id, themeEntry);
    } catch {
      // Free plan allows the first pick; if that ever changes we still have a theme row.
    }
  }

  await recordAudit({
    action: "store.created",
    tenantId: actor.tenantId,
    actorId: actor.userId,
    resourceType: "Store",
    resourceId: store.id,
    metadata: { slug, themeCode: themeEntry },
  });

  return store;
}

export async function getStoreDetail(storeId: string) {
  const store = await prisma.store.findFirst({
    where: { id: storeId, deletedAt: null },
    include: {
      settings: true,
      domains: { orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }] },
      paymentMethods: true,
      deliveryZones: { orderBy: [{ isDefault: "desc" }, { sortOrder: "asc" }] },      _count: { select: { products: true, orders: true, customers: true, categories: true } },
    },
  });
  if (!store) throw new NotFoundError("Store");

  const theme = await resolveStoreTheme(storeId);
  const primaryDomain =
    store.domains.find((d) => d.isPrimary) ??
    store.domains.find((d) => d.type === "SUBDOMAIN") ??
    null;

  return {
    store,
    theme,
    primaryDomain: primaryDomain?.host ?? subdomainHost(store.slug),
  };
}

export const storeSettingsSchema = z.object({
  name: z.string().min(2).max(120).optional(),
  description: z.string().max(600).optional(),
  locale: z.enum(["bn", "en"]).optional(),
  address: z
    .object({
      line1: z.string().max(240).default(""),
      line2: z.string().max(240).default(""),
      area: z.string().max(120).default(""),
      city: z.string().max(120).default(""),
      district: z.string().max(120).default(""),
      postcode: z.string().max(20).default(""),
    })
    .partial()
    .optional(),
  contact: z
    .object({
      phone: z.string().max(20).default(""),
      email: z.string().max(160).default(""),
      whatsapp: z.string().max(20).default(""),
    })
    .partial()
    .optional(),
  seo: z
    .object({
      title: z.string().max(160).default(""),
      description: z.string().max(320).default(""),
      ogImage: z.string().max(500).default(""),
    })
    .partial()
    .optional(),
  checkout: z
    .object({
      codAutoConfirm: z.boolean().default(true),
      minOrderTotal: z.union([z.string(), z.number()]).default("0.00"),
      requirePhoneVerification: z.boolean().default(false),
      termsUrl: z.string().max(400).default(""),
    })
    .partial()
    .optional(),
  tax: z
    .object({
      mode: z.enum(["INCLUSIVE", "EXCLUSIVE", "NONE"]).default("INCLUSIVE"),
      ratePercent: z.number().min(0).max(100).default(0),
      vatRegistered: z.boolean().default(false),
    })
    .partial()
    .optional(),
  policy: z
    .object({
      returnsDays: z.number().int().min(0).max(365).default(7),
      returnsText: z.string().max(8000).default(""),
      privacyText: z.string().max(8000).default(""),
      termsText: z.string().max(8000).default(""),
    })
    .partial()
    .optional(),
  notifications: z
    .object({
      orderCreated: z.boolean().default(true),
      paymentReceived: z.boolean().default(true),
      lowStock: z.boolean().default(true),
      channels: z.array(z.enum(["in_app", "email", "sms"])).default(["in_app"]),
    })
    .partial()
    .optional(),
});

export type StoreSettingsInput = z.infer<typeof storeSettingsSchema>;

export async function updateStoreSettings(
  actor: ActorContext,
  storeId: string,
  raw: unknown,
) {
  assertPermission(actor, "settings:write");
  await assertStoreAccess(actor, storeId);

  const input = storeSettingsSchema.parse(raw);
  const existing = await prisma.store.findFirst({
    where: { id: storeId, deletedAt: null },
    include: { settings: true },
  });
  if (!existing) throw new NotFoundError("Store");

  const merge = (current: unknown, patch: unknown) => ({
    ...(current as Record<string, unknown>),
    ...((patch as Record<string, unknown> | undefined) ?? {}),
  });

  await prisma.$transaction(async (tx) => {
    if (input.name !== undefined || input.description !== undefined) {
      await tx.store.update({
        where: { id: storeId },
        data: {
          ...(input.name !== undefined ? { name: input.name } : {}),
          ...(input.description !== undefined ? { description: input.description } : {}),
        },
      });
    }

    const settings = existing.settings;
    await tx.storeSettings.upsert({
      where: { storeId },
      create: {
        storeId,
        locale: input.locale ?? "bn",
        addressJson: merge({}, input.address) as never,
        contactJson: merge({}, input.contact) as never,
        seoJson: merge({}, input.seo) as never,
        checkoutJson: merge({}, input.checkout) as never,
        taxJson: merge({}, input.tax) as never,
        policyJson: merge({}, input.policy) as never,
        notificationsJson: merge({}, input.notifications) as never,
      },
      update: {
        ...(input.locale !== undefined ? { locale: input.locale } : {}),
        ...(input.address ? { addressJson: merge(settings?.addressJson, input.address) as never } : {}),
        ...(input.contact ? { contactJson: merge(settings?.contactJson, input.contact) as never } : {}),
        ...(input.seo ? { seoJson: merge(settings?.seoJson, input.seo) as never } : {}),
        ...(input.checkout
          ? {
              checkoutJson: {
                ...merge(settings?.checkoutJson, input.checkout),
                ...(input.checkout.minOrderTotal !== undefined
                  ? { minOrderTotal: toDecimalString(input.checkout.minOrderTotal) }
                  : {}),
              } as never,
            }
          : {}),
        ...(input.tax ? { taxJson: merge(settings?.taxJson, input.tax) as never } : {}),
        ...(input.policy ? { policyJson: merge(settings?.policyJson, input.policy) as never } : {}),
        ...(input.notifications
          ? { notificationsJson: merge(settings?.notificationsJson, input.notifications) as never }
          : {}),
      },
    });
  });

  await recordAudit({
    action: "store.settings_updated",
    tenantId: actor.tenantId,
    actorId: actor.userId,
    resourceType: "Store",
    resourceId: storeId,
    metadata: { fields: Object.keys(input) },
  });

  return getStoreDetail(storeId);
}

// ── Publishing ───────────────────────────────────────────────────────────────

export type PublishCheck = { key: string; ok: boolean; label: string; href: string };

/** Readiness checklist shown before publishing (PRD §6 onboarding). */
export async function publishReadiness(storeId: string): Promise<PublishCheck[]> {
  const [store, productCount, themes, zones, payments] = await Promise.all([
    prisma.store.findFirst({
      where: { id: storeId },
      include: { settings: true },
    }),
    prisma.product.count({ where: { storeId, status: "ACTIVE", deletedAt: null } }),
    prisma.storeTheme.count({ where: { storeId, isSelected: true } }),
    prisma.deliveryZone.count({ where: { storeId, isActive: true } }),
    prisma.paymentMethod.count({ where: { storeId, isEnabled: true } }),
  ]);

  const contact = (store?.settings?.contactJson ?? {}) as Record<string, unknown>;

  return [
    { key: "name", ok: Boolean(store?.name), label: "দোকানের নাম", href: "/admin/settings" },
    { key: "theme", ok: themes > 0, label: "একটি theme নির্বাচন", href: "/admin/design" },
    { key: "products", ok: productCount > 0, label: "কমপক্ষে ১টি active product", href: "/admin/products" },
    { key: "delivery", ok: zones > 0, label: "ডেলিভারি zone", href: "/admin/delivery" },
    { key: "payment", ok: payments > 0, label: "একটি payment method চালু", href: "/admin/payments" },
    { key: "contact", ok: Boolean(contact.phone), label: "যোগাযোগের নম্বর", href: "/admin/settings" },
  ];
}

export async function publishStore(actor: ActorContext, storeId: string) {
  assertPermission(actor, "store:publish");
  await assertStoreAccess(actor, storeId);

  const snapshot = await loadEntitlementSnapshot(actor.tenantId);
  if (snapshot.readOnly) {
    throw new AppError(
      "FORBIDDEN",
      "Subscription read-only অবস্থায় আছে — publish করা যাবে না।",
      403,
      { planCode: snapshot.planCode },
    );
  }

  const checks = await publishReadiness(storeId);
  const blocking = checks.filter((check) => !check.ok && ["theme", "products", "delivery", "payment"].includes(check.key));
  if (blocking.length > 0) {
    throw new AppError(
      "VALIDATION_FAILED",
      `Publish করার আগে শেষ করুন: ${blocking.map((c) => c.label).join(", ")}`,
      422,
      { checks },
    );
  }

  const store = await prisma.store.update({
    where: { id: storeId },
    data: { status: "PUBLISHED", publishedAt: new Date() },
  });

  await ensureSubdomain(storeId);
  await notify({
    userId: actor.userId,
    type: NOTIFICATION_TYPES.STORE_PUBLISHED,
    title: "Storefront publish হয়েছে 🎉",
    body: `${store.name} এখন ${subdomainHost(store.slug)} ঠিকানায় লাইভ।`,
    payload: { storeId, host: subdomainHost(store.slug) },
  });

  await recordAudit({
    action: "store.published",
    tenantId: actor.tenantId,
    actorId: actor.userId,
    resourceType: "Store",
    resourceId: storeId,
    metadata: { slug: store.slug },
  });

  return store;
}

export async function unpublishStore(actor: ActorContext, storeId: string) {
  assertPermission(actor, "store:publish");
  await assertStoreAccess(actor, storeId);

  const store = await prisma.store.update({
    where: { id: storeId },
    data: { status: "DRAFT", publishedAt: null },
  });

  await recordAudit({
    action: "store.unpublished",
    tenantId: actor.tenantId,
    actorId: actor.userId,
    resourceType: "Store",
    resourceId: storeId,
  });

  return store;
}

/** Soft delete — orders and financial history stay queryable (PRD Appendix B). */
export async function archiveStore(actor: ActorContext, storeId: string) {
  assertPermission(actor, "store:write");
  await assertStoreAccess(actor, storeId);

  const store = await prisma.store.update({
    where: { id: storeId },
    data: { status: "DRAFT", publishedAt: null, deletedAt: new Date() },
  });

  await recordAudit({
    action: "store.archived",
    tenantId: actor.tenantId,
    actorId: actor.userId,
    resourceType: "Store",
    resourceId: storeId,
    metadata: { slug: store.slug },
  });

  return store;
}

// ── Delivery zones ───────────────────────────────────────────────────────────

export const deliveryZoneSchema = z.object({
  name: z.string().min(1).max(120),
  areas: z.array(z.string().max(80)).max(40).default([]),
  charge: z.union([z.string(), z.number()]),
  freeAbove: z.union([z.string(), z.number()]).nullable().optional(),
  isDefault: z.boolean().default(false),
  isActive: z.boolean().default(true),
  sortOrder: z.number().int().min(0).default(0),
});

export async function createDeliveryZone(actor: ActorContext, storeId: string, raw: unknown) {
  assertPermission(actor, "delivery:write");
  await assertStoreAccess(actor, storeId);
  const input = deliveryZoneSchema.parse(raw);

  const zone = await prisma.$transaction(async (tx) => {
    if (input.isDefault) {
      await tx.deliveryZone.updateMany({ where: { storeId }, data: { isDefault: false } });
    }
    return tx.deliveryZone.create({
      data: {
        storeId,
        name: input.name,
        areas: input.areas as never,
        charge: toDecimalString(input.charge) as never,
        freeAbove: input.freeAbove ? (toDecimalString(input.freeAbove) as never) : null,
        isDefault: input.isDefault,
        isActive: input.isActive,
        sortOrder: input.sortOrder,
      },
    });
  });

  await recordAudit({
    action: "delivery_zone.created",
    tenantId: actor.tenantId,
    actorId: actor.userId,
    resourceType: "DeliveryZone",
    resourceId: zone.id,
    metadata: { storeId },
  });

  return zone;
}

export async function updateDeliveryZone(
  actor: ActorContext,
  storeId: string,
  zoneId: string,
  raw: unknown,
) {
  assertPermission(actor, "delivery:write");
  await assertStoreAccess(actor, storeId);
  const input = deliveryZoneSchema.parse(raw);

  const existing = await prisma.deliveryZone.findFirst({ where: { id: zoneId, storeId } });
  if (!existing) throw new NotFoundError("Delivery zone");

  return prisma.$transaction(async (tx) => {
    if (input.isDefault) {
      await tx.deliveryZone.updateMany({ where: { storeId }, data: { isDefault: false } });
    }
    return tx.deliveryZone.update({
      where: { id: zoneId },
      data: {
        name: input.name,
        areas: input.areas as never,
        charge: toDecimalString(input.charge) as never,
        freeAbove: input.freeAbove ? (toDecimalString(input.freeAbove) as never) : null,
        isDefault: input.isDefault,
        isActive: input.isActive,
        sortOrder: input.sortOrder,
      },
    });
  });
}

export async function deleteDeliveryZone(actor: ActorContext, storeId: string, zoneId: string) {
  assertPermission(actor, "delivery:write");
  await assertStoreAccess(actor, storeId);
  const removed = await prisma.deliveryZone.deleteMany({ where: { id: zoneId, storeId } });
  if (removed.count === 0) throw new NotFoundError("Delivery zone");
}

// ── Payment methods ──────────────────────────────────────────────────────────

export async function togglePaymentMethod(
  actor: ActorContext,
  storeId: string,
  provider: "COD" | "BKASH" | "NAGAD" | "SSLCOMMERZ",
  input: { isEnabled: boolean; publicConfig?: Record<string, unknown>; secretRef?: string | null },
) {
  assertPermission(actor, "payments:write");
  await assertStoreAccess(actor, storeId);

  const method = await prisma.paymentMethod.upsert({
    where: { storeId_provider: { storeId, provider } },
    create: {
      storeId,
      provider,
      isEnabled: input.isEnabled,
      publicConfigJson: (input.publicConfig ?? {}) as never,
      encryptedSecretRef: input.secretRef ?? null,
    },
    update: {
      isEnabled: input.isEnabled,
      ...(input.publicConfig ? { publicConfigJson: input.publicConfig as never } : {}),
      ...(input.secretRef !== undefined ? { encryptedSecretRef: input.secretRef } : {}),
    },
  });

  await recordAudit({
    action: "payment_method.updated",
    tenantId: actor.tenantId,
    actorId: actor.userId,
    resourceType: "PaymentMethod",
    resourceId: method.id,
    metadata: { storeId, provider, isEnabled: input.isEnabled },
  });

  return method;
}

// ── Storefront reads ─────────────────────────────────────────────────────────

export type StorefrontContext = {
  store: {
    id: string;
    name: string;
    slug: string;
    description: string | null;
    status: string;
    logoAssetId: string | null;
  };
  settings: {
    locale: string;
    address: Record<string, unknown>;
    contact: Record<string, unknown>;
    seo: Record<string, unknown>;
    checkout: Record<string, unknown>;
    policy: Record<string, unknown>;
  };
  tenant: { id: string; status: string };
  host: string;
  theme: { code: string; name: string; config: Awaited<ReturnType<typeof resolveStoreTheme>>["config"] };
};

/** Everything a storefront page needs, resolved by slug. */
export async function loadStorefront(slug: string): Promise<StorefrontContext | null> {
  const store = await prisma.store.findFirst({
    where: { slug, deletedAt: null },
    include: {
      settings: true,
      tenant: { select: { id: true, status: true } },
      domains: { where: { isPrimary: true }, select: { host: true } },
    },
  });
  if (!store) return null;

  const theme = await resolveStoreTheme(store.id);

  return {
    store: {
      id: store.id,
      name: store.name,
      slug: store.slug,
      description: store.description,
      status: store.status,
      logoAssetId: store.logoAssetId,
    },
    settings: {
      locale: store.settings?.locale ?? "bn",
      address: (store.settings?.addressJson ?? {}) as Record<string, unknown>,
      contact: (store.settings?.contactJson ?? {}) as Record<string, unknown>,
      seo: (store.settings?.seoJson ?? {}) as Record<string, unknown>,
      checkout: (store.settings?.checkoutJson ?? {}) as Record<string, unknown>,
      policy: (store.settings?.policyJson ?? {}) as Record<string, unknown>,
    },
    tenant: store.tenant,
    host: store.domains[0]?.host ?? subdomainHost(store.slug),
    theme,
  };
}

/** Store for admin context by slug (used by super admin + support tooling). */
export async function findStoreOrThrow(storeId: string) {
  const store = await prisma.store.findFirst({ where: { id: storeId, deletedAt: null } });
  if (!store) throw new NotFoundError("Store");
  return store;
}

/**
 * Storefront resolution for custom domains: the proxy rewrites unknown hosts to
 * `/store/_host` and forwards the original host in `x-atlas-host`.
 */
export async function loadStorefrontByHost(host: string): Promise<StorefrontContext | null> {
  const { resolveStoreByHost } = await import("@/lib/services/domain-service");
  const resolved = await resolveStoreByHost(host);
  if (!resolved) return null;
  return loadStorefront(resolved.slug);
}

// ── Payment method reads ─────────────────────────────────────────────────────

/** All payment methods configured for a store (Admin → Payments). */
export async function listPaymentMethods(storeId: string) {
  return prisma.paymentMethod.findMany({
    where: { storeId },
    orderBy: { provider: "asc" },
  });
}

/**
 * Checkout options for the storefront: only enabled providers, labelled from the
 * adapter registry, with a Bengali note about whether live credentials exist.
 */
export async function storefrontPaymentOptions(storeId: string) {
  const { getPaymentAdapter } = await import("@/lib/payments");
  const methods = await prisma.paymentMethod.findMany({
    where: { storeId, isEnabled: true },
    orderBy: { provider: "asc" },
  });

  return methods.map((method) => {
    const adapter = getPaymentAdapter(method.provider);
    return {
      value: method.provider,
      label: adapter.label,
      note: adapter.isConfigured()
        ? adapter.notes
        : `${adapter.notes} (স্যান্ডবক্স মোড — লাইভ কী যোগ করলে আসল পেমেন্ট হবে)`,
    };
  });
}
