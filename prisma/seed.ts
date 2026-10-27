import "dotenv/config";
import { addDays, startOfMonth } from "date-fns";
import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { hashPassword } from "@/lib/auth/password";
import { normalizePhone } from "@/lib/auth/otp";
import {
  PERMISSIONS,
  ROLE_CODES,
  SYSTEM_ROLES,
  type ActorContext,
  type RoleCode,
} from "@/lib/rbac";
import { PLAN_CODES, PLAN_DEFINITIONS } from "@/lib/plans";
import { monthBounds } from "@/lib/dates";
import { invalidateEntitlements } from "@/lib/entitlements";
import { toDecimalString } from "@/lib/money";
import { ensureThemeCatalog } from "@/lib/services/theme-service";
import { ensureSubscription } from "@/lib/services/billing-service";
import { createStore, publishStore, togglePaymentMethod, updateStoreSettings } from "@/lib/services/store-service";
import { createCategory, createProduct } from "@/lib/services/catalog-service";
import { addItem, getOrCreateOpenCart } from "@/lib/services/cart-service";
import { placeOrder } from "@/lib/services/checkout-service";
import {
  canTransition,
  updateOrderStatus,
  type OrderStatusValue,
} from "@/lib/services/order-service";
import { recordCodCollection } from "@/lib/services/payment-service";

/**
 * ATLaS seed (PRD §12 "seed data").
 *
 * Production mode (default): plans, the theme catalogue and the platform super
 * admin only. No store, product, order or customer rows are created, and any
 * legacy demo tenants are removed, so every screen starts from real data.
 *
 * Demo mode (`SEED_DEMO_DATA=1`, development only): additionally rebuilds the
 * three demo tenants used to exercise the storefront themes:
 *
 *   Tenant A — Nokshi Boutique  (free)   12 products, 6 orders
 *   Tenant B — Dhaka Bazar      (free)   16 products, 76 orders → ~65 eligible,
 *                                        which crosses the 50-order Free quota
 *                                        and generates PRD US-03 overage fees.
 *   Tenant C — Studio Tech      (free)   10 products, 12 orders
 */

const SEED_DEMO_DATA = process.env.SEED_DEMO_DATA === "1";

const DEMO_STORE_SLUGS = ["nokshi-demo", "dhaka-bazar", "studio-tech"];

const SEED_PASSWORD = "Atlas#2017";

const SUPER_ADMIN = {
  phone: normalizePhone("01700000000"),
  email: "admin@atlas.example",
  name: "ATLaS Super Admin",
};

const MERCHANT = {
  phone: normalizePhone("01711111111"),
  email: "merchant@atlas.example",
  name: "রফিকুল হাসান",
};

// ── Deterministic helpers ────────────────────────────────────────────────────

function makeRng(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 4_294_967_296;
  };
}

function pick<T>(rng: () => number, list: readonly T[]): T {
  return list[Math.floor(rng() * list.length) % list.length];
}

function image(seed: string, kind: "product" | "hero" = "product"): string {
  const size = kind === "hero" ? "1600/900" : "800/1000";
  return `https://picsum.photos/seed/atlas-${seed}/${size}`;
}

const CUSTOMER_NAMES = [
  "সাদিয়া রহমান",
  "তাশনিম আক্তার",
  "রফিকুল ইসলাম",
  "নুসরাত জাহান",
  "আরিফ হোসেন",
  "মেহেদী হাসান",
  "ফারজানা ইয়াসমিন",
  "সাব্বির আহমেদ",
  "জান্নাতুল ফেরদৌস",
  "তানভীর আলম",
  "শারমিন সুলতানা",
  "ইমরান খান",
];

const DHAKA_AREAS = [
  "ধানমন্ডি",
  "উত্তরা",
  "মিরপুর",
  "বনানী",
  "গুলশান",
  "মোহাম্মদপুর",
  "বাড্ডা",
  "মতিঝিল",
  "ওয়ারী",
  "খিলগাঁও",
];

const OUTSIDE_CITIES = ["চট্টগ্রাম", "সিলেট", "রাজশাহী", "খুলনা", "বরিশাল", "রংপুর"];

function customerPhone(index: number): string {
  const tail = String((20_000_000 + index * 977_133) % 100_000_000).padStart(8, "0");
  return `+8801${3 + (index % 7)}${tail}`;
}

function randomPause(rng: () => number): string {
  const lines = [
    "বিকেলের আগে ডেলিভারি হলে ভালো হয়।",
    "কল করে আসবেন, বাসায় কেউ থাকবে।",
    "প্যাকেজিং ভালোভাবে করবেন।",
    "গিফট হিসেবে পাঠাচ্ছি, কাগজে দাম লিখবেন না।",
  ];
  return rng() > 0.75 ? pick(rng, lines) : "";
}

// ── Catalog data ─────────────────────────────────────────────────────────────

type SeedVariant = { size?: string; stock: number; price: number; comparePrice?: number };

type SeedProduct = {
  name: string;
  category: string;
  sku: string;
  variants: SeedVariant[];
  tags: string[];
  description: string;
};

const NOKSHI_CATEGORIES = [
  { name: "শাড়ি", slug: "sharee" },
  { name: "কুর্তি", slug: "kurti" },
  { name: "থ্রি-পিস", slug: "three-piece" },
  { name: "ওড়না", slug: "orna" },
];

