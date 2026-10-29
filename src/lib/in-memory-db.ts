/* eslint-disable @typescript-eslint/no-explicit-any */
import { randomUUID } from "node:crypto";
import { normalizePhone } from "@/lib/auth/otp";

/**
 * High-fidelity in-memory database implementation that matches the Prisma Client API.
 * Keeps all data in-memory when no external PostgreSQL server is reachable.
 * Pre-seeded with demo accounts, tenants, stores, themes, plans, and delivery zones.
 */

export interface ModelDelegate {
  findFirst(args?: any): Promise<any>;
  findFirstOrThrow(args?: any): Promise<any>;
  findUnique(args?: any): Promise<any>;
  findUniqueOrThrow(args?: any): Promise<any>;
  findMany(args?: any): Promise<any[]>;
  count(args?: any): Promise<number>;
  create(args: any): Promise<any>;
  createMany(args: any): Promise<{ count: number }>;
  createManyAndReturn(args: any): Promise<any[]>;
  update(args: any): Promise<any>;
  updateMany(args: any): Promise<{ count: number }>;
  upsert(args: any): Promise<any>;
  delete(args: any): Promise<any>;
  deleteMany(args?: any): Promise<{ count: number }>;
  aggregate(args?: any): Promise<any>;
  groupBy(args?: any): Promise<any[]>;
}

function matchesFilter(item: any, where?: any): boolean {
  if (!where || typeof where !== "object") return true;

  for (const [key, condition] of Object.entries(where)) {
    if (key === "OR" && Array.isArray(condition)) {
      const matchAny = condition.some((subWhere) => matchesFilter(item, subWhere));
      if (!matchAny) return false;
      continue;
    }
    if (key === "AND" && Array.isArray(condition)) {
      const matchAll = condition.every((subWhere) => matchesFilter(item, subWhere));
      if (!matchAll) return false;
      continue;
    }
    if (key === "NOT") {
      if (Array.isArray(condition)) {
        if (condition.some((subWhere) => matchesFilter(item, subWhere))) return false;
      } else if (matchesFilter(item, condition)) {
        return false;
      }
      continue;
    }

    // Composite unique index matching (e.g. tenantId_code: { tenantId, code })
    if (key.includes("_") && condition && typeof condition === "object" && !Array.isArray(condition)) {
      const compositeMatched = Object.entries(condition).every(([k, v]) => matchesFilter(item, { [k]: v }));
      if (!compositeMatched) return false;
      continue;
    }

    const value = item[key];

    if (condition === null) {
      if (value !== null && value !== undefined) return false;
      continue;
    }

    if (typeof condition === "object" && !(condition instanceof Date) && !Array.isArray(condition)) {
      for (const [op, opVal] of Object.entries(condition)) {
        if (op === "equals") {
          if (value !== opVal) return false;
        } else if (op === "not") {
          if (value === opVal) return false;
        } else if (op === "in" && Array.isArray(opVal)) {
          if (!opVal.includes(value)) return false;
        } else if (op === "notIn" && Array.isArray(opVal)) {
          if (opVal.includes(value)) return false;
        } else if (op === "gte") {
          const vTime = value instanceof Date ? value.getTime() : Number(value);
          const oTime = opVal instanceof Date ? opVal.getTime() : Number(opVal);
          if (isNaN(vTime) || vTime < oTime) return false;
        } else if (op === "lte") {
          const vTime = value instanceof Date ? value.getTime() : Number(value);
          const oTime = opVal instanceof Date ? opVal.getTime() : Number(opVal);
          if (isNaN(vTime) || vTime > oTime) return false;
        } else if (op === "gt") {
          const vTime = value instanceof Date ? value.getTime() : Number(value);
          const oTime = opVal instanceof Date ? opVal.getTime() : Number(opVal);
          if (isNaN(vTime) || vTime <= oTime) return false;
        } else if (op === "lt") {
          const vTime = value instanceof Date ? value.getTime() : Number(value);
          const oTime = opVal instanceof Date ? opVal.getTime() : Number(opVal);
          if (isNaN(vTime) || vTime >= oTime) return false;
        } else if (op === "contains") {
          if (typeof value !== "string" || !value.toLowerCase().includes(String(opVal).toLowerCase())) {
            return false;
          }
        } else if (op === "startsWith") {
          if (typeof value !== "string" || !value.startsWith(String(opVal))) {
            return false;
          }
        } else {
          // Nested relation filter (e.g. store: { tenantId: '...' })
          if (value && typeof value === "object") {
            if (!matchesFilter(value, { [op]: opVal })) return false;
          }
        }
      }
      continue;
    }

    if (condition instanceof Date) {
      const vTime = value instanceof Date ? value.getTime() : new Date(value).getTime();
      if (vTime !== condition.getTime()) return false;
      continue;
    }

    if (value !== condition) {
      return false;
    }
  }

  return true;
}

