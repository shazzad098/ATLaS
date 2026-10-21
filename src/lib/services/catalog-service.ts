import { z } from "zod";
import { prisma } from "@/lib/db";
import { AppError, ConflictError, NotFoundError } from "@/lib/errors";
import { slugify } from "@/lib/slug";
import { toDecimalString } from "@/lib/money";
import type { ActorContext } from "@/lib/rbac";
import { assertPermission } from "@/lib/rbac";
import {
  EntitlementError,
  assertProductQuota,
  loadEntitlementSnapshot,
  recordUsage,
} from "@/lib/entitlements";
import { assertStoreAccess } from "@/lib/tenant";
import { adjustStock } from "@/lib/services/inventory-service";
import { recordAudit } from "@/lib/audit";

/**
 * Catalog (FR-03).
 *
 * Product/variant CRUD, CSV import with validation + dry-run, and the
 * storefront read queries. Quota enforcement happens here, not in the UI.
 */

export const variantInputSchema = z.object({
  id: z.string().optional(),
  sku: z.string().min(1).max(64),
  optionValues: z.record(z.string(), z.string()).default({}),
  price: z.union([z.string(), z.number()]),
  comparePrice: z.union([z.string(), z.number()]).nullable().optional(),
  costPrice: z.union([z.string(), z.number()]).nullable().optional(),
  stockQty: z.number().int().min(0).default(0),
  weightGrams: z.number().int().min(0).nullable().optional(),
  status: z.enum(["DRAFT", "ACTIVE", "ARCHIVED"]).default("ACTIVE"),
});

export const productInputSchema = z.object({
  name: z.string().min(2).max(160),
  slug: z.string().max(80).optional(),
  categoryId: z.string().nullable().optional(),
  description: z.string().max(8000).default(""),
  tags: z.array(z.string().max(40)).max(20).default([]),
  status: z.enum(["DRAFT", "ACTIVE", "ARCHIVED"]).default("DRAFT"),
  lowStockThreshold: z.number().int().min(0).max(1000).default(5),
  seo: z
    .object({
      title: z.string().max(160).default(""),
      description: z.string().max(320).default(""),
      ogImage: z.string().max(500).default(""),
    })
    .default({ title: "", description: "", ogImage: "" }),
  images: z
    .array(z.object({ url: z.string().min(1).max(800), altText: z.string().max(200).default("") }))
    .max(10)
    .default([]),
  variants: z.array(variantInputSchema).min(1, "কমপক্ষে একটি variant লাগবে।"),
});

export type ProductInput = z.infer<typeof productInputSchema>;

function assertCatalogWrite(actor: ActorContext) {
  assertPermission(actor, "catalog:write");
}

async function uniqueProductSlug(storeId: string, desired: string, ignoreId?: string) {
  const base = slugify(desired, { maxLength: 60 }) || "product";
  let candidate = base;
  for (let attempt = 0; attempt < 25; attempt += 1) {
    const existing = await prisma.product.findFirst({
      where: { storeId, slug: candidate, ...(ignoreId ? { id: { not: ignoreId } } : {}) },
      select: { id: true },
    });
    if (!existing) return candidate;
    candidate = `${base}-${attempt + 2}`;
  }
  throw new ConflictError("এই নামে product তৈরি করা যাচ্ছে না, অন্য নাম দিন।");
}