const NOKSHI_PRODUCTS: SeedProduct[] = [
  { name: "জামদানি শাড়ি — লাল", category: "sharee", sku: "NK-SH-001", variants: [{ size: "Free", stock: 8, price: 6500, comparePrice: 8500 }], tags: ["জামদানি", "উৎসব"], description: "হাতে বোনা জামদানি শাড়ি, লাল-সোনালি পাড়।" },
  { name: "কাতান শাড়ি — সোনালি", category: "sharee", sku: "NK-SH-002", variants: [{ size: "Free", stock: 4, price: 12500, comparePrice: 15000 }], tags: ["কাতান", "বিয়ে"], description: "বিয়ের অনুষ্ঠানের জন্য কাতান শাড়ি, সোনালি জরির কাজ।" },
  { name: "সুতি শাড়ি — নীল", category: "sharee", sku: "NK-SH-003", variants: [{ size: "Free", stock: 14, price: 2800, comparePrice: 3500 }], tags: ["সুতি", "প্রতিদিন"], description: "আরামদায়ক সুতি শাড়ি, প্রতিদিনের ব্যবহারের জন্য।" },
  { name: "এমব্রয়ডারি কুর্তি", category: "kurti", sku: "NK-KU-001", variants: [{ size: "M", stock: 10, price: 1850, comparePrice: 2400 }, { size: "L", stock: 8, price: 1850, comparePrice: 2400 }, { size: "XL", stock: 4, price: 1950, comparePrice: 2500 }], tags: ["কুর্তি", "এমব্রয়ডারি"], description: "হাতের কাজ করা এমব্রয়ডারি কুর্তি, কটন ফ্যাব্রিক।" },
  { name: "প্রিন্টেড কুর্তি", category: "kurti", sku: "NK-KU-002", variants: [{ size: "M", stock: 16, price: 1450, comparePrice: 1900 }, { size: "L", stock: 14, price: 1450, comparePrice: 1900 }], tags: ["কুর্তি", "প্রিন্ট"], description: "হালকা প্রিন্টেড কুর্তি, গরমে আরামদায়ক।" },
  { name: "লিনেন কুর্তি", category: "kurti", sku: "NK-KU-003", variants: [{ size: "L", stock: 12, price: 2200, comparePrice: 2800 }], tags: ["লিনেন", "কুর্তি"], description: "প্রিমিয়াম লিনেন কুর্তি, অফিস ও ঘোরার জন্য।" },
  { name: "কটন থ্রি-পিস", category: "three-piece", sku: "NK-TP-001", variants: [{ size: "Free", stock: 10, price: 3200, comparePrice: 4200 }], tags: ["থ্রি-পিস", "কটন"], description: "সুতি থ্রি-পিস, হালকা কাজের।" },
  { name: "উৎসব থ্রি-পিস", category: "three-piece", sku: "NK-TP-002", variants: [{ size: "Free", stock: 6, price: 4750, comparePrice: 5800 }], tags: ["থ্রি-পিস", "উৎসব"], description: "উৎসবের জন্য জরির কাজ করা থ্রি-পিস।" },
  { name: "সিল্ক ওড়না", category: "orna", sku: "NK-OR-001", variants: [{ size: "Free", stock: 24, price: 950, comparePrice: 1300 }], tags: ["ওড়না", "সিল্ক"], description: "নরম সিল্ক ওড়না, যেকোনো পোশাকের সাথে মানানসই।" },
  { name: "জামদানি ওড়না", category: "orna", sku: "NK-OR-002", variants: [{ size: "Free", stock: 15, price: 1650, comparePrice: 2100 }], tags: ["ওড়না", "জামদানি"], description: "জামদানি নকশার ওড়না, উৎসবের জন্য।" },
  { name: "সুতি ওড়না", category: "orna", sku: "NK-OR-003", variants: [{ size: "Free", stock: 40, price: 650, comparePrice: 900 }], tags: ["ওড়না", "সুতি"], description: "সহজ সুতি ওড়না, প্রতিদিনের ব্যবহারের জন্য।" },
  { name: "উৎসব শাড়ি — সবুজ", category: "sharee", sku: "NK-SH-004", variants: [{ size: "Free", stock: 3, price: 8900, comparePrice: 11000 }], tags: ["উৎসব", "শাড়ি"], description: "সীমিত সংখ্যায় তৈরি উৎসব শাড়ি, সবুজ-সোনালি।" },
];

const BAZAR_CATEGORIES = [
  { name: "সবজি", slug: "sobji" },
  { name: "ফল", slug: "fol" },
  { name: "মাছ ও মাংস", slug: "mach" },
  { name: "মুদি", slug: "mudi" },
  { name: "দুধ ও ডিম", slug: "dudh" },
];