function applySelectOrInclude(item: any, select?: any, include?: any, allCollections?: Map<string, Map<string, any>>): any {
  if (!item) return null;
  const result = { ...item };

  if (include && allCollections) {
    for (const [relation, config] of Object.entries(include)) {
      if (!config) continue;
      if (relation === "tenant" && item.tenantId) {
        const tenants = allCollections.get("tenant");
        result.tenant = tenants?.get(item.tenantId) || null;
      } else if (relation === "role" && item.roleId) {
        const roles = allCollections.get("role");
        result.role = roles?.get(item.roleId) || null;
      } else if (relation === "plan" && item.planId) {
        const plans = allCollections.get("plan");
        result.plan = plans?.get(item.planId) || null;
      } else if (relation === "store" && item.storeId) {
        const stores = allCollections.get("store");
        result.store = stores?.get(item.storeId) || null;
      }
    }
  }

  if (select) {
    const projected: any = {};
    for (const [key, selected] of Object.entries(select)) {
      if (selected) {
        projected[key] = result[key];
      }
    }
    return projected;
  }

  return result;
}

export class InMemoryCollection implements ModelDelegate {
  public records = new Map<string, any>();
  private allCollections: Map<string, Map<string, any>>;

  constructor(public modelName: string, allCollections: Map<string, Map<string, any>>) {
    this.allCollections = allCollections;
  }

  async findFirst(args?: any): Promise<any> {
    const list = await this.findMany({ ...args, take: 1 });
    return list[0] ?? null;
  }

  async findFirstOrThrow(args?: any): Promise<any> {
    const match = await this.findFirst(args);
    if (!match) throw new Error(`NotFoundError: No ${this.modelName} found matching query.`);
    return match;
  }

  async findUnique(args?: any): Promise<any> {
    return this.findFirst(args);
  }

  async findUniqueOrThrow(args?: any): Promise<any> {
    return this.findFirstOrThrow(args);
  }

  async findMany(args?: any): Promise<any[]> {
    let matches = Array.from(this.records.values()).filter((item) => matchesFilter(item, args?.where));

    if (args?.orderBy) {
      const orderKeys = Array.isArray(args.orderBy) ? args.orderBy : [args.orderBy];
      matches.sort((a, b) => {
        for (const order of orderKeys) {
          const [field, dir] = Object.entries(order)[0] as [string, string];
          const valA = a[field];
          const valB = b[field];
          if (valA === valB) continue;
          if (valA === null || valA === undefined) return 1;
          if (valB === null || valB === undefined) return -1;
          const cmp = valA > valB ? 1 : -1;
          return dir.toLowerCase() === "desc" ? -cmp : cmp;
        }
        return 0;
      });
    }

    if (typeof args?.skip === "number") {
      matches = matches.slice(args.skip);
    }
    if (typeof args?.take === "number") {
      matches = matches.slice(0, args.take);
    }

    return matches.map((item) => applySelectOrInclude(item, args?.select, args?.include, this.allCollections));
  }

  async count(args?: any): Promise<number> {
    if (!args?.where) return this.records.size;
    let total = 0;
    for (const item of this.records.values()) {
      if (matchesFilter(item, args.where)) total++;
    }
    return total;
  }

  async create(args: any): Promise<any> {
    const id = args.data?.id || `mock_${randomUUID()}`;
    const now = new Date();
    const record = {
      id,
      createdAt: now,
      updatedAt: now,
      ...args.data,
    };
    this.records.set(id, record);
    return applySelectOrInclude(record, args?.select, args?.include, this.allCollections);
  }