export async function listProducts(
  storeId: string,
  options: {
    q?: string;
    categoryId?: string;
    status?: "DRAFT" | "ACTIVE" | "ARCHIVED";
    cursor?: string | null;
    limit?: number;
  } = {},
) {
  const limit = options.limit ?? 20;
  const rows = await prisma.product.findMany({
    where: {
      storeId,
      deletedAt: null,
      ...(options.status ? { status: options.status } : { status: { not: "ARCHIVED" } }),
      ...(options.categoryId ? { categoryId: options.categoryId } : {}),
      ...(options.q
        ? {
            OR: [
              { name: { contains: options.q, mode: "insensitive" as const } },
              { tags: { has: options.q } },
              { variants: { some: { sku: { contains: options.q, mode: "insensitive" as const } } } },
            ],
          }
        : {}),
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: limit + 1,
    ...(options.cursor ? { cursor: { id: options.cursor }, skip: 1 } : {}),
    include: {
      category: { select: { id: true, name: true, slug: true } },
      images: { orderBy: { sortOrder: "asc" }, take: 1 },
      variants: { select: { id: true, sku: true, price: true, stockQty: true, reservedQty: true } },
      _count: { select: { variants: true } },
    },
  });

  const hasMore = rows.length > limit;
  const items = hasMore ? rows.slice(0, limit) : rows;
  return {
    items,
    nextCursor: hasMore ? items[items.length - 1].id : null,
    hasMore,
  };
}

export async function getProduct(storeId: string, idOrSlug: string) {
  const product = await prisma.product.findFirst({
    where: {
      storeId,
      deletedAt: null,
      OR: [{ id: idOrSlug }, { slug: idOrSlug }],
    },
    include: {
      category: true,
      images: { orderBy: { sortOrder: "asc" } },
      variants: { orderBy: { createdAt: "asc" } },
    },
  });
  if (!product) throw new NotFoundError("Product");
  return product;
}

export async function createProduct(
  actor: ActorContext,
  storeId: string,
  raw: unknown,
  options: { ip?: string } = {},
) {
  assertCatalogWrite(actor);
  await assertStoreAccess(actor, storeId);

  const input = productInputSchema.parse(raw);

  // Server-side quota check (PRD US-02). Never trust a hidden button.
  const snapshot = await loadEntitlementSnapshot(actor.tenantId);
  assertProductQuota(snapshot, 1);

  const slug = await uniqueProductSlug(storeId, input.slug || input.name);

  if (input.categoryId) {
    const category = await prisma.category.findFirst({
      where: { id: input.categoryId, storeId },
      select: { id: true },
    });
    if (!category) throw new NotFoundError("Category");
  }

  const product = await prisma.$transaction(async (tx) => {
    const created = await tx.product.create({
      data: {
        storeId,
        categoryId: input.categoryId ?? null,
        name: input.name,
        slug,
        descriptionJson: { html: input.description } as never,
        tags: input.tags,
        status: input.status,
        lowStockThreshold: input.lowStockThreshold,
        seoJson: input.seo as never,
        publishedAt: input.status === "ACTIVE" ? new Date() : null,
      },
    });

    for (const variant of input.variants) {
      await tx.productVariant.create({
        data: {
          productId: created.id,
          sku: variant.sku,
          optionValuesJson: variant.optionValues as never,
          price: toDecimalString(variant.price) as never,
          comparePrice: variant.comparePrice
            ? (toDecimalString(variant.comparePrice) as never)
            : null,
          costPrice: variant.costPrice ? (toDecimalString(variant.costPrice) as never) : null,
          stockQty: variant.stockQty,
          weightGrams: variant.weightGrams ?? null,
          status: variant.status,
        },
      });
    }

    for (const [index, image] of input.images.entries()) {
      await tx.productImage.create({
        data: { productId: created.id, url: image.url, altText: image.altText, sortOrder: index },
      });
    }

    return created;
  });

  // Initial stock is recorded as an opening movement so every unit is traceable.
  const variants = await prisma.productVariant.findMany({
    where: { productId: product.id },
    select: { id: true, stockQty: true },
  });
  for (const variant of variants) {
    if (variant.stockQty > 0) {
      await prisma.inventoryMovement.create({
        data: {
          storeId,
          variantId: variant.id,
          type: "INITIAL",
          quantityDelta: variant.stockQty,
          reason: "Opening stock on product creation",
          actorId: actor.userId,
        },
      });
    }
  }

  await recordUsage(actor.tenantId, "products_created", 1);
  await recordAudit({
    action: "product.created",
    tenantId: actor.tenantId,
    actorId: actor.userId,
    resourceType: "Product",
    resourceId: product.id,
    metadata: { name: product.name, variants: input.variants.length },
    ip: options.ip,
  });

  return product;
}

export async function updateProduct(
  actor: ActorContext,
  storeId: string,
  productId: string,
  raw: unknown,
) {
  assertCatalogWrite(actor);
  await assertStoreAccess(actor, storeId);
  const input = productInputSchema.parse(raw);

  const existing = await prisma.product.findFirst({
    where: { id: productId, storeId, deletedAt: null },
    include: { variants: true },
  });
  if (!existing) throw new NotFoundError("Product");

  const slug =
    input.slug && input.slug !== existing.slug
      ? await uniqueProductSlug(storeId, input.slug, productId)
      : existing.slug;

  await prisma.$transaction(async (tx) => {
    await tx.product.update({
      where: { id: productId },
      data: {
        name: input.name,
        slug,
        categoryId: input.categoryId ?? null,
        descriptionJson: { html: input.description } as never,
        tags: input.tags,
        status: input.status,
        lowStockThreshold: input.lowStockThreshold,
        seoJson: input.seo as never,
        publishedAt:
          input.status === "ACTIVE" ? (existing.publishedAt ?? new Date()) : existing.publishedAt,
      },
    });

    // Variants are upserted by id; quantities go through the inventory service
    // so stock changes always carry a movement row.
    const keptIds = new Set<string>();
    for (const variant of input.variants) {
      if (variant.id) {
        const current = existing.variants.find((v) => v.id === variant.id);
        if (!current) continue;
        keptIds.add(variant.id);
        await tx.productVariant.update({
          where: { id: variant.id },
          data: {
            sku: variant.sku,
            optionValuesJson: variant.optionValues as never,
            price: toDecimalString(variant.price) as never,
            comparePrice: variant.comparePrice
              ? (toDecimalString(variant.comparePrice) as never)
              : null,
            costPrice: variant.costPrice ? (toDecimalString(variant.costPrice) as never) : null,
            weightGrams: variant.weightGrams ?? null,
            status: variant.status,
          },
        });
      } else {
        const created = await tx.productVariant.create({
          data: {
            productId,
            sku: variant.sku,
            optionValuesJson: variant.optionValues as never,
            price: toDecimalString(variant.price) as never,
            comparePrice: variant.comparePrice
              ? (toDecimalString(variant.comparePrice) as never)
              : null,
            costPrice: variant.costPrice ? (toDecimalString(variant.costPrice) as never) : null,
            stockQty: variant.stockQty,
            weightGrams: variant.weightGrams ?? null,
            status: variant.status,
          },
        });
        keptIds.add(created.id);
        if (variant.stockQty > 0) {
          await tx.inventoryMovement.create({
            data: {
              storeId,
              variantId: created.id,
              type: "INITIAL",
              quantityDelta: variant.stockQty,
              reason: "Opening stock on variant creation",
              actorId: actor.userId,
            },
          });
        }
      }
    }

    // Removed variants are archived, never deleted: order history references them.
    const removed = existing.variants.filter((v) => !keptIds.has(v.id));
    if (removed.length > 0) {
      await tx.productVariant.updateMany({
        where: { id: { in: removed.map((v) => v.id) } },
        data: { status: "ARCHIVED" },
      });
    }

    await tx.productImage.deleteMany({ where: { productId } });
    for (const [index, image] of input.images.entries()) {
      await tx.productImage.create({
        data: { productId, url: image.url, altText: image.altText, sortOrder: index },
      });
    }
  });

  await recordAudit({
    action: "product.updated",
    tenantId: actor.tenantId,
    actorId: actor.userId,
    resourceType: "Product",
    resourceId: productId,
  });

  return getProduct(storeId, productId);
}

/** Soft delete (PRD Appendix B): financial history stays intact. */
export async function archiveProduct(actor: ActorContext, storeId: string, productId: string) {
  assertCatalogWrite(actor);
  await assertStoreAccess(actor, storeId);
  const product = await prisma.product.findFirst({
    where: { id: productId, storeId, deletedAt: null },
    select: { id: true },
  });
  if (!product) throw new NotFoundError("Product");

  await prisma.product.update({
    where: { id: productId },
    data: { status: "ARCHIVED", deletedAt: new Date() },
  });
  await recordAudit({
    action: "product.archived",
    tenantId: actor.tenantId,
    actorId: actor.userId,
    resourceType: "Product",
    resourceId: productId,
  });
}

export async function adjustVariantStock(
  actor: ActorContext,
  storeId: string,
  variantId: string,
  input: { delta: number; reason: string },
) {
  assertCatalogWrite(actor);
  await assertStoreAccess(actor, storeId);
  return adjustStock({
    storeId,
    variantId,
    delta: input.delta,
    type: "ADJUSTMENT",
    reason: input.reason,
    actorId: actor.userId,
  });
}

// ── Categories ───────────────────────────────────────────────────────────────

export const categoryInputSchema = z.object({
  name: z.string().min(1).max(120),
  slug: z.string().max(80).optional(),
  parentId: z.string().nullable().optional(),
  sortOrder: z.number().int().min(0).default(0),
  status: z.enum(["DRAFT", "ACTIVE", "ARCHIVED"]).default("ACTIVE"),
});

export async function listCategories(storeId: string, options: { includeArchived?: boolean } = {}) {
  return prisma.category.findMany({
    where: { storeId, ...(options.includeArchived ? {} : { status: { not: "ARCHIVED" } }) },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    include: { _count: { select: { products: true } } },
  });
}

export async function createCategory(actor: ActorContext, storeId: string, raw: unknown) {
  assertCatalogWrite(actor);
  await assertStoreAccess(actor, storeId);
  const input = categoryInputSchema.parse(raw);
  const base = slugify(input.slug || input.name, { maxLength: 60 }) || "category";

  let candidate = base;
  for (let attempt = 0; attempt < 25; attempt += 1) {
    const clash = await prisma.category.findFirst({
      where: { storeId, slug: candidate },
      select: { id: true },
    });
    if (!clash) break;
    candidate = `${base}-${attempt + 2}`;
  }

  const category = await prisma.category.create({
    data: {
      storeId,
      name: input.name,
      slug: candidate,
      parentId: input.parentId ?? null,
      sortOrder: input.sortOrder,
      status: input.status,
    },
  });

  await recordAudit({
    action: "category.created",
    tenantId: actor.tenantId,
    actorId: actor.userId,
    resourceType: "Category",
    resourceId: category.id,
  });
  return category;
}

export async function updateCategory(
  actor: ActorContext,
  storeId: string,
  categoryId: string,
  raw: unknown,
) {
  assertCatalogWrite(actor);
  await assertStoreAccess(actor, storeId);
  const input = categoryInputSchema.parse(raw);
  const updated = await prisma.category.updateMany({
    where: { id: categoryId, storeId },
    data: {
      name: input.name,
      parentId: input.parentId ?? null,
      sortOrder: input.sortOrder,
      status: input.status,
    },
  });
  if (updated.count === 0) throw new NotFoundError("Category");
  return prisma.category.findUnique({ where: { id: categoryId } });
}

// ── CSV import / export (FR-03, FR-08) ───────────────────────────────────────

export const CSV_HEADERS = [
  "name",
  "slug",
  "category",
  "sku",
  "price",
  "compare_price",
  "stock",
  "status",
  "tags",
] as const;

export type ImportRowResult = {
  row: number;
  sku: string;
  name: string;
  action: "create" | "update" | "skip";
  errors: string[];
};

function parseCsvLine(line: string): string[] {
  const cells: string[] = [];
  let current = "";
  let quoted = false;
  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (quoted) {
      if (char === '"' && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else if (char === '"') {
        quoted = false;
      } else {
        current += char;
      }
    } else if (char === '"') {
      quoted = true;
    } else if (char === ",") {
      cells.push(current);
      current = "";
    } else {
      current += char;
    }
  }
  cells.push(current);
  return cells.map((cell) => cell.trim());
}

export function parseProductCsv(csv: string): { headers: string[]; rows: string[][] } {
  const lines = csv
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
  if (lines.length === 0) return { headers: [], rows: [] };
  const headers = parseCsvLine(lines[0]).map((h) => h.toLowerCase());
  return { headers, rows: lines.slice(1).map(parseCsvLine) };
}

/**
 * Validates a CSV import and, unless `dryRun` is false, reports what would
 * happen without writing anything (FR-03 "CSV import validation ও dry-run").
 */
export async function importProductsCsv(
  actor: ActorContext,
  storeId: string,
  csv: string,
  options: { dryRun?: boolean } = {},
): Promise<{ results: ImportRowResult[]; created: number; updated: number; dryRun: boolean }> {
  assertCatalogWrite(actor);
  await assertStoreAccess(actor, storeId);
  const dryRun = options.dryRun !== false;

  if (!dryRun) {
    const snapshot = await loadEntitlementSnapshot(actor.tenantId);
    // Bulk import is a plan limit (PRD §5.1), so the dry-run stays free and only
    // the write is gated.
    if (!snapshot.limits.bulkTools) {
      throw new EntitlementError(
        "CSV import করে একসাথে অনেক পণ্য যোগ করা Basic plan থেকে চালু হয়। dry-run এখনই করতে পারবেন।",
        { metric: "bulk_tools", planCode: snapshot.planCode, upgradeTo: "basic" },
      );
    }
  }

  const { headers, rows } = parseProductCsv(csv);
  const required = ["name", "sku", "price"];
  const missing = required.filter((header) => !headers.includes(header));
  if (missing.length > 0) {
    throw new AppError(
      "VALIDATION_FAILED",
      `CSV-এ প্রয়োজনীয় column নেই: ${missing.join(", ")}`,
      422,
      { required, found: headers },
    );
  }

  const index = Object.fromEntries(headers.map((header, i) => [header, i]));
  const results: ImportRowResult[] = [];
  let created = 0;
  let updated = 0;

  const categories = await listCategories(storeId);
  const categoryBySlug = new Map(categories.map((c) => [c.slug, c.id]));

  for (const [position, row] of rows.entries()) {
    const errors: string[] = [];
    const name = row[index.name] ?? "";
    const sku = row[index.sku] ?? "";
    const priceRaw = row[index.price] ?? "";
    const price = Number(priceRaw);

    if (name.length < 2) errors.push("name খুব ছোট");
    if (!sku) errors.push("sku খালি");
    if (!Number.isFinite(price) || price < 0) errors.push("price সংখ্যা নয়");

    const categorySlug = index.category !== undefined ? (row[index.category] ?? "") : "";
    let categoryId: string | null = null;
    if (categorySlug) {
      const existingId = categoryBySlug.get(slugify(categorySlug));
      if (existingId) {
        categoryId = existingId;
      } else if (!dryRun) {
        const category = await createCategory(actor, storeId, { name: categorySlug });
        categoryBySlug.set(category.slug, category.id);
        categoryId = category.id;
      }
    }

    const existingVariant = sku
      ? await prisma.productVariant.findFirst({
          where: { sku, product: { storeId, deletedAt: null } },
          select: { id: true, productId: true },
        })
      : null;

    const action: ImportRowResult["action"] =
      errors.length > 0 ? "skip" : existingVariant ? "update" : "create";

    if (errors.length === 0 && !dryRun) {
      if (existingVariant) {
        await prisma.productVariant.update({
          where: { id: existingVariant.id },
          data: {
            price: toDecimalString(price) as never,
            comparePrice: index.compare_price !== undefined && row[index.compare_price]
              ? (toDecimalString(row[index.compare_price]) as never)
              : null,
          },
        });
        updated += 1;
      } else {
        await createProduct(
          actor,
          storeId,
          {
            name,
            slug: index.slug !== undefined ? row[index.slug] : undefined,
            categoryId,
            status: (index.status !== undefined ? row[index.status] : "DRAFT").toUpperCase(),
            tags:
              index.tags !== undefined && row[index.tags]
                ? row[index.tags].split("|").map((t) => t.trim()).filter(Boolean)
                : [],
            variants: [
              {
                sku,
                price,
                comparePrice:
                  index.compare_price !== undefined && row[index.compare_price]
                    ? row[index.compare_price]
                    : null,
                stockQty: index.stock !== undefined ? Number(row[index.stock] ?? 0) || 0 : 0,
                optionValues: {},
              },
            ],
          },
        );
        created += 1;
      }
    }

    results.push({ row: position + 2, sku, name, action, errors });
  }

  return { results, created, updated, dryRun };
}

export function exportProductsCsv(
  products: Array<{
    name: string;
    slug: string;
    category?: { slug: string } | null;
    tags: string[];
    status: string;
    variants: Array<{
      sku: string;
      price: unknown;
      comparePrice: unknown;
      stockQty: number;
    }>;
  }>,
): string {
  const lines = [CSV_HEADERS.join(",")];
  for (const product of products) {
    for (const variant of product.variants) {
      lines.push(
        [
          quoteCsv(product.name),
          quoteCsv(product.slug),
          quoteCsv(product.category?.slug ?? ""),
          quoteCsv(variant.sku),
          String(variant.price ?? ""),
          String(variant.comparePrice ?? ""),
          String(variant.stockQty),
          product.status,
          quoteCsv(product.tags.join("|")),
        ].join(","),
      );
    }
  }
  return lines.join("\n");
}

function quoteCsv(value: string): string {
  if (/[",\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

// ── Storefront reads ─────────────────────────────────────────────────────────

export async function storefrontProducts(
  storeId: string,
  options: {
    q?: string;
    categorySlug?: string;
    sort?: "newest" | "price-asc" | "price-desc" | "name";
    page?: number;
    perPage?: number;
  } = {},
) {
  const perPage = Math.min(options.perPage ?? 12, 48);
  const page = Math.max(options.page ?? 1, 1);

  const where = {
    storeId,
    deletedAt: null,
    status: "ACTIVE" as const,
    ...(options.categorySlug ? { category: { slug: options.categorySlug, storeId } } : {}),
    ...(options.q
      ? {
          OR: [
            { name: { contains: options.q, mode: "insensitive" as const } },
            { tags: { has: options.q } },
          ],
        }
      : {}),
  };

  const orderBy =
    options.sort === "name"
      ? { name: "asc" as const }
      : { createdAt: "desc" as const };

  const [total, rows] = await Promise.all([
    prisma.product.count({ where }),
    prisma.product.findMany({
      where,
      orderBy,
      skip: (page - 1) * perPage,
      take: perPage,
      include: {
        category: { select: { name: true, slug: true } },
        images: { orderBy: { sortOrder: "asc" }, take: 1 },
        variants: { select: { id: true, price: true, comparePrice: true, stockQty: true, reservedQty: true } },
      },
    }),
  ]);

  const items = rows.map((row) => {
    const prices = row.variants.map((v) => Number(v.price)).filter((n) => Number.isFinite(n));
    return {
      ...row,
      priceFrom: prices.length > 0 ? Math.min(...prices) : 0,
      inStock: row.variants.some((v) => v.stockQty - v.reservedQty > 0),
    };
  });

  // Price sorting is applied after the query because it depends on variants.
  if (options.sort === "price-asc") items.sort((a, b) => a.priceFrom - b.priceFrom);
  if (options.sort === "price-desc") items.sort((a, b) => b.priceFrom - a.priceFrom);

  return { items, total, page, perPage, pageCount: Math.max(1, Math.ceil(total / perPage)) };
}

export async function storefrontProduct(storeId: string, slug: string) {
  const product = await prisma.product.findFirst({
    where: { storeId, slug, status: "ACTIVE", deletedAt: null },
    include: {
      category: true,
      images: { orderBy: { sortOrder: "asc" } },
      variants: { where: { status: "ACTIVE" }, orderBy: { createdAt: "asc" } },
    },
  });
  if (!product) return null;

  const related = await prisma.product.findMany({
    where: {
      storeId,
      status: "ACTIVE",
      deletedAt: null,
      id: { not: product.id },
      ...(product.categoryId ? { categoryId: product.categoryId } : {}),
    },
    take: 4,
    include: { images: { orderBy: { sortOrder: "asc" }, take: 1 }, variants: { take: 1 } },
  });

  return { product, related };
}