const BAZAR_PRODUCTS: SeedProduct[] = [
  { name: "আলু (কেজি)", category: "sobji", sku: "DB-VG-001", variants: [{ stock: 200, price: 45, comparePrice: 55 }], tags: ["সবজি"], description: "তাজা দেশি আলু, প্রতিদিনের রান্নার জন্য।" },
  { name: "পেঁয়াজ (কেজি)", category: "sobji", sku: "DB-VG-002", variants: [{ stock: 150, price: 70, comparePrice: 85 }], tags: ["সবজি"], description: "দেশি পেঁয়াজ, ভালো মানের।" },
  { name: "টমেটো (কেজি)", category: "sobji", sku: "DB-VG-003", variants: [{ stock: 120, price: 60, comparePrice: 75 }], tags: ["সবজি"], description: "টাটকা টমেটো, সকালে তোলা।" },
  { name: "বেগুন (কেজি)", category: "sobji", sku: "DB-VG-004", variants: [{ stock: 100, price: 55, comparePrice: 70 }], tags: ["সবজি"], description: "লম্বা বেগুন, ভালো মানের।" },
  { name: "কলা (ডজন)", category: "fol", sku: "DB-FR-001", variants: [{ stock: 90, price: 80, comparePrice: 95 }], tags: ["ফল"], description: "পাকা সাগর কলা।" },
  { name: "আপেল (কেজি)", category: "fol", sku: "DB-FR-002", variants: [{ stock: 60, price: 180, comparePrice: 210 }], tags: ["ফল", "ইমপোর্টেড"], description: "ইমপোর্টেড আপেল, ক্রিস্প ও মিষ্টি।" },
  { name: "আম (কেজি)", category: "fol", sku: "DB-FR-003", variants: [{ stock: 80, price: 120, comparePrice: 150 }], tags: ["ফল", "মৌসুমি"], description: "মৌসুমি হিমসাগর আম।" },
  { name: "রুই মাছ (কেজি)", category: "mach", sku: "DB-FS-001", variants: [{ stock: 40, price: 380, comparePrice: 420 }], tags: ["মাছ"], description: "পদ্মার রুই মাছ, টুকরা করে দেওয়া হবে।" },
  { name: "মুরগি (কেজি)", category: "mach", sku: "DB-FS-002", variants: [{ stock: 50, price: 240, comparePrice: 270 }], tags: ["মাংস"], description: "দেশি মুরগি, হালাল।" },
  { name: "গরুর মাংস (কেজি)", category: "mach", sku: "DB-FS-003", variants: [{ stock: 30, price: 750, comparePrice: 820 }], tags: ["মাংস"], description: "তাজা গরুর মাংস, হালাল প্রসেসড।" },
  { name: "চাল — মিনিকেট (কেজি)", category: "mudi", sku: "DB-GR-001", variants: [{ stock: 300, price: 68, comparePrice: 75 }], tags: ["মুদি", "চাল"], description: "মিনিকেট চাল, ঝরঝরে।" },
  { name: "ডাল — মসুর (কেজি)", category: "mudi", sku: "DB-GR-002", variants: [{ stock: 200, price: 130, comparePrice: 145 }], tags: ["মুদি", "ডাল"], description: "ছোট দানার মসুর ডাল।" },
  { name: "সয়াবিন তেল (লিটার)", category: "mudi", sku: "DB-GR-003", variants: [{ stock: 150, price: 165, comparePrice: 180 }], tags: ["মুদি", "তেল"], description: "ফর্টিফায়েড সয়াবিন তেল।" },
  { name: "চিনি (কেজি)", category: "mudi", sku: "DB-GR-004", variants: [{ stock: 180, price: 125, comparePrice: 140 }], tags: ["মুদি"], description: "পরিশোধিত চিনি।" },
  { name: "দুধ (লিটার প্যাকেট)", category: "dudh", sku: "DB-DY-001", variants: [{ stock: 120, price: 90, comparePrice: 100 }], tags: ["দুধ"], description: "প্যাকেটজাত তরল দুধ, ফ্রিজে রাখুন।" },
  { name: "ডিম (ডজন)", category: "dudh", sku: "DB-DY-002", variants: [{ stock: 100, price: 130, comparePrice: 145 }], tags: ["ডিম"], description: "দেশি মুরগির ডিম, ডজন হিসেবে।" },
];

const STUDIO_CATEGORIES = [
  { name: "অডিও", slug: "audio" },
  { name: "মোবাইল অ্যাক্সেসরিজ", slug: "mobile-accessories" },
  { name: "স্মার্ট হোম", slug: "smart-home" },
  { name: "ক্যামেরা", slug: "camera" },
];