  async createMany(args: any): Promise<{ count: number }> {
    const dataList = Array.isArray(args.data) ? args.data : [args.data];
    for (const data of dataList) {
      await this.create({ data });
    }
    return { count: dataList.length };
  }

  async createManyAndReturn(args: any): Promise<any[]> {
    const dataList = Array.isArray(args.data) ? args.data : [args.data];
    const results = [];
    for (const data of dataList) {
      results.push(await this.create({ data }));
    }
    return results;
  }

  async update(args: any): Promise<any> {
    const existing = await this.findFirst({ where: args.where });
    if (!existing) {
      throw new Error(`Item to update in ${this.modelName} not found.`);
    }

    const updated = { ...existing };
    for (const [key, val] of Object.entries(args.data ?? {})) {
      if (val && typeof val === "object" && "increment" in val) {
        updated[key] = (Number(updated[key]) || 0) + Number((val as any).increment);
      } else {
        updated[key] = val;
      }
    }
    updated.updatedAt = new Date();
    this.records.set(existing.id, updated);
    return applySelectOrInclude(updated, args?.select, args?.include, this.allCollections);
  }

  async updateMany(args: any): Promise<{ count: number }> {
    const matching = await this.findMany({ where: args.where });
    for (const item of matching) {
      await this.update({ where: { id: item.id }, data: args.data });
    }
    return { count: matching.length };
  }

  async upsert(args: any): Promise<any> {
    const existing = await this.findFirst({ where: args.where });
    if (existing) {
      return this.update({ where: { id: existing.id }, data: args.update, select: args.select });
    }
    return this.create({ data: args.create, select: args.select });
  }

  async delete(args: any): Promise<any> {
    const existing = await this.findFirst({ where: args.where });
    if (existing) {
      this.records.delete(existing.id);
      return existing;
    }
    return {};
  }

  async deleteMany(args?: any): Promise<{ count: number }> {
    const matching = await this.findMany({ where: args?.where });
    for (const item of matching) {
      this.records.delete(item.id);
    }
    return { count: matching.length };
  }

  async aggregate(args?: any): Promise<any> {
    const items = await this.findMany({ where: args?.where });
    const count = items.length;
    const sumResult: Record<string, number> = {};

    if (args?._sum) {
      for (const field of Object.keys(args._sum)) {
        sumResult[field] = items.reduce((acc, curr) => acc + (Number(curr[field]) || 0), 0);
      }
    }
    return {
      _count: count,
      _sum: sumResult,
      _avg: {},
      _min: {},
      _max: {},
    };
  }

  async groupBy(args?: any): Promise<any[]> {
    const items = await this.findMany({ where: args?.where });
    return items;
  }
}

/**
 * Creates and initializes the stateful in-memory database with realistic seed data.
 */
