import {
  bigint,
  boolean,
  date,
  decimal,
  index,
  int,
  json,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/mysql-core";
import { COURIER_PROVIDERS, ORDER_STATUSES, PAYMENT_PROVIDERS, SUBSCRIPTION_STATUSES } from "../shared/domain";

export { COURIER_PROVIDERS, ORDER_STATUSES, PAYMENT_PROVIDERS, SUBSCRIPTION_STATUSES };

/**
 * ATLaS schema — logical blueprint from PRD §10 mapped to MySQL (TiDB).
 * Money columns are fixed precision decimal(14,2) (returned as strings), never floats.
 * Every business table carries a tenant/store scope that is derived server-side.
 */
const money = () => decimal({ precision: 14, scale: 2 });
const rate = () => decimal({ precision: 7, scale: 4 });
const createdAt = () => timestamp().defaultNow().notNull();
const updatedAt = () => timestamp().defaultNow().onUpdateNow().notNull();

/* ───────────────────────────── Identity and tenancy ───────────────────────────── */

export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  /** Legacy column from the starter; ATLaS uses its own credentials. */
  openId: varchar("openId", { length: 64 }).unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }).unique(),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
  phone: varchar({ length: 20 }).unique(),
  passwordHash: varchar({ length: 100 }),
  status: mysqlEnum(["active", "suspended", "pending_deletion", "deleted"]).default("active").notNull(),
  platformRole: mysqlEnum(["none", "super_admin", "support", "finance", "template_manager"])
    .default("none")
    .notNull(),
  phoneVerifiedAt: timestamp(),
  emailVerifiedAt: timestamp(),
  twoFactorEnabled: boolean().default(false).notNull(),
  twoFactorSecretEnc: text(),
  locale: varchar({ length: 5 }).default("en").notNull(),
});
export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

export const sessions = mysqlTable(
  "sessions",
  {
    id: varchar({ length: 32 }).primaryKey(),
    userId: int().notNull(),
    familyId: varchar({ length: 32 }).notNull(),
    refreshTokenHash: varchar({ length: 64 }).notNull(),
    prevRefreshHash: varchar({ length: 64 }),
    rotatedAt: timestamp(),
    expiresAt: timestamp().notNull(),
    revokedAt: timestamp(),
    revokeReason: varchar({ length: 64 }),
    twoFactorPassed: boolean().default(false).notNull(),
    ip: varchar({ length: 64 }),
    userAgent: varchar({ length: 512 }),
    lastUsedAt: timestamp().defaultNow().notNull(),
    createdAt: createdAt(),
  },
  t => [index("sessions_user_idx").on(t.userId)]
);

export const otpCodes = mysqlTable(
  "otp_codes",
  {
    id: int().autoincrement().primaryKey(),
    phone: varchar({ length: 20 }).notNull(),
    purpose: mysqlEnum(["verify_phone", "login", "password_reset", "customer_lookup"]).notNull(),
    codeHash: varchar({ length: 64 }).notNull(),
    attempts: int().default(0).notNull(),
    expiresAt: timestamp().notNull(),
    consumedAt: timestamp(),
    ip: varchar({ length: 64 }),
    deviceId: varchar({ length: 64 }),
    createdAt: createdAt(),
  },
  t => [index("otp_phone_idx").on(t.phone, t.purpose)]
);

export const loginEvents = mysqlTable(
  "login_events",
  {
    id: int().autoincrement().primaryKey(),
    userId: int(),
    identifier: varchar({ length: 320 }),
    method: mysqlEnum(["password", "otp", "refresh", "two_factor", "logout", "otp_request"]).notNull(),
    success: boolean().notNull(),
    reason: varchar({ length: 128 }),
    suspicious: boolean().default(false).notNull(),
    ip: varchar({ length: 64 }),
    userAgent: varchar({ length: 512 }),
    createdAt: createdAt(),
  },
  t => [index("login_events_created_idx").on(t.createdAt), index("login_events_user_idx").on(t.userId)]
);

export const tenants = mysqlTable("tenants", {
  id: int().autoincrement().primaryKey(),
  name: varchar({ length: 160 }).notNull(),
  ownerUserId: int().notNull(),
  status: mysqlEnum(["active", "suspended", "closed"]).default("active").notNull(),
  verificationStatus: mysqlEnum(["unverified", "pending", "verified", "rejected"]).default("unverified").notNull(),
  timezone: varchar({ length: 40 }).default("Asia/Dhaka").notNull(),
  currency: varchar({ length: 3 }).default("BDT").notNull(),
  suspendedReason: varchar({ length: 255 }),
  lastActivityAt: timestamp(),
  createdAt: createdAt(),
});

export const roles = mysqlTable("roles", {
  id: int().autoincrement().primaryKey(),
  tenantId: int(),
  code: varchar({ length: 40 }).notNull(),
  name: varchar({ length: 80 }).notNull(),
  permissionsJson: json().$type<string[]>().notNull(),
  isSystem: boolean().default(false).notNull(),
});

export const memberships = mysqlTable(
  "memberships",
  {
    id: int().autoincrement().primaryKey(),
    tenantId: int().notNull(),
    userId: int(),
    roleId: int().notNull(),
    status: mysqlEnum(["invited", "active", "revoked"]).default("active").notNull(),
    inviteEmail: varchar({ length: 320 }),
    inviteTokenHash: varchar({ length: 64 }),
    invitedBy: int(),
    invitedAt: timestamp(),
    acceptedAt: timestamp(),
    createdAt: createdAt(),
  },
  t => [uniqueIndex("memberships_tenant_user_uq").on(t.tenantId, t.userId), index("memberships_user_idx").on(t.userId)]
);