const STUDIO_PRODUCTS: SeedProduct[] = [
  { name: "AirBeat Pro Wireless Headphones", category: "audio", sku: "ST-AU-001", variants: [{ size: "Black", stock: 18, price: 4290, comparePrice: 4990 }, { size: "White", stock: 12, price: 4290, comparePrice: 4990 }], tags: ["wireless", "audio"], description: "Active noise cancellation এবং ৩০ ঘণ্টা battery backup-সহ premium wireless headphones।" },
  { name: "PocketSound Mini Speaker", category: "audio", sku: "ST-AU-002", variants: [{ size: "Blue", stock: 24, price: 1890, comparePrice: 2290 }], tags: ["speaker", "portable"], description: "ছোট আকারের waterproof Bluetooth speaker, ভ্রমণের জন্য উপযোগী।" },
  { name: "USB-C Fast Charger 33W", category: "mobile-accessories", sku: "ST-MA-001", variants: [{ size: "White", stock: 45, price: 990, comparePrice: 1250 }], tags: ["charger", "usb-c"], description: "PD supported 33W fast charger, ফোন ও tablet দুটির জন্যই।" },
  { name: "Braided USB-C Cable", category: "mobile-accessories", sku: "ST-MA-002", variants: [{ size: "1m", stock: 60, price: 450, comparePrice: 550 }, { size: "2m", stock: 45, price: 650, comparePrice: 800 }], tags: ["cable", "durable"], description: "Nylon braided fast-charge cable, দৈনন্দিন ব্যবহারে টেকসই।" },
  { name: "MagSafe Desk Stand", category: "mobile-accessories", sku: "ST-MA-003", variants: [{ size: "Silver", stock: 20, price: 1490, comparePrice: 1790 }], tags: ["stand", "desk"], description: "Minimal aluminium desk stand, compatible with MagSafe devices।" },
  { name: "Smart Glow Table Lamp", category: "smart-home", sku: "ST-SH-001", variants: [{ size: "Warm White", stock: 16, price: 2490, comparePrice: 2990 }], tags: ["lamp", "smart-home"], description: "App-controlled dimmable lamp, work desk এবং bedside-এর জন্য।" },
  { name: "Wi-Fi Smart Plug", category: "smart-home", sku: "ST-SH-002", variants: [{ size: "10A", stock: 35, price: 1190, comparePrice: 1490 }], tags: ["smart-home", "wifi"], description: "Timer ও remote control সহ compact Wi-Fi smart plug।" },
  { name: "1080p Creator Webcam", category: "camera", sku: "ST-CA-001", variants: [{ size: "Black", stock: 14, price: 3290, comparePrice: 3890 }], tags: ["webcam", "creator"], description: "1080p autofocus webcam, online class, meeting ও streaming-এর জন্য।" },
  { name: "Foldable Phone Tripod", category: "camera", sku: "ST-CA-002", variants: [{ size: "Universal", stock: 28, price: 1290, comparePrice: 1590 }], tags: ["tripod", "mobile"], description: "Adjustable foldable tripod, phone এবং compact camera support করে।" },
  { name: "Creator Desk Mat", category: "smart-home", sku: "ST-SH-003", variants: [{ size: "900mm", stock: 22, price: 890, comparePrice: 1090 }], tags: ["desk", "workspace"], description: "Water-resistant extended desk mat, clean workspace setup-এর জন্য।" },
];

const CONTENT_PAGES: Record<string, { title: string; body: string }> = {
  returns: { title: "রিটার্ন ও রিফান্ড নীতি", body: "পণ্য হাতে পাওয়ার ৭ দিনের মধ্যে সমস্যা থাকলে রিটার্ন করা যাবে। পণ্য অব্যবহৃত ও অরিজিনাল প্যাকেজিং-এ থাকতে হবে।" },
  contact: { title: "যোগাযোগ", body: "যেকোনো প্রশ্নে আমাদের সাথে যোগাযোগ করুন। সকাল ১০টা থেকে রাত ৮টা পর্যন্ত আমরা সক্রিয়।" },
  delivery: { title: "ডেলিভারি তথ্য", body: "ঢাকার ভিতরে ২৪ ঘণ্টা এবং ঢাকার বাইরে ২-৩ কার্যদিবসের মধ্যে ডেলিভারি দেওয়া হয়।" },
  privacy: { title: "প্রাইভেসি পলিসি", body: "আপনার ব্যক্তিগত তথ্য শুধু অর্ডার প্রক্রিয়াকরণের জন্যই ব্যবহৃত হয়, তৃতীয় পক্ষের কাছে বিক্রি করা হয় না।" },
  terms: { title: "শর্তাবলী", body: "এই সাইট ব্যবহার করে আপনি আমাদের সেবার শর্তাবলীতে সম্মত হচ্ছেন।" },
};

// ── Plans / users / themes ───────────────────────────────────────────────────

async function seedPlans() {
  for (const code of PLAN_CODES) {
    const definition = PLAN_DEFINITIONS[code];
    const price = definition.monthlyPriceBdt ?? 0;
    const yearly = definition.yearlyPriceBdt ?? (definition.monthlyPriceBdt === null ? 0 : price * 12);

    await prisma.plan.upsert({
      where: { code },
      create: {
        code,
        name: definition.name,
        description: definition.description,
        billingPeriod: "MONTHLY",
        price: toDecimalString(price) as never,
        yearlyPrice: toDecimalString(yearly) as never,
        currency: "BDT",
        trialDays: definition.trialDays,
        sortOrder: definition.sortOrder,
        isPublic: true,
        limitsJson: definition.$limits as never,
        featuresJson: definition.$features as never,
        status: "ACTIVE",
      },
      update: {
        name: definition.name,
        description: definition.description,
        price: toDecimalString(price) as never,
        yearlyPrice: toDecimalString(yearly) as never,
        limitsJson: definition.$limits as never,
        featuresJson: definition.$features as never,
        status: "ACTIVE",
      },
    });
  }
}

async function upsertUser(
  input: { phone: string; email: string; name: string },
  options: { isSuperAdmin?: boolean } = {},
) {
  const passwordHash = await hashPassword(SEED_PASSWORD);
  return prisma.user.upsert({
    where: { phone: input.phone },
    create: {
      phone: input.phone,
      email: input.email,
      name: input.name,
      passwordHash,
      status: "ACTIVE",
      isSuperAdmin: options.isSuperAdmin ?? false,
      phoneVerifiedAt: new Date(),
    },
    update: {
      email: input.email,
      name: input.name,
      passwordHash,
      status: "ACTIVE",
      isSuperAdmin: options.isSuperAdmin ?? false,
      phoneVerifiedAt: new Date(),
    },
  });
}