export function createInMemoryDatabase(): any {
  const collectionData = new Map<string, Map<string, any>>();
  const collections = new Map<string, InMemoryCollection>();

  function getCollection(name: string): InMemoryCollection {
    if (!collections.has(name)) {
      const col = new InMemoryCollection(name, collectionData);
      collections.set(name, col);
      collectionData.set(name, col.records);
    }
    return collections.get(name)!;
  }

  // Pre-seed core entities
  const users = getCollection("user");
  const tenants = getCollection("tenant");
  const roles = getCollection("role");
  const memberships = getCollection("membership");
  const stores = getCollection("store");
  const storeSettings = getCollection("storeSettings");
  const themes = getCollection("theme");
  const storeThemes = getCollection("storeTheme");
  const plans = getCollection("plan");
  const subscriptions = getCollection("subscription");
  const deliveryZones = getCollection("deliveryZone");
  const categories = getCollection("category");
  const products = getCollection("product");
  const _otpChallenges = getCollection("otpChallenge");

  const BCRYPT_SEED_HASH = "$2b$10$lmM0mJCqrEzrG6ulPdTELeKBceQ1CTylwVXfH4fAD5Tx8KDzAbNwe"; // "Atlas#2017"

  // 1. Users
  users.records.set("usr_super_admin", {
    id: "usr_super_admin",
    phone: normalizePhone("01700000000"),
    email: "admin@atlas.example",
    name: "ATLaS Super Admin",
    isSuperAdmin: true,
    status: "ACTIVE",
    passwordHash: BCRYPT_SEED_HASH,
    deletedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  users.records.set("usr_merchant", {
    id: "usr_merchant",
    phone: normalizePhone("01711111111"),
    email: "merchant@atlas.example",
    name: "রফিকুল হাসান",
    isSuperAdmin: false,
    status: "ACTIVE",
    passwordHash: BCRYPT_SEED_HASH,
    deletedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  // 2. Tenants
  tenants.records.set("tenant_nokshi", {
    id: "tenant_nokshi",
    name: "নকশী বুটিক",
    slug: "nokshi-demo",
    status: "ACTIVE",
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  tenants.records.set("tenant_dhaka", {
    id: "tenant_dhaka",
    name: "ঢাকা বাজার",
    slug: "dhaka-bazar",
    status: "ACTIVE",
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  tenants.records.set("tenant_studio", {
    id: "tenant_studio",
    name: "স্টুডিও টেক",
    slug: "studio-tech",
    status: "ACTIVE",
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  // 3. Roles
  const allPermissions = [
    "store:read", "store:write", "catalog:read", "catalog:write",
    "orders:read", "orders:write", "customers:read", "customers:write",
    "delivery:read", "delivery:write", "payments:read", "payments:write",
    "design:read", "design:write", "discounts:read", "discounts:write",
    "reports:read", "staff:read", "staff:write", "billing:read", "billing:write",
    "settings:read", "settings:write",
  ];

  for (const tId of ["tenant_nokshi", "tenant_dhaka", "tenant_studio"]) {
    const roleOwnerId = `role_owner_${tId}`;
    roles.records.set(roleOwnerId, {
      id: roleOwnerId,
      tenantId: tId,
      code: "STORE_OWNER",
      name: "দোকানের মালিক",
      permissionsJson: allPermissions,
      isSystem: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const roleAdminId = `role_admin_${tId}`;
    roles.records.set(roleAdminId, {
      id: roleAdminId,
      tenantId: tId,
      code: "STORE_ADMIN",
      name: "অ্যাডমিন",
      permissionsJson: allPermissions,
      isSystem: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }

  // 4. Memberships
  memberships.records.set("mem_merchant_nokshi", {
    id: "mem_merchant_nokshi",
    userId: "usr_merchant",
    tenantId: "tenant_nokshi",
    roleId: "role_owner_tenant_nokshi",
    status: "ACTIVE",
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  memberships.records.set("mem_admin_nokshi", {
    id: "mem_admin_nokshi",
    userId: "usr_super_admin",
    tenantId: "tenant_nokshi",
    roleId: "role_admin_tenant_nokshi",
    status: "ACTIVE",
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  // 5. Stores
  stores.records.set("store_nokshi", {
    id: "store_nokshi",
    tenantId: "tenant_nokshi",
    name: "Nokshi Boutique",
    slug: "nokshi-demo",
    status: "PUBLISHED",
    publishedAt: new Date(),
    deletedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  stores.records.set("store_dhaka", {
    id: "store_dhaka",
    tenantId: "tenant_dhaka",
    name: "Dhaka Bazar",
    slug: "dhaka-bazar",
    status: "PUBLISHED",
    publishedAt: new Date(),
    deletedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  // 6. Store Settings
  storeSettings.records.set("settings_store_nokshi", {
    id: "settings_store_nokshi",
    storeId: "store_nokshi",
    currency: "BDT",
    timezone: "Asia/Dhaka",
    checkoutJson: {
      codEnabled: true,
      bkashEnabled: true,
      nagadEnabled: true,
    },
    notificationsJson: {},
    courierJson: {},
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  storeSettings.records.set("settings_store_dhaka", {
    id: "settings_store_dhaka",
    storeId: "store_dhaka",
    currency: "BDT",
    timezone: "Asia/Dhaka",
    checkoutJson: {
      codEnabled: true,
      bkashEnabled: true,
    },
    notificationsJson: {},
    courierJson: {},
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  // 7. Themes
  themes.records.set("thm_nokshi", {
    id: "thm_nokshi",
    code: "nokshi",
    name: "নকশী",
    description: "ফ্যাশন, শাড়ি ও হ্যান্ডমেড পণ্যের জন্য বিশেষ থিম",
    industry: "FASHION",
    style: "ELEGANT",
    status: "ACTIVE",
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  storeThemes.records.set("sth_nokshi", {
    id: "sth_nokshi",
    storeId: "store_nokshi",
    themeId: "thm_nokshi",
    status: "ACTIVE",
    configJson: {
      colors: {
        primary: "#8b263e",
        secondary: "#d4a373",
        background: "#ffffff",
      },
    },
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  // 8. Plans & Subscriptions
  plans.records.set("plan_free", {
    id: "plan_free",
    code: "FREE",
    name: "ফ্রি প্ল্যান",
    priceBdt: "0",
    billingCycle: "MONTHLY",
    limitsJson: {
      maxProducts: 50,
      maxOrdersPerMonth: 50,
      storageMb: 250,
      staffSeats: 2,
      overageRate: 5,
    },
    featuresJson: {
      customDomain: false,
      analyticsExport: false,
      advancedReports: false,
    },
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  subscriptions.records.set("sub_tenant_nokshi", {
    id: "sub_tenant_nokshi",
    tenantId: "tenant_nokshi",
    planId: "plan_free",
    status: "ACTIVE",
    currentPeriodStart: new Date(Date.now() - 5 * 24 * 3600 * 1000),
    currentPeriodEnd: new Date(Date.now() + 25 * 24 * 3600 * 1000),
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  // 9. Delivery Zones
  deliveryZones.records.set("zone_dhaka_inside", {
    id: "zone_dhaka_inside",
    storeId: "store_nokshi",
    name: "ঢাকা সিটির ভেতরে",
    rate: 60,
    minDays: 1,
    maxDays: 2,
    areasJson: ["Dhanmondi", "Gulshan", "Banani", "Mirpur", "Uttara"],
    isDefault: true,
    deletedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  deliveryZones.records.set("zone_dhaka_outside", {
    id: "zone_dhaka_outside",
    storeId: "store_nokshi",
    name: "ঢাকার বাইরে (সমগ্র বাংলাদেশ)",
    rate: 130,
    minDays: 3,
    maxDays: 5,
    areasJson: ["Chittagong", "Sylhet", "Rajshahi", "Khulna", "Barisal"],
    isDefault: false,
    deletedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  // 10. Sample Categories & Products
  categories.records.set("cat_saree", {
    id: "cat_saree",
    storeId: "store_nokshi",
    name: "ঐতিহ্যবাহী জামদানি",
    slug: "jamdani-saree",
    deletedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  products.records.set("prod_jamdani_red", {
    id: "prod_jamdani_red",
    storeId: "store_nokshi",
    categoryId: "cat_saree",
    title: "লাল ঢাকাই জামদানি শাড়ি",
    slug: "red-dhakai-jamdani",
    description: "হাতে বোনা পিওর কটন ঢাকাই জামদানি শাড়ি। আভিজাত্য ও ঐতিহ্যের সেরা সমন্বয়।",
    priceBdt: "6500",
    compareAtPriceBdt: "7500",
    status: "ACTIVE",
    deletedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  // Proxy wrapper matching Prisma Client operations
  const clientProxy: any = new Proxy(
    {},
    {
      get: (_, prop: string | symbol) => {
        if (typeof prop !== "string") return undefined;
        if (prop === "$connect" || prop === "$disconnect") {
          return async () => {};
        }
        if (prop === "$transaction") {
          return async (input: any) => {
            if (typeof input === "function") {
              return input(clientProxy);
            }
            if (Array.isArray(input)) {
              return Promise.all(input);
            }
            return [];
          };
        }
        if (prop === "$queryRaw" || prop === "$executeRaw") {
          return async () => [];
        }
        if (prop.startsWith("$")) {
          return async () => null;
        }

        return getCollection(prop);
      },
    },
  );

  return clientProxy;
}