export const impersonationSessions = mysqlTable("impersonation_sessions", {
  id: int().autoincrement().primaryKey(),
  adminUserId: int().notNull(),
  tenantId: int().notNull(),
  reason: varchar({ length: 255 }).notNull(),
  ticketRef: varchar({ length: 80 }).notNull(),
  startedAt: timestamp().defaultNow().notNull(),
  expiresAt: timestamp().notNull(),
  endedAt: timestamp(),
});

export const accountDeletionRequests = mysqlTable("account_deletion_requests", {
  id: int().autoincrement().primaryKey(),
  userId: int().notNull(),
  reason: text(),
  status: mysqlEnum(["requested", "cancelled", "completed"]).default("requested").notNull(),
  scheduledFor: timestamp().notNull(),
  createdAt: createdAt(),
});

/* ───────────────────────────── Store and theme ───────────────────────────── */

export const stores = mysqlTable(
  "stores",
  {
    id: int().autoincrement().primaryKey(),
    tenantId: int().notNull(),
    name: varchar({ length: 160 }).notNull(),
    slug: varchar({ length: 63 }).notNull().unique(),
    description: text(),
    category: varchar({ length: 60 }),
    logoAssetId: int(),
    logoUrl: varchar({ length: 512 }),
    brandColorsJson: json().$type<{ primary: string; secondary: string }>(),
    status: mysqlEnum(["draft", "published", "maintenance", "suspended"]).default("draft").notNull(),
    orderSeq: int().default(1000).notNull(),
    publishedAt: timestamp(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  t => [index("stores_tenant_idx").on(t.tenantId)]
);

export type StoreAddress = { line1?: string; area?: string; district?: string; postcode?: string };
export type StoreContact = { phone?: string; email?: string; whatsapp?: string; facebook?: string };
export const storeSettings = mysqlTable("store_settings", {
  storeId: int().primaryKey(),
  locale: varchar({ length: 5 }).default("bn").notNull(),
  addressJson: json().$type<StoreAddress>(),
  contactJson: json().$type<StoreContact>(),
  seoJson: json().$type<{ title?: string; description?: string; ogImage?: string }>(),
  checkoutJson: json().$type<{ guestCheckout: boolean; codEnabled: boolean; orderNoteEnabled: boolean; minOrder?: number }>(),
  taxJson: json().$type<{ enabled: boolean; ratePercent: number; inclusive: boolean; label: string }>(),
  notificationsJson: json().$type<Record<string, boolean>>(),
  onboardingJson: json().$type<Record<string, boolean>>(),
  scheduledExport: varchar({ length: 20 }),
});

export const themes = mysqlTable("themes", {
  id: int().autoincrement().primaryKey(),
  code: varchar({ length: 40 }).notNull().unique(),
  name: varchar({ length: 80 }).notNull(),
  description: text(),
  industry: varchar({ length: 60 }),
  styleTagsJson: json().$type<string[]>(),
  tier: mysqlEnum(["starter", "curated", "standard", "pro_exclusive"]).notNull(),
  previewImageUrl: varchar({ length: 512 }),
  status: mysqlEnum(["draft", "active", "deprecated"]).default("active").notNull(),
  sortOrder: int().default(0).notNull(),
  createdAt: createdAt(),
});

export const themeVersions = mysqlTable(
  "theme_versions",
  {
    id: int().autoincrement().primaryKey(),
    themeId: int().notNull(),
    version: varchar({ length: 20 }).notNull(),
    configSchemaJson: json().$type<Record<string, unknown>>().notNull(),
    defaultConfigJson: json().$type<Record<string, unknown>>().notNull(),
    compatiblePlansJson: json().$type<string[]>().notNull(),
    assetManifestJson: json().$type<{ sections: string[]; fonts?: string[] }>().notNull(),
    status: mysqlEnum(["draft", "published", "deprecated"]).default("draft").notNull(),
    changelog: text(),
    createdAt: createdAt(),
  },
  t => [uniqueIndex("theme_versions_uq").on(t.themeId, t.version)]
);

export const storeThemes = mysqlTable(
  "store_themes",
  {
    id: int().autoincrement().primaryKey(),
    storeId: int().notNull(),
    themeVersionId: int().notNull(),
    draftConfigJson: json().$type<Record<string, unknown>>().notNull(),
    publishedConfigJson: json().$type<Record<string, unknown>>(),
    isSelected: boolean().default(false).notNull(),
    lockedUntil: timestamp(),
    publishedAt: timestamp(),
    draftUpdatedAt: timestamp(),
    createdAt: createdAt(),
  },
  t => [index("store_themes_store_idx").on(t.storeId)]
);

export const contentPages = mysqlTable(
  "content_pages",
  {
    id: int().autoincrement().primaryKey(),
    storeId: int().notNull(),
    slug: varchar({ length: 80 }).notNull(),
    title: varchar({ length: 160 }).notNull(),
    bodyJson: json().$type<{ en: string; bn?: string }>().notNull(),
    type: mysqlEnum(["policy", "page"]).default("page").notNull(),
    status: mysqlEnum(["draft", "published"]).default("published").notNull(),
    updatedAt: updatedAt(),
  },
  t => [uniqueIndex("content_pages_uq").on(t.storeId, t.slug)]
);

export const domains = mysqlTable(
  "domains",
  {
    id: int().autoincrement().primaryKey(),
    tenantId: int().notNull(),
    storeId: int().notNull(),
    host: varchar({ length: 253 }).notNull().unique(),
    type: mysqlEnum(["subdomain", "custom"]).notNull(),
    verificationToken: varchar({ length: 64 }),
    verificationStatus: mysqlEnum(["pending", "verified", "active", "failed", "suspended"]).default("pending").notNull(),
    tlsStatus: mysqlEnum(["none", "pending", "issued", "failed"]).default("none").notNull(),
    isPrimary: boolean().default(false).notNull(),
    lastCheckedAt: timestamp(),
    lastError: varchar({ length: 255 }),
    verifiedAt: timestamp(),
    createdAt: createdAt(),
  },
  t => [index("domains_store_idx").on(t.storeId)]
);

/* ───────────────────────────── Catalog and inventory ───────────────────────────── */

export const categories = mysqlTable(
  "categories",
  {
    id: int().autoincrement().primaryKey(),
    storeId: int().notNull(),
    parentId: int(),
    name: varchar({ length: 120 }).notNull(),
    nameBn: varchar({ length: 120 }),
    slug: varchar({ length: 120 }).notNull(),
    imageUrl: varchar({ length: 512 }),
    sortOrder: int().default(0).notNull(),
    status: mysqlEnum(["active", "hidden"]).default("active").notNull(),
  },
  t => [uniqueIndex("categories_uq").on(t.storeId, t.slug)]
);

export const products = mysqlTable(
  "products",
  {
    id: int().autoincrement().primaryKey(),
    storeId: int().notNull(),
    categoryId: int(),
    name: varchar({ length: 200 }).notNull(),
    nameBn: varchar({ length: 200 }),
    slug: varchar({ length: 200 }).notNull(),
    descriptionJson: json().$type<{ en: string; bn?: string }>(),
    status: mysqlEnum(["draft", "active", "archived"]).default("active").notNull(),
    tagsJson: json().$type<string[]>(),
    seoJson: json().$type<{ title?: string; description?: string; ogImage?: string }>(),
    optionNamesJson: json().$type<string[]>(),
    lowStockThreshold: int().default(5).notNull(),
    featured: boolean().default(false).notNull(),
    deletedAt: timestamp(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  t => [uniqueIndex("products_store_slug_uq").on(t.storeId, t.slug), index("products_store_status_idx").on(t.storeId, t.status)]
);

export const productVariants = mysqlTable(
  "product_variants",
  {
    id: int().autoincrement().primaryKey(),
    productId: int().notNull(),
    storeId: int().notNull(),
    sku: varchar({ length: 80 }),
    optionValuesJson: json().$type<Record<string, string>>(),
    price: money().notNull(),
    comparePrice: money(),
    stockQty: int().default(0).notNull(),
    reservedQty: int().default(0).notNull(),
    isDefault: boolean().default(false).notNull(),
    status: mysqlEnum(["active", "inactive"]).default("active").notNull(),
  },
  t => [index("variants_product_idx").on(t.productId), uniqueIndex("variants_store_sku_uq").on(t.storeId, t.sku)]
);

export const productImages = mysqlTable(
  "product_images",
  {
    id: int().autoincrement().primaryKey(),
    productId: int().notNull(),
    assetId: int(),
    url: varchar({ length: 512 }).notNull(),
    sortOrder: int().default(0).notNull(),
    altText: varchar({ length: 200 }),
  },
  t => [index("product_images_product_idx").on(t.productId)]
);

export const inventoryMovements = mysqlTable(
  "inventory_movements",
  {
    id: int().autoincrement().primaryKey(),
    storeId: int().notNull(),
    variantId: int().notNull(),
    type: mysqlEnum(["initial", "adjustment", "sale", "reserve", "release", "cancel_restock", "return", "import"]).notNull(),
    quantityDelta: int().notNull(),
    affects: mysqlEnum(["stock", "reserved"]).default("stock").notNull(),
    balanceAfter: int(),
    reason: varchar({ length: 255 }),
    referenceType: varchar({ length: 40 }),
    referenceId: varchar({ length: 40 }),
    actorId: int(),
    createdAt: createdAt(),
  },
  t => [index("inv_mov_store_idx").on(t.storeId, t.createdAt), index("inv_mov_variant_idx").on(t.variantId)]
);

export const assets = mysqlTable(
  "assets",
  {
    id: int().autoincrement().primaryKey(),
    tenantId: int(),
    storeId: int(),
    objectKey: varchar({ length: 512 }).notNull(),
    url: varchar({ length: 600 }).notNull(),
    mimeType: varchar({ length: 100 }).notNull(),
    sizeBytes: bigint({ mode: "number" }).notNull(),
    checksum: varchar({ length: 64 }),
    kind: mysqlEnum(["product_image", "logo", "theme_asset", "export", "other"]).default("other").notNull(),
    metadataJson: json().$type<Record<string, unknown>>(),
    deletedAt: timestamp(),
    createdAt: createdAt(),
  },
  t => [index("assets_tenant_idx").on(t.tenantId)]
);

/* ───────────────────────────── Orders and customers ───────────────────────────── */

export type Address = { name?: string; phone?: string; line1: string; area?: string; district: string; postcode?: string };
export const customers = mysqlTable(
  "customers",
  {
    id: int().autoincrement().primaryKey(),
    storeId: int().notNull(),
    name: varchar({ length: 160 }).notNull(),
    phone: varchar({ length: 20 }).notNull(),
    email: varchar({ length: 320 }),
    addressJson: json().$type<Address>(),
    consentJson: json().$type<{ marketing: boolean; updatedAt: string; source?: string }>(),
    status: mysqlEnum(["active", "blacklisted"]).default("active").notNull(),
    blacklistReason: varchar({ length: 255 }),
    tagsJson: json().$type<string[]>(),
    notes: text(),
    totalOrders: int().default(0).notNull(),
    totalSpent: money().default("0.00").notNull(),
    lastOrderAt: timestamp(),
    createdAt: createdAt(),
  },
  t => [uniqueIndex("customers_store_phone_uq").on(t.storeId, t.phone)]
);

export const carts = mysqlTable(
  "carts",
  {
    id: int().autoincrement().primaryKey(),
    storeId: int().notNull(),
    customerId: int(),
    sessionKey: varchar({ length: 64 }).notNull(),
    status: mysqlEnum(["active", "converted", "abandoned"]).default("active").notNull(),
    expiresAt: timestamp().notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  t => [uniqueIndex("carts_session_uq").on(t.storeId, t.sessionKey)]
);

export const cartItems = mysqlTable(
  "cart_items",
  {
    id: int().autoincrement().primaryKey(),
    cartId: int().notNull(),
    variantId: int().notNull(),
    quantity: int().notNull(),
    unitPriceSnapshot: money().notNull(),
  },
  t => [uniqueIndex("cart_items_uq").on(t.cartId, t.variantId)]
);

export const orders = mysqlTable(
  "orders",
  {
    id: int().autoincrement().primaryKey(),
    storeId: int().notNull(),
    tenantId: int().notNull(),
    orderNo: varchar({ length: 24 }).notNull(),
    customerId: int(),
    status: mysqlEnum(ORDER_STATUSES).default("PENDING_PAYMENT").notNull(),
    paymentStatus: mysqlEnum(["unpaid", "pending", "paid", "failed", "refunded", "partially_refunded", "cod_pending", "cod_collected"])
      .default("unpaid")
      .notNull(),
    fulfillmentStatus: mysqlEnum(["unfulfilled", "packed", "shipped", "delivered", "returned", "cancelled"])
      .default("unfulfilled")
      .notNull(),
    paymentMethod: varchar({ length: 20 }).notNull(),
    subtotal: money().notNull(),
    discountTotal: money().default("0.00").notNull(),
    shippingTotal: money().default("0.00").notNull(),
    taxTotal: money().default("0.00").notNull(),
    grandTotal: money().notNull(),
    refundedTotal: money().default("0.00").notNull(),
    currency: varchar({ length: 3 }).default("BDT").notNull(),
    couponCode: varchar({ length: 40 }),
    customerSnapshotJson: json().$type<{ name: string; phone: string; email?: string }>().notNull(),
    addressSnapshotJson: json().$type<Address>().notNull(),
    deliverySnapshotJson: json().$type<{ zoneId?: number; zoneName: string; charge: string; eta?: string }>(),
    taxSnapshotJson: json().$type<{ ratePercent: number; inclusive: boolean; label: string }>(),
    customerNote: text(),
    idempotencyKey: varchar({ length: 80 }),
    accessToken: varchar({ length: 48 }).notNull(),
    stockCommitted: boolean().default(false).notNull(),
    feeEligibleAt: timestamp(),
    source: mysqlEnum(["storefront", "admin", "api"]).default("storefront").notNull(),
    locale: varchar({ length: 5 }).default("bn").notNull(),
    cancelledAt: timestamp(),
    deliveredAt: timestamp(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  t => [
    uniqueIndex("orders_store_no_uq").on(t.storeId, t.orderNo),
    uniqueIndex("orders_idem_uq").on(t.storeId, t.idempotencyKey),
    index("orders_store_status_idx").on(t.storeId, t.status, t.createdAt),
    index("orders_tenant_created_idx").on(t.tenantId, t.createdAt),
  ]
);

export const orderItems = mysqlTable(
  "order_items",
  {
    id: int().autoincrement().primaryKey(),
    orderId: int().notNull(),
    productId: int().notNull(),
    variantId: int().notNull(),
    nameSnapshot: varchar({ length: 200 }).notNull(),
    skuSnapshot: varchar({ length: 80 }),
    variantSnapshot: varchar({ length: 200 }),
    imageSnapshot: varchar({ length: 512 }),
    quantity: int().notNull(),
    unitPrice: money().notNull(),
    discountTotal: money().default("0.00").notNull(),
    lineTotal: money().notNull(),
    refundedQty: int().default(0).notNull(),
  },
  t => [index("order_items_order_idx").on(t.orderId)]
);

export const orderEvents = mysqlTable(
  "order_events",
  {
    id: int().autoincrement().primaryKey(),
    orderId: int().notNull(),
    eventType: mysqlEnum(["status_change", "note", "payment", "shipment", "refund", "created"]).notNull(),
    fromStatus: varchar({ length: 24 }),
    toStatus: varchar({ length: 24 }),
    actorType: mysqlEnum(["customer", "merchant", "system", "admin", "gateway", "courier", "api"]).notNull(),
    actorId: int(),
    note: text(),
    createdAt: createdAt(),
  },
  t => [index("order_events_order_idx").on(t.orderId)]
);

export const returns = mysqlTable("returns", {
  id: int().autoincrement().primaryKey(),
  orderId: int().notNull(),
  storeId: int().notNull(),
  status: mysqlEnum(["requested", "approved", "rejected", "received"]).default("requested").notNull(),
  reason: text(),
  requestedAt: timestamp().defaultNow().notNull(),
  resolvedAt: timestamp(),
});

export const refundRequests = mysqlTable(
  "refund_requests",
  {
    id: int().autoincrement().primaryKey(),
    orderId: int().notNull(),
    storeId: int().notNull(),
    tenantId: int().notNull(),
    amount: money().notNull(),
    isFull: boolean().notNull(),
    itemsJson: json().$type<{ orderItemId: number; quantity: number }[]>(),
    reason: text(),
    method: varchar({ length: 20 }).notNull(),
    status: mysqlEnum(["requested", "processed", "rejected", "failed"]).default("requested").notNull(),
    providerRefundId: varchar({ length: 80 }),
    requestedBy: int(),
    reviewedBy: int(),
    createdAt: createdAt(),
    processedAt: timestamp(),
  },
  t => [index("refunds_store_idx").on(t.storeId)]
);

export const coupons = mysqlTable(
  "coupons",
  {
    id: int().autoincrement().primaryKey(),
    storeId: int().notNull(),
    code: varchar({ length: 40 }).notNull(),
    type: mysqlEnum(["percentage", "fixed"]).notNull(),
    value: money().notNull(),
    minOrder: money(),
    maxDiscount: money(),
    usageLimit: int(),
    usedCount: int().default(0).notNull(),
    perCustomerLimit: int(),
    firstOrderOnly: boolean().default(false).notNull(),
    categoryIdsJson: json().$type<number[]>(),
    startsAt: timestamp(),
    endsAt: timestamp(),
    status: mysqlEnum(["active", "inactive"]).default("active").notNull(),
    createdAt: createdAt(),
  },
  t => [uniqueIndex("coupons_store_code_uq").on(t.storeId, t.code)]
);

export const couponRedemptions = mysqlTable(
  "coupon_redemptions",
  {
    id: int().autoincrement().primaryKey(),
    couponId: int().notNull(),
    orderId: int().notNull(),
    customerPhone: varchar({ length: 20 }).notNull(),
    amount: money().notNull(),
    voided: boolean().default(false).notNull(),
    createdAt: createdAt(),
  },
  t => [index("coupon_red_coupon_idx").on(t.couponId)]
);

/* ───────────────────────────── Delivery and couriers ───────────────────────────── */

export const deliveryZones = mysqlTable("delivery_zones", {
  id: int().autoincrement().primaryKey(),
  storeId: int().notNull(),
  name: varchar({ length: 80 }).notNull(),
  nameBn: varchar({ length: 80 }),
  districtsJson: json().$type<string[]>().notNull(),
  charge: money().notNull(),
  freeAbove: money(),
  etaText: varchar({ length: 60 }),
  sortOrder: int().default(0).notNull(),
  status: mysqlEnum(["active", "inactive"]).default("active").notNull(),
});

export const courierConnections = mysqlTable("courier_connections", {
  id: int().autoincrement().primaryKey(),
  storeId: int().notNull(),
  tenantId: int().notNull(),
  provider: mysqlEnum(COURIER_PROVIDERS).notNull(),
  isThirdParty: boolean().notNull(),
  publicConfigJson: json().$type<Record<string, string>>(),
  encryptedCredentials: text(),
  status: mysqlEnum(["connected", "disconnected", "error"]).default("connected").notNull(),
  createdAt: createdAt(),
});

export const shipments = mysqlTable(
  "shipments",
  {
    id: int().autoincrement().primaryKey(),
    orderId: int().notNull(),
    storeId: int().notNull(),
    provider: mysqlEnum(COURIER_PROVIDERS).notNull(),
    consignmentId: varchar({ length: 80 }),
    trackingCode: varchar({ length: 80 }),
    status: mysqlEnum(["created", "picked_up", "in_transit", "delivered", "returned", "cancelled"]).default("created").notNull(),
    codAmount: money().default("0.00").notNull(),
    charge: money().default("0.00").notNull(),
    eventsJson: json().$type<{ status: string; at: string; note?: string }[]>(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  t => [index("shipments_order_idx").on(t.orderId), index("shipments_tracking_idx").on(t.trackingCode)]
);

/* ───────────────────────────── Payments, billing and fees ───────────────────────────── */

export const paymentMethods = mysqlTable(
  "payment_methods",
  {
    id: int().autoincrement().primaryKey(),
    storeId: int().notNull(),
    provider: mysqlEnum(PAYMENT_PROVIDERS).notNull(),
    mode: mysqlEnum(["sandbox", "live"]).default("sandbox").notNull(),
    publicConfigJson: json().$type<Record<string, string>>(),
    encryptedSecretRef: text(),
    status: mysqlEnum(["active", "inactive"]).default("active").notNull(),
    createdAt: createdAt(),
  },
  t => [uniqueIndex("payment_methods_uq").on(t.storeId, t.provider)]
);

export const payments = mysqlTable(
  "payments",
  {
    id: int().autoincrement().primaryKey(),
    scope: mysqlEnum(["order", "platform_invoice"]).notNull(),
    tenantId: int().notNull(),
    storeId: int(),
    orderId: int(),
    invoiceId: int(),
    provider: mysqlEnum(PAYMENT_PROVIDERS).notNull(),
    reference: varchar({ length: 40 }).notNull().unique(),
    providerTxnId: varchar({ length: 80 }),
    amount: money().notNull(),
    feeAmount: money().default("0.00").notNull(),
    status: mysqlEnum(["initiated", "pending", "succeeded", "failed", "expired", "refunded", "cancelled"]).default("initiated").notNull(),
    failureReason: varchar({ length: 255 }),
    idempotencyKey: varchar({ length: 80 }),
    rawReference: json().$type<Record<string, unknown>>(),
    settlementStatus: mysqlEnum(["unsettled", "settled", "not_applicable"]).default("unsettled").notNull(),
    settledAt: timestamp(),
    expiresAt: timestamp(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  t => [index("payments_order_idx").on(t.orderId), index("payments_tenant_idx").on(t.tenantId, t.createdAt), uniqueIndex("payments_idem_uq").on(t.idempotencyKey)]
);

export const paymentWebhookEvents = mysqlTable(
  "payment_webhook_events",
  {
    id: int().autoincrement().primaryKey(),
    provider: varchar({ length: 20 }).notNull(),
    eventKey: varchar({ length: 120 }).notNull(),
    signatureValid: boolean().notNull(),
    payloadHash: varchar({ length: 64 }).notNull(),
    payloadJson: json().$type<Record<string, unknown>>(),
    paymentReference: varchar({ length: 40 }),
    status: mysqlEnum(["received", "processed", "duplicate", "rejected", "failed", "ignored"]).default("received").notNull(),
    error: varchar({ length: 255 }),
    processedAt: timestamp(),
    createdAt: createdAt(),
  },
  t => [uniqueIndex("pwe_provider_event_uq").on(t.provider, t.eventKey), index("pwe_created_idx").on(t.createdAt)]
);

/** Ledger of the sandbox gateways (acts as the provider side for reconciliation). */
export const sandboxGatewayTransactions = mysqlTable("sandbox_gateway_transactions", {
  id: int().autoincrement().primaryKey(),
  provider: varchar({ length: 20 }).notNull(),
  reference: varchar({ length: 40 }).notNull().unique(),
  providerTxnId: varchar({ length: 80 }).notNull(),
  amount: money().notNull(),
  status: mysqlEnum(["pending", "succeeded", "failed", "cancelled", "refunded"]).default("pending").notNull(),
  callbackUrl: varchar({ length: 512 }),
  merchantName: varchar({ length: 160 }),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export type PlanLimits = {
  products: number | null;
  monthlyOrdersIncluded: number | null;
  overageRatePercent: number;
  storageMB: number | null;
  staffSeats: number;
  themeTier: "starter" | "curated" | "standard" | "all";
  themeSwitching: "starter_only" | "locked" | "allowed";
  customDomain: boolean;
  customDomainWithSubdomain: boolean;
  couponLevel: "basic" | "advanced";
  reportsLevel: "basic" | "csv" | "advanced" | "advanced_scheduled";
  courierLevel: "manual" | "third_party" | "more" | "all";
  maxCourierConnections: number | null;
  apiAccess: "read_public" | "api_webhooks" | "full" | "full_plus";
  apiRateLimitPerMin: number;
  support: "community" | "standard" | "priority" | "priority_onboarding";
  twoFactor: boolean;
  yearlyBilling: boolean;
  bulkTools: boolean;
  trialDays: number;
};

export const plans = mysqlTable("plans", {
  id: int().autoincrement().primaryKey(),
  code: varchar({ length: 20 }).notNull().unique(),
  name: varchar({ length: 60 }).notNull(),
  tagline: varchar({ length: 160 }),
  priceMonthly: money().notNull(),
  priceYearly: money().notNull(),
  limitsJson: json().$type<PlanLimits>().notNull(),
  featuresJson: json().$type<string[]>().notNull(),
  status: mysqlEnum(["active", "hidden"]).default("active").notNull(),
  sortOrder: int().default(0).notNull(),
  updatedAt: updatedAt(),
});
export type Plan = typeof plans.$inferSelect;

export const subscriptions = mysqlTable(
  "subscriptions",
  {
    id: int().autoincrement().primaryKey(),
    tenantId: int().notNull(),
    planId: int().notNull(),
    trialPlanId: int(),
    pendingPlanId: int(),
    pendingCycle: mysqlEnum(["monthly", "yearly"]),
    billingCycle: mysqlEnum(["monthly", "yearly"]).default("monthly").notNull(),
    status: mysqlEnum(SUBSCRIPTION_STATUSES).notNull(),
    isCurrent: boolean().default(true).notNull(),
    trialEnd: timestamp(),
    currentPeriodStart: timestamp().notNull(),
    currentPeriodEnd: timestamp().notNull(),
    cancelAtPeriodEnd: boolean().default(false).notNull(),
    autoRenew: boolean().default(true).notNull(),
    savedMethodJson: json().$type<{ provider: string; label: string; token: string }>(),
    pastDueSince: timestamp(),
    retryCount: int().default(0).notNull(),
    nextRetryAt: timestamp(),
    cancelledAt: timestamp(),
    remindersSentJson: json().$type<string[]>(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  t => [index("subs_tenant_idx").on(t.tenantId, t.isCurrent), index("subs_status_idx").on(t.status)]
);
export type Subscription = typeof subscriptions.$inferSelect;

export const invoices = mysqlTable(
  "invoices",
  {
    id: int().autoincrement().primaryKey(),
    tenantId: int().notNull(),
    subscriptionId: int(),
    number: varchar({ length: 32 }).notNull().unique(),
    kind: mysqlEnum(["subscription", "renewal", "usage", "upgrade"]).notNull(),
    planId: int(),
    billingCycle: mysqlEnum(["monthly", "yearly"]),
    periodStart: timestamp(),
    periodEnd: timestamp(),
    subtotal: money().notNull(),
    discount: money().default("0.00").notNull(),
    tax: money().default("0.00").notNull(),
    total: money().notNull(),
    status: mysqlEnum(["draft", "open", "paid", "void", "uncollectible"]).default("open").notNull(),
    dueAt: timestamp().notNull(),
    paidAt: timestamp(),
    createdAt: createdAt(),
  },
  t => [index("invoices_tenant_idx").on(t.tenantId, t.createdAt)]
);

export const invoiceLines = mysqlTable(
  "invoice_lines",
  {
    id: int().autoincrement().primaryKey(),
    invoiceId: int().notNull(),
    type: mysqlEnum(["subscription", "order_overage", "courier_payment_charge", "reversal", "adjustment"]).notNull(),
    description: varchar({ length: 255 }).notNull(),
    orderId: int(),
    orderNo: varchar({ length: 24 }),
    feeLedgerId: int(),
    baseAmount: money(),
    rate: rate(),
    amount: money().notNull(),
  },
  t => [index("invoice_lines_invoice_idx").on(t.invoiceId)]
);

export const usageCounters = mysqlTable(
  "usage_counters",
  {
    id: int().autoincrement().primaryKey(),
    tenantId: int().notNull(),
    metric: varchar({ length: 40 }).notNull(),
    periodStart: date({ mode: "string" }).notNull(),
    periodEnd: date({ mode: "string" }).notNull(),
    quantity: bigint({ mode: "number" }).default(0).notNull(),
    updatedAt: updatedAt(),
  },
  t => [uniqueIndex("usage_uq").on(t.tenantId, t.metric, t.periodStart)]
);

export const feeLedger = mysqlTable(
  "fee_ledger",
  {
    id: int().autoincrement().primaryKey(),
    tenantId: int().notNull(),
    storeId: int().notNull(),
    orderId: int(),
    orderNo: varchar({ length: 24 }),
    feeType: mysqlEnum(["order_overage", "courier_payment_charge", "reversal"]).notNull(),
    reversesId: int(),
    baseAmount: money().notNull(),
    rate: rate().notNull(),
    feeAmount: money().notNull(),
    status: mysqlEnum(["pending", "invoiced", "paid", "void"]).default("pending").notNull(),
    voidReason: varchar({ length: 255 }),
    invoiceId: int(),
    periodStart: date({ mode: "string" }).notNull(),
    createdAt: createdAt(),
  },
  t => [index("fee_tenant_idx").on(t.tenantId, t.status), uniqueIndex("fee_order_type_uq").on(t.orderId, t.feeType, t.reversesId)]
);

/* ───────────────────────────── Audit and operations ───────────────────────────── */

export const auditLogs = mysqlTable(
  "audit_logs",
  {
    id: int().autoincrement().primaryKey(),
    tenantId: int(),
    actorId: int(),
    actorType: varchar({ length: 20 }).notNull(),
    impersonationId: int(),
    action: varchar({ length: 80 }).notNull(),
    resourceType: varchar({ length: 40 }),
    resourceId: varchar({ length: 40 }),
    metadataJson: json().$type<Record<string, unknown>>(),
    ip: varchar({ length: 64 }),
    createdAt: createdAt(),
  },
  t => [index("audit_tenant_idx").on(t.tenantId, t.createdAt), index("audit_created_idx").on(t.createdAt)]
);

export const notifications = mysqlTable(
  "notifications",
  {
    id: int().autoincrement().primaryKey(),
    userId: int().notNull(),
    tenantId: int(),
    type: varchar({ length: 60 }).notNull(),
    title: varchar({ length: 200 }).notNull(),
    body: text(),
    link: varchar({ length: 255 }),
    payloadJson: json().$type<Record<string, unknown>>(),
    dedupeKey: varchar({ length: 160 }).unique(),
    readAt: timestamp(),
    createdAt: createdAt(),
  },
  t => [index("notifications_user_idx").on(t.userId, t.createdAt)]
);

export const outboundMessages = mysqlTable(
  "outbound_messages",
  {
    id: int().autoincrement().primaryKey(),
    tenantId: int(),
    channel: mysqlEnum(["sms", "email", "whatsapp"]).notNull(),
    recipient: varchar({ length: 320 }).notNull(),
    subject: varchar({ length: 200 }),
    body: text().notNull(),
    template: varchar({ length: 60 }).notNull(),
    provider: varchar({ length: 40 }).notNull(),
    deviceId: varchar({ length: 64 }),
    status: mysqlEnum(["queued", "sent", "failed"]).default("sent").notNull(),
    error: varchar({ length: 255 }),
    createdAt: createdAt(),
  },
  t => [index("outbound_recipient_idx").on(t.recipient, t.createdAt), index("outbound_device_idx").on(t.deviceId)]
);

export const supportTickets = mysqlTable(
  "support_tickets",
  {
    id: int().autoincrement().primaryKey(),
    tenantId: int(),
    requesterId: int(),
    requesterName: varchar({ length: 160 }),
    requesterEmail: varchar({ length: 320 }),
    requesterPhone: varchar({ length: 20 }),
    category: varchar({ length: 40 }).default("general").notNull(),
    priority: mysqlEnum(["low", "normal", "high", "urgent"]).default("normal").notNull(),
    status: mysqlEnum(["open", "pending", "resolved", "closed"]).default("open").notNull(),
    subject: varchar({ length: 200 }).notNull(),
    body: text().notNull(),
    assignedTo: int(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  t => [index("tickets_tenant_idx").on(t.tenantId)]
);

export const ticketMessages = mysqlTable("ticket_messages", {
  id: int().autoincrement().primaryKey(),
  ticketId: int().notNull(),
  authorId: int(),
  authorType: mysqlEnum(["merchant", "staff", "guest"]).notNull(),
  body: text().notNull(),
  createdAt: createdAt(),
});

export const announcements = mysqlTable("announcements", {
  id: int().autoincrement().primaryKey(),
  title: varchar({ length: 160 }).notNull(),
  body: text().notNull(),
  audience: mysqlEnum(["all", "free", "paid"]).default("all").notNull(),
  level: mysqlEnum(["info", "warning", "success"]).default("info").notNull(),
  status: mysqlEnum(["draft", "published", "archived"]).default("published").notNull(),
  startsAt: timestamp(),
  endsAt: timestamp(),
  createdBy: int(),
  createdAt: createdAt(),
});

export const apiKeys = mysqlTable("api_keys", {
  id: int().autoincrement().primaryKey(),
  tenantId: int().notNull(),
  storeId: int().notNull(),
  name: varchar({ length: 80 }).notNull(),
  prefix: varchar({ length: 24 }).notNull().unique(),
  keyHash: varchar({ length: 64 }).notNull(),
  scopesJson: json().$type<string[]>().notNull(),
  lastUsedAt: timestamp(),
  revokedAt: timestamp(),
  createdBy: int(),
  createdAt: createdAt(),
});

export const webhookEndpoints = mysqlTable("webhook_endpoints", {
  id: int().autoincrement().primaryKey(),
  tenantId: int().notNull(),
  storeId: int().notNull(),
  url: varchar({ length: 512 }).notNull(),
  eventsJson: json().$type<string[]>().notNull(),
  secretEnc: text().notNull(),
  status: mysqlEnum(["active", "disabled"]).default("active").notNull(),
  createdAt: createdAt(),
});

export const webhookDeliveries = mysqlTable(
  "webhook_deliveries",
  {
    id: int().autoincrement().primaryKey(),
    tenantId: int().notNull(),
    endpointId: int().notNull(),
    eventType: varchar({ length: 60 }).notNull(),
    endpoint: varchar({ length: 512 }).notNull(),
    payloadHash: varchar({ length: 64 }).notNull(),
    payloadJson: json().$type<Record<string, unknown>>().notNull(),
    status: mysqlEnum(["pending", "delivered", "failed", "dead"]).default("pending").notNull(),
    attempts: int().default(0).notNull(),
    lastStatusCode: int(),
    lastError: varchar({ length: 255 }),
    nextRetryAt: timestamp(),
    createdAt: createdAt(),
  },
  t => [index("wh_deliveries_tenant_idx").on(t.tenantId, t.createdAt)]
);

export const analyticsEvents = mysqlTable(
  "analytics_events",
  {
    id: int().autoincrement().primaryKey(),
    event: varchar({ length: 40 }).notNull(),
    tenantId: int(),
    storeId: int(),
    userId: int(),
    propertiesJson: json().$type<Record<string, unknown>>(),
    createdAt: createdAt(),
  },
  t => [index("analytics_event_idx").on(t.event, t.createdAt), index("analytics_tenant_idx").on(t.tenantId)]
);

export const jobs = mysqlTable(
  "jobs",
  {
    id: int().autoincrement().primaryKey(),
    type: varchar({ length: 40 }).notNull(),
    tenantId: int(),
    payloadJson: json().$type<Record<string, unknown>>().notNull(),
    status: mysqlEnum(["queued", "running", "succeeded", "failed", "dead"]).default("queued").notNull(),
    attempts: int().default(0).notNull(),
    maxAttempts: int().default(5).notNull(),
    runAt: timestamp().defaultNow().notNull(),
    lockedAt: timestamp(),
    lastError: text(),
    resultJson: json().$type<Record<string, unknown>>(),
    dedupeKey: varchar({ length: 160 }).unique(),
    createdBy: int(),
    finishedAt: timestamp(),
    createdAt: createdAt(),
  },
  t => [index("jobs_status_run_idx").on(t.status, t.runAt), index("jobs_tenant_idx").on(t.tenantId)]
);

export const dailyStoreMetrics = mysqlTable(
  "daily_store_metrics",
  {
    id: int().autoincrement().primaryKey(),
    tenantId: int().notNull(),
    storeId: int().notNull(),
    date: date({ mode: "string" }).notNull(),
    orders: int().default(0).notNull(),
    eligibleOrders: int().default(0).notNull(),
    cancelledOrders: int().default(0).notNull(),
    revenue: money().default("0.00").notNull(),
    onlineRevenue: money().default("0.00").notNull(),
    codRevenue: money().default("0.00").notNull(),
    itemsSold: int().default(0).notNull(),
    newCustomers: int().default(0).notNull(),
    updatedAt: updatedAt(),
  },
  t => [uniqueIndex("dsm_uq").on(t.storeId, t.date)]
);

export const platformSettings = mysqlTable("platform_settings", {
  key: varchar({ length: 80 }).primaryKey(),
  valueJson: json().$type<unknown>().notNull(),
  updatedAt: updatedAt(),
});

export const rateLimitEvents = mysqlTable(
  "rate_limit_events",
  {
    id: int().autoincrement().primaryKey(),
    scope: varchar({ length: 40 }).notNull(),
    key: varchar({ length: 160 }).notNull(),
    ip: varchar({ length: 64 }),
    createdAt: createdAt(),
  },
  t => [index("rl_created_idx").on(t.createdAt)]
);