async function ensureRoles(tenantId: string) {
  const map = new Map<RoleCode, string>();
  for (const code of ROLE_CODES) {
    const role = await prisma.role.upsert({
      where: { tenantId_code: { tenantId, code } },
      create: {
        tenantId,
        code,
        name: SYSTEM_ROLES[code].name,
        permissionsJson: SYSTEM_ROLES[code].permissions as never,
        isSystem: true,
      },
      update: {
        name: SYSTEM_ROLES[code].name,
        permissionsJson: SYSTEM_ROLES[code].permissions as never,
      },
    });
    map.set(code, role.id);
  }
  return map;
}

async function resetDemoTenants() {
  const stores = await prisma.store.findMany({
    where: { slug: { in: DEMO_STORE_SLUGS } },
    select: { tenantId: true },
  });
  const tenantIds = [...new Set(stores.map((row) => row.tenantId))];
  if (tenantIds.length > 0) {
    await prisma.tenant.deleteMany({ where: { id: { in: tenantIds } } });
  }
  return tenantIds.length;
}

type SeedStoreSpec = {
  tenantName: string;
  storeName: string;
  slug: string;
  description: string;
  themeCode: string;
  contact: { phone: string; email: string; whatsapp: string };
  address: { line1: string; area: string; city: string; district: string; postcode: string };
  categories: Array<{ name: string; slug: string }>;
  products: SeedProduct[];
  coupons: Array<{ code: string; type: "PERCENTAGE" | "FIXED"; value: number; minOrder: number; usageLimit: number | null }>;
  /** Gateways the merchant has switched on while credentials are still pending. */
  sandboxGateways?: Array<"BKASH" | "NAGAD" | "SSLCOMMERZ">;
  orderCount: number;
  seed: number;
};

async function buildTenant(spec: SeedStoreSpec, ownerUserId: string) {
  const tenant = await prisma.tenant.create({
    data: { name: spec.tenantName, ownerUserId, status: "ACTIVE", timezone: "Asia/Dhaka", currency: "BDT" },
  });

  const roles = await ensureRoles(tenant.id);
  await prisma.membership.create({
    data: {
      tenantId: tenant.id,
      userId: ownerUserId,
      roleId: roles.get("OWNER")!,
      status: "ACTIVE",
      acceptedAt: new Date(),
    },
  });

  await ensureSubscription(tenant.id);

  // Align the billing period with the calendar month. `monthBounds` is what the
  // usage counters and PRD §5.1 overage windows are built on, so the seeded
  // subscription must match it or backdated orders would fall outside the period.
  const bounds = monthBounds();
  await prisma.subscription.update({
    where: { tenantId: tenant.id },
    data: {
      status: "ACTIVE",
      trialEnd: null,
      currentPeriodStart: bounds.start,
      currentPeriodEnd: bounds.end,
    },
  });
  invalidateEntitlements(tenant.id);

  const actor: ActorContext = {
    userId: ownerUserId,
    tenantId: tenant.id,
    roleCode: "OWNER",
    permissions: [...PERMISSIONS],
  };

  const store = await createStore(actor, {
    name: spec.storeName,
    slug: spec.slug,
    description: spec.description,
    themeCode: spec.themeCode,
    locale: "bn",
  });

  await updateStoreSettings(actor, store.id, {
    contact: spec.contact,
    address: spec.address,
    seo: { title: spec.storeName, description: spec.description, ogImage: image(spec.slug, "hero") },
    policy: {
      returnsDays: 7,
      returnsText: CONTENT_PAGES.returns.body,
      privacyText: CONTENT_PAGES.privacy.body,
      termsText: CONTENT_PAGES.terms.body,
    },
  });

  // Gateways the merchant has switched on while live credentials are pending:
  // checkout routes them to the sandbox simulator, which posts a real signed
  // callback so the whole webhook path stays under test (PRD §17).
  for (const provider of spec.sandboxGateways ?? []) {
    await togglePaymentMethod(actor, store.id, provider, {
      isEnabled: true,
      publicConfig: { sandbox: true },
    });
  }

  // Categories.
  const categoryIds = new Map<string, string>();
  for (const [index, category] of spec.categories.entries()) {
    const created = await createCategory(actor, store.id, {
      name: category.name,
      slug: category.slug,
      sortOrder: index,
    });
    categoryIds.set(category.slug, created.id);
  }

  // Products + variants.
  const variants: Array<{ id: string; price: number; stock: number }> = [];
  for (const product of spec.products) {
    const created = await createProduct(actor, store.id, {
      name: product.name,
      categoryId: categoryIds.get(product.category) ?? null,
      description: product.description,
      tags: product.tags,
      status: "ACTIVE",
      images: [{ url: image(product.sku), altText: product.name }],
      variants: product.variants.map((variant, index) => ({
        sku: product.variants.length > 1 ? `${product.sku}-${variant.size ?? index + 1}` : product.sku,
        optionValues: variant.size ? { size: variant.size } : {},
        price: variant.price,
        comparePrice: variant.comparePrice ?? null,
        stockQty: variant.stock,
        status: "ACTIVE",
      })),
    });

    const stored = await prisma.productVariant.findMany({
      where: { productId: created.id },
      select: { id: true, price: true, stockQty: true },
    });
    for (const variant of stored) {
      variants.push({ id: variant.id, price: Number(variant.price), stock: variant.stockQty });
    }
  }

  // Coupons.
  for (const coupon of spec.coupons) {
    await prisma.coupon.create({
      data: {
        storeId: store.id,
        code: coupon.code,
        type: coupon.type,
        value: toDecimalString(coupon.value) as never,
        minOrder: toDecimalString(coupon.minOrder) as never,
        usageLimit: coupon.usageLimit,
        status: "ACTIVE",
      },
    });
  }

  // Content pages (footer links point at these).
  for (const [slug, page] of Object.entries(CONTENT_PAGES)) {
    await prisma.contentPage.create({
      data: { storeId: store.id, slug, title: page.title, bodyJson: { html: page.body } as never, status: "ACTIVE" },
    });
  }

  await publishStore(actor, store.id);

  return { tenant, store, actor, variants };
}

// ── Orders ───────────────────────────────────────────────────────────────────

async function walkStatus(
  actor: ActorContext,
  storeId: string,
  orderId: string,
  path: OrderStatusValue[],
) {
  for (const next of path) {
    const current = await prisma.order.findUnique({ where: { id: orderId }, select: { status: true } });
    if (!current) return;
    if (current.status === next) continue;
    if (!canTransition(current.status, next)) continue;
    await updateOrderStatus(actor, storeId, orderId, {
      status: next,
      actorType: "STAFF",
      note: "Seed: demo timeline",
    });
  }
}

async function seedOrder(params: {
  store: { id: string; slug: string };
  actor: ActorContext;
  variants: Array<{ id: string; price: number; stock: number }>;
  zones: Array<{ id: string; name: string; isDefault: boolean }>;
  rng: () => number;
  index: number;
  plannedStatus: OrderStatusValue;
}) {
  const { store, actor, variants, zones, rng, index, plannedStatus } = params;
  const sessionKey = `seed-${store.slug}-${index}`;

  await getOrCreateOpenCart(store.id, sessionKey);

  const lineCount = 1 + Math.floor(rng() * 3);
  const chosen: Array<{ variantId: string; quantity: number }> = [];
  const used = new Set<string>();
  for (let i = 0; i < lineCount; i += 1) {
    const variant = pick(rng, variants);
    if (used.has(variant.id)) continue;
    used.add(variant.id);
    chosen.push({ variantId: variant.id, quantity: 1 + Math.floor(rng() * 2) });
  }
  if (chosen.length === 0) chosen.push({ variantId: variants[0].id, quantity: 1 });

  for (const line of chosen) {
    await addItem(store.id, sessionKey, line);
  }

  const outside = rng() > 0.65;
  const dhakaZone = zones.find((zone) => zone.isDefault);
  const outsideZone = zones.find((zone) => !zone.isDefault);
  const zone = outside ? (outsideZone ?? dhakaZone) : dhakaZone;
  const city = outside ? pick(rng, OUTSIDE_CITIES) : "ঢাকা";
  const area = outside ? city : pick(rng, DHAKA_AREAS);

  // 70% COD, 30% gateway (sandbox stays pending without credentials).
  const payable = plannedStatus !== "PENDING_PAYMENT";
  const provider = payable ? (rng() > 0.12 ? "COD" : pick(rng, ["BKASH", "NAGAD", "SSLCOMMERZ"] as const)) : pick(rng, ["BKASH", "NAGAD", "SSLCOMMERZ"] as const);

  const order = await placeOrder({
    storeSlug: store.slug,
    sessionKey,
    idempotencyKey: `seed-${store.slug}-${index}`,
    baseUrl: env.appUrl,
    payload: {
      customerName: pick(rng, CUSTOMER_NAMES),
      customerPhone: customerPhone(index),
      customerEmail: "",
      address: {
        line1: `${Math.floor(rng() * 90) + 10}, রোড ${Math.floor(rng() * 20) + 1}`,
        line2: "",
        area,
        city,
        district: city,
        postcode: "",
      },
      notes: randomPause(rng),
      zoneId: zone?.id ?? null,
      paymentProvider: provider,
      acceptTerms: true,
    },
  });

  // Move the order along its lifecycle.
  if (plannedStatus !== "PENDING_PAYMENT") {
    const path: OrderStatusValue[] = [];
    if (provider !== "COD") path.push("PAID");
    path.push("CONFIRMED");
    if (["PROCESSING", "SHIPPED", "DELIVERED"].includes(plannedStatus)) path.push("PROCESSING");
    if (["SHIPPED", "DELIVERED"].includes(plannedStatus)) path.push("SHIPPED");
    if (plannedStatus === "DELIVERED") path.push("DELIVERED");
    if (plannedStatus === "CANCELLED") path.push("CANCELLED");
    await walkStatus(actor, store.id, order.orderId, path);
  }

  if (plannedStatus === "DELIVERED" && provider === "COD") {
    await recordCodCollection(actor, store.id, order.orderId);
  }

  // Backdate within the current billing month so reports look lived-in while
  // every seeded order still counts toward the current period (PRD US-03).
  const now = new Date();
  const monthStart = startOfMonth(now);
  const span = Math.max(1, now.getTime() - monthStart.getTime());
  const placedAt = new Date(monthStart.getTime() + Math.floor(rng() * span));
  await prisma.order.update({
    where: { id: order.orderId },
    data: {
      placedAt,
      createdAt: placedAt,
      ...(plannedStatus === "DELIVERED"
        ? { confirmedAt: addDays(placedAt, 1), deliveredAt: addDays(placedAt, 3) }
        : plannedStatus === "PENDING_PAYMENT"
          ? {}
          : { confirmedAt: addDays(placedAt, 1) }),
    },
  });

  return order.orderId;
}

function planStatuses(count: number): OrderStatusValue[] {
  // A realistic mix: mostly delivered, a tail of in-flight and pending orders.
  const weights: Array<[OrderStatusValue, number]> = [
    ["DELIVERED", 0.55],
    ["SHIPPED", 0.14],
    ["PROCESSING", 0.08],
    ["CONFIRMED", 0.09],
    ["PENDING_PAYMENT", 0.09],
    ["CANCELLED", 0.05],
  ];
  const statuses: OrderStatusValue[] = [];
  let cursor = 0;
  const buckets = weights.map(([status, weight]) => {
    const start = cursor;
    cursor += weight;
    return { status, start, end: cursor };
  });
  for (let i = 0; i < count; i += 1) {
    const value = (i + 0.5) / count;
    const bucket = buckets.find((b) => value >= b.start && value < b.end) ?? buckets[0];
    statuses.push(bucket.status);
  }
  return statuses;
}

async function seedOrders(
  built: Awaited<ReturnType<typeof buildTenant>>,
  count: number,
  seedValue: number,
) {
  const zones = await prisma.deliveryZone.findMany({
    where: { storeId: built.store.id, isActive: true },
    select: { id: true, name: true, isDefault: true },
    orderBy: [{ isDefault: "desc" }, { sortOrder: "asc" }],
  });

  // Backdate the first half of the month-window for purchases, keeping the last
  // >50 orders in-quota-eligible order for the Free plan overage demo.
  const statuses = planStatuses(count);
  const rng = makeRng(seedValue);

  for (let i = 0; i < count; i += 1) {
    await seedOrder({
      store: { id: built.store.id, slug: built.store.slug },
      actor: built.actor,
      variants: built.variants,
      zones,
      rng,
      index: i,
      plannedStatus: statuses[i],
    });
    if ((i + 1) % 10 === 0) {
      console.log(`   … ${i + 1}/${count} orders`);
    }
  }
}

async function assertDemoSeedCompleteness() {
  const expected = [
    { slug: "nokshi-demo", themeCode: "nokshi", products: NOKSHI_PRODUCTS.length, orders: 6 },
    { slug: "dhaka-bazar", themeCode: "bazar", products: BAZAR_PRODUCTS.length, orders: 76 },
    { slug: "studio-tech", themeCode: "studio", products: STUDIO_PRODUCTS.length, orders: 12 },
  ];
  const stores = await prisma.store.findMany({
    where: { slug: { in: expected.map((item) => item.slug) }, deletedAt: null },
    include: {
      themes: {
        where: { isSelected: true },
        include: { themeVersion: { include: { theme: true } } },
      },
      _count: { select: { categories: true, products: true, orders: true, coupons: true } },
    },
  });
  if (stores.length !== expected.length) {
    throw new Error(`Seed assertion failed: expected ${expected.length} demo stores, found ${stores.length}`);
  }
  for (const item of expected) {
    const store = stores.find((row) => row.slug === item.slug);
    const themeCode = store?.themes[0]?.themeVersion.theme.code;
    if (!store || store.status !== "PUBLISHED") {
      throw new Error(`Seed assertion failed: ${item.slug} is missing or not published`);
    }
    if (themeCode !== item.themeCode) {
      throw new Error(`Seed assertion failed: ${item.slug} expected theme ${item.themeCode}, found ${themeCode ?? "none"}`);
    }
    if (store._count.products !== item.products || store._count.orders !== item.orders) {
      throw new Error(
        `Seed assertion failed: ${item.slug} expected ${item.products} products/${item.orders} orders, ` +
          `found ${store._count.products} products/${store._count.orders} orders`,
      );
    }
  }
  console.log(`   Seed assertions: ${stores.length} published stores, catalog/theme/order counts verified`);
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log("▶ ATLaS seed start");

  console.log("• Plans");
  await seedPlans();

  console.log("• Theme catalog");
  await ensureThemeCatalog();

  console.log("• Super admin");
  const superAdmin = await upsertUser(SUPER_ADMIN, { isSuperAdmin: true });

  console.log("• Removing legacy demo tenants");
  const removed = await resetDemoTenants();
  if (removed > 0) console.log(`   removed ${removed} existing demo tenant(s)`);

  if (!SEED_DEMO_DATA) {
    console.log("\n✔ Seed complete — database contains real data only");
    console.log(`   Super Admin : ${SUPER_ADMIN.phone} / ${SEED_PASSWORD}  (id ${superAdmin.id.slice(0, 8)}…)`);
    console.log("   Demo data   : skipped (set SEED_DEMO_DATA=1 for development fixtures)");
    return;
  }

  console.log("• Demo merchant");
  const merchant = await upsertUser(MERCHANT);

  console.log("• Tenant A — Nokshi Boutique");
  const nokshi = await buildTenant(
    {
      tenantName: "Nokshi Boutique",
      storeName: "নকশি বুটিক",
      slug: "nokshi-demo",
      description: "হাতে বোনা শাড়ি, কুর্তি ও ওড়নার ছোট ব্যাচের সংগ্রহ।",
      themeCode: "nokshi",
      contact: { phone: "01711111111", email: "hello@nokshi.example", whatsapp: "01711111111" },
      address: { line1: "১২/এ, রোড ৫", area: "ধানমন্ডি", city: "ঢাকা", district: "ঢাকা", postcode: "1205" },
      categories: NOKSHI_CATEGORIES,
      products: NOKSHI_PRODUCTS,
      coupons: [{ code: "EID20", type: "PERCENTAGE", value: 20, minOrder: 1500, usageLimit: 200 }],
      sandboxGateways: ["BKASH", "NAGAD", "SSLCOMMERZ"],
      orderCount: 6,
      seed: 11,
    },
    merchant.id,
  );
  await seedOrders(nokshi, 6, 1001);
  console.log(`   ${NOKSHI_PRODUCTS.length} products, 6 orders`);

  console.log("• Tenant B — Dhaka Bazar");
  const bazar = await buildTenant(
    {
      tenantName: "Dhaka Bazar",
      storeName: "ঢাকা বাজার",
      slug: "dhaka-bazar",
      description: "প্রতিদিনের টাটকা সবজি, ফল, মাছ ও মুদি — বাজারের দামে।",
      themeCode: "bazar",
      contact: { phone: "01722222222", email: "support@dhakabazar.example", whatsapp: "01722222222" },
      address: { line1: "৫৪, বাজার রোড", area: "মিরপুর ১০", city: "ঢাকা", district: "ঢাকা", postcode: "1216" },
      categories: BAZAR_CATEGORIES,
      products: BAZAR_PRODUCTS,
      coupons: [{ code: "FRESH60", type: "FIXED", value: 60, minOrder: 500, usageLimit: null }],
      sandboxGateways: ["BKASH", "NAGAD", "SSLCOMMERZ"],
      orderCount: 76,
      seed: 29,
    },
    merchant.id,
  );
  await seedOrders(bazar, 76, 2002);
  console.log(`   ${BAZAR_PRODUCTS.length} products, 76 orders`);

  console.log("• Tenant C — Studio Tech");
  const studio = await buildTenant(
    {
      tenantName: "Studio Tech",
      storeName: "স্টুডিও টেক",
      slug: "studio-tech",
      description: "স্মার্ট workspace, audio gear ও creator essentials — curated tech collection।",
      themeCode: "studio",
      contact: { phone: "01733333333", email: "hello@studiotech.example", whatsapp: "01733333333" },
      address: { line1: "২৭, টেক পার্ক রোড", area: "বনানী", city: "ঢাকা", district: "ঢাকা", postcode: "1213" },
      categories: STUDIO_CATEGORIES,
      products: STUDIO_PRODUCTS,
      coupons: [{ code: "TECH10", type: "PERCENTAGE", value: 10, minOrder: 1000, usageLimit: 100 }],
      sandboxGateways: ["BKASH", "NAGAD", "SSLCOMMERZ"],
      orderCount: 12,
      seed: 47,
    },
    merchant.id,
  );
  await seedOrders(studio, 12, 3003);
  console.log(`   ${STUDIO_PRODUCTS.length} products, 12 orders`);

  const summary = await prisma.order.groupBy({
    by: ["storeId", "status"],
    _count: { _all: true },
  });
  const fees = await prisma.feeLedger.groupBy({
    by: ["tenantId", "feeType", "status"],
    _sum: { feeAmount: true },
    _count: { _all: true },
    where: { reversedAt: null },
  });
  await assertDemoSeedCompleteness();

  console.log("\n✔ Seed complete");
  console.log(`   Super Admin : ${SUPER_ADMIN.phone} / ${SEED_PASSWORD}  (id ${superAdmin.id.slice(0, 8)}…)`);
  console.log(`   Merchant    : ${MERCHANT.phone} / ${SEED_PASSWORD}  (owner of all demo stores)`);
  console.log(`   Storefronts : ${env.appUrl}/store/nokshi-demo , ${env.appUrl}/store/dhaka-bazar , ${env.appUrl}/store/studio-tech`);
  console.log(`   Orders      : ${summary.reduce((acc, row) => acc + row._count._all, 0)}`);
  if (fees.length === 0) {
    console.log("   Fee ledger  : no billable fees");
  }
  for (const row of fees) {
    const tenantName = row.tenantId === bazar.tenant.id ? "Dhaka Bazar" : row.tenantId === studio.tenant.id ? "Studio Tech" : "Nokshi";
    console.log(
      `   Fee ledger  : ${tenantName} ${row.feeType} (${row.status}) ×${row._count._all} = ৳${row._sum.feeAmount}`,
    );
  }
}

main()
  .catch((error) => {
    console.error("\n✖ Seed failed");
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
