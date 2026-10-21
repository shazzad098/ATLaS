import Papa from "papaparse";
import { and, asc, desc, eq, inArray, isNull, like, ne, or, sql } from "drizzle-orm";
import { db, affected, type DbOrTx } from "../db";
import { assets, categories, inventoryMovements, productImages, products, productVariants } from "../../drizzle/schema";
import { fail, slugify, toP } from "../lib/core";
import { storagePut } from "../storage";
import { assertFeature, assertProductQuota, assertStorageQuota, productCount } from "./billing";
import { audit, emitEvent, notifyTenant, track } from "./ops";
import { requirePerm, requireWrite, type TenantScope } from "./tenancy";

/* ───────── Categories ───────── */
export async function listCategories(storeId: number, includeHidden = true) {
  const rows = await db()
    .select({
      id: categories.id,
      name: categories.name,
      nameBn: categories.nameBn,
      slug: categories.slug,
      imageUrl: categories.imageUrl,
      parentId: categories.parentId,
      sortOrder: categories.sortOrder,
      status: categories.status,
      productCount: sql<number>`(select count(*) from ${products} p where p.categoryId = ${categories.id} and p.deletedAt is null and p.status = 'active')`,
    })
    .from(categories)
    .where(includeHidden ? eq(categories.storeId, storeId) : and(eq(categories.storeId, storeId), eq(categories.status, "active")))
    .orderBy(asc(categories.sortOrder), asc(categories.name));
  return rows.map(r => ({ ...r, productCount: Number(r.productCount) }));
}

export async function upsertCategory(scope: TenantScope, input: { id?: number; name: string; nameBn?: string; imageUrl?: string; parentId?: number | null; sortOrder?: number; status: "active" | "hidden" }) {
  requireWrite(scope, "catalog.write");
  const slugBase = slugify(input.name);
  if (input.id) {
    await db()
      .update(categories)
      .set({ name: input.name, nameBn: input.nameBn ?? null, imageUrl: input.imageUrl ?? null, parentId: input.parentId ?? null, sortOrder: input.sortOrder ?? 0, status: input.status })
      .where(and(eq(categories.id, input.id), eq(categories.storeId, scope.storeId)));
    return input.id;
  }
  let slug = slugBase;
  for (let i = 2; i < 50; i++) {
    const [ex] = await db().select({ id: categories.id }).from(categories).where(and(eq(categories.storeId, scope.storeId), eq(categories.slug, slug))).limit(1);
    if (!ex) break;
    slug = `${slugBase}-${i}`;
  }
  const [row] = await db()
    .insert(categories)
    .values({ storeId: scope.storeId, name: input.name, nameBn: input.nameBn ?? null, slug, imageUrl: input.imageUrl ?? null, parentId: input.parentId ?? null, sortOrder: input.sortOrder ?? 0, status: input.status })
    .$returningId();
  return row.id;
}

export async function deleteCategory(scope: TenantScope, id: number) {
  requireWrite(scope, "catalog.write");
  await db().update(products).set({ categoryId: null }).where(and(eq(products.storeId, scope.storeId), eq(products.categoryId, id)));
  await db().delete(categories).where(and(eq(categories.id, id), eq(categories.storeId, scope.storeId)));
}

/* ───────── Products ───────── */
export type VariantInput = { id?: number; sku?: string | null; options: Record<string, string>; price: string; comparePrice?: string | null; stockQty?: number; status?: "active" | "inactive" };
export type ProductInput = {
  name: string;
  nameBn?: string | null;
  slug?: string;
  description: { en: string; bn?: string };
  categoryId?: number | null;
  status: "draft" | "active" | "archived";
  tags: string[];
  seo: { title?: string; description?: string; ogImage?: string };
  featured: boolean;
  lowStockThreshold: number;
  optionNames: string[];
  variants: VariantInput[];
  images: { url: string; assetId?: number | null; altText?: string | null }[];
};

async function uniqueProductSlug(storeId: number, base: string, excludeId?: number) {
  const b = slugify(base);
  let slug = b;
  for (let i = 2; i < 200; i++) {
    const [ex] = await db()
      .select({ id: products.id })
      .from(products)
      .where(and(eq(products.storeId, storeId), eq(products.slug, slug), excludeId ? ne(products.id, excludeId) : undefined))
      .limit(1);
    if (!ex) return slug;
    slug = `${b}-${i}`;
  }
  return `${b}-${Date.now()}`;
}

function validateVariants(input: ProductInput) {
  if (!input.variants.length) fail("VALIDATION", "Add at least one price/variant");
  const seen = new Set<string>();
  for (const v of input.variants) {
    if (!(toP(v.price) > 0)) fail("VALIDATION", "Every variant needs a price greater than 0");
    if (v.comparePrice && toP(v.comparePrice) > 0 && toP(v.comparePrice) <= toP(v.price)) fail("VALIDATION", "Compare-at price must be higher than the price");
    const key = input.optionNames.map(n => v.options[n] ?? "").join("|");
    if (seen.has(key)) fail("VALIDATION", `Duplicate variant combination: ${key || "default"}`);
    seen.add(key);
    if ((v.stockQty ?? 0) < 0) fail("VALIDATION", "Stock can't be negative");
  }
}

async function recordMovement(
  tx: DbOrTx,
  m: { storeId: number; variantId: number; type: (typeof inventoryMovements.$inferInsert)["type"]; delta: number; affects?: "stock" | "reserved"; reason?: string; refType?: string; refId?: string | number; actorId?: number | null }
) {
  const [v] = await tx.select({ stockQty: productVariants.stockQty, reservedQty: productVariants.reservedQty }).from(productVariants).where(eq(productVariants.id, m.variantId)).limit(1);
  await tx.insert(inventoryMovements).values({
    storeId: m.storeId,
    variantId: m.variantId,
    type: m.type,
    quantityDelta: m.delta,
    affects: m.affects ?? "stock",
    balanceAfter: m.affects === "reserved" ? (v?.reservedQty ?? null) : (v?.stockQty ?? null),
    reason: m.reason ?? null,
    referenceType: m.refType ?? null,
    referenceId: m.refId !== undefined ? String(m.refId) : null,
    actorId: m.actorId ?? null,
  });
}

export async function createProduct(scope: TenantScope, input: ProductInput, actorId: number, opts: { skipQuota?: boolean; source?: string } = {}) {
  requireWrite(scope, "catalog.write");
  if (input.status !== "archived" && !opts.skipQuota) await assertProductQuota(scope.ent, scope.storeId, 1);
  validateVariants(input);
  const isFirst = (await productCount(scope.storeId)) === 0;
  const slug = await uniqueProductSlug(scope.storeId, input.slug || input.name);
  let productId = 0;
  try {
    productId = await db().transaction(async tx => {
      const [p] = await tx
        .insert(products)
        .values({
          storeId: scope.storeId,
          categoryId: input.categoryId ?? null,
          name: input.name.trim(),
          nameBn: input.nameBn ?? null,
          slug,
          descriptionJson: input.description,
          status: input.status,
          tagsJson: input.tags,
          seoJson: input.seo,
          optionNamesJson: input.optionNames,
          lowStockThreshold: input.lowStockThreshold,
          featured: input.featured,
        })
        .$returningId();
      for (const [i, v] of input.variants.entries()) {
        const [vr] = await tx
          .insert(productVariants)
          .values({
            productId: p.id,
            storeId: scope.storeId,
            sku: v.sku?.trim() || null,
            optionValuesJson: v.options,
            price: v.price,
            comparePrice: v.comparePrice || null,
            stockQty: v.stockQty ?? 0,
            isDefault: i === 0,
            status: v.status ?? "active",
          })
          .$returningId();
        if ((v.stockQty ?? 0) !== 0) await recordMovement(tx, { storeId: scope.storeId, variantId: vr.id, type: opts.source === "import" ? "import" : "initial", delta: v.stockQty ?? 0, reason: "Initial stock", refType: "product", refId: p.id, actorId });
      }
      for (const [i, img] of input.images.entries()) await tx.insert(productImages).values({ productId: p.id, url: img.url, assetId: img.assetId ?? null, altText: img.altText ?? null, sortOrder: i });
      return p.id;
    });
  } catch (e) {
    if (String((e as Error).message).includes("variants_store_sku_uq")) fail("CONFLICT", "A variant with this SKU already exists in your store");
    throw e;
  }
  await audit({ tenantId: scope.tenantId, actorId, actorType: "merchant", action: "product.created", resourceType: "product", resourceId: productId, impersonationId: scope.impersonationId });
  await emitEvent(scope.tenantId, scope.storeId, "product.created", { productId, name: input.name });
  if (isFirst) await track("first_product_created", { tenantId: scope.tenantId, storeId: scope.storeId, userId: actorId });
  return productId;
}

async function productInStore(storeId: number, id: number) {
  const [p] = await db().select().from(products).where(and(eq(products.id, id), eq(products.storeId, storeId), isNull(products.deletedAt))).limit(1);
  if (!p) fail("NOT_FOUND", "Product not found");
  return p;
}

export async function updateProduct(scope: TenantScope, id: number, input: ProductInput, actorId: number) {
  requireWrite(scope, "catalog.write");
  const p = await productInStore(scope.storeId, id);
  if (p.status === "archived" && input.status !== "archived") await assertProductQuota(scope.ent, scope.storeId, 1);
  validateVariants(input);
  const slug = input.slug && input.slug !== p.slug ? await uniqueProductSlug(scope.storeId, input.slug, id) : p.slug;
  const existing = await db().select().from(productVariants).where(eq(productVariants.productId, id));
  try {
    await db().transaction(async tx => {
      await tx
        .update(products)
        .set({
          categoryId: input.categoryId ?? null,
          name: input.name.trim(),
          nameBn: input.nameBn ?? null,
          slug,
          descriptionJson: input.description,
          status: input.status,
          tagsJson: input.tags,
          seoJson: input.seo,
          optionNamesJson: input.optionNames,
          lowStockThreshold: input.lowStockThreshold,
          featured: input.featured,
        })
        .where(eq(products.id, id));
      const keep = new Set<number>();
      for (const v of input.variants) {
        if (v.id && existing.some(e => e.id === v.id)) {
          keep.add(v.id);
          await tx
            .update(productVariants)
            .set({ sku: v.sku?.trim() || null, optionValuesJson: v.options, price: v.price, comparePrice: v.comparePrice || null, status: v.status ?? "active" })
            .where(eq(productVariants.id, v.id));
        } else {
          const [vr] = await tx
            .insert(productVariants)
            .values({ productId: id, storeId: scope.storeId, sku: v.sku?.trim() || null, optionValuesJson: v.options, price: v.price, comparePrice: v.comparePrice || null, stockQty: v.stockQty ?? 0, status: v.status ?? "active" })
            .$returningId();
          keep.add(vr.id);
          if ((v.stockQty ?? 0) !== 0) await recordMovement(tx, { storeId: scope.storeId, variantId: vr.id, type: "initial", delta: v.stockQty ?? 0, reason: "Initial stock (new variant)", refType: "product", refId: id, actorId });
        }
      }
      // Removed variants are deactivated (never deleted) to preserve order history.
      for (const e of existing) if (!keep.has(e.id)) await tx.update(productVariants).set({ status: "inactive", isDefault: false }).where(eq(productVariants.id, e.id));
      const firstActive = input.variants[0]?.id ?? null;
      await tx.update(productVariants).set({ isDefault: false }).where(eq(productVariants.productId, id));
      if (firstActive) await tx.update(productVariants).set({ isDefault: true }).where(eq(productVariants.id, firstActive));
      else {
        const [first] = await tx.select({ id: productVariants.id }).from(productVariants).where(and(eq(productVariants.productId, id), eq(productVariants.status, "active"))).orderBy(asc(productVariants.id)).limit(1);
        if (first) await tx.update(productVariants).set({ isDefault: true }).where(eq(productVariants.id, first.id));
      }
      await tx.delete(productImages).where(eq(productImages.productId, id));
      for (const [i, img] of input.images.entries()) await tx.insert(productImages).values({ productId: id, url: img.url, assetId: img.assetId ?? null, altText: img.altText ?? null, sortOrder: i });
    });
  } catch (e) {
    if (String((e as Error).message).includes("variants_store_sku_uq")) fail("CONFLICT", "A variant with this SKU already exists in your store");
    throw e;
  }
  await audit({ tenantId: scope.tenantId, actorId, actorType: "merchant", action: "product.updated", resourceType: "product", resourceId: id, impersonationId: scope.impersonationId });
  await emitEvent(scope.tenantId, scope.storeId, "product.updated", { productId: id });
}

export async function setProductStatus(scope: TenantScope, ids: number[], status: "draft" | "active" | "archived", actorId: number) {
  requireWrite(scope, "catalog.write");
  if (status !== "archived") {
    const archived = await db()
      .select({ id: products.id })
      .from(products)
      .where(and(eq(products.storeId, scope.storeId), inArray(products.id, ids), eq(products.status, "archived")));
    if (archived.length) await assertProductQuota(scope.ent, scope.storeId, archived.length);
  }
  await db().update(products).set({ status }).where(and(eq(products.storeId, scope.storeId), inArray(products.id, ids)));
  await audit({ tenantId: scope.tenantId, actorId, actorType: "merchant", action: `product.${status}`, resourceType: "product", resourceId: ids.join(","), impersonationId: scope.impersonationId });
}

export async function deleteProduct(scope: TenantScope, id: number, actorId: number) {
  requireWrite(scope, "catalog.write");
  await productInStore(scope.storeId, id);
  await db().update(products).set({ deletedAt: new Date(), status: "archived" }).where(eq(products.id, id));
  await audit({ tenantId: scope.tenantId, actorId, actorType: "merchant", action: "product.deleted", resourceType: "product", resourceId: id, impersonationId: scope.impersonationId });
}

export async function listProducts(
  storeId: number,
  q: { search?: string; status?: "draft" | "active" | "archived" | "all"; categoryId?: number | null; page: number; pageSize: number; lowStock?: boolean; sort?: string; featured?: boolean; ids?: number[] }
) {
  const conds = [eq(products.storeId, storeId), isNull(products.deletedAt)];
  if (q.status && q.status !== "all") conds.push(eq(products.status, q.status));
  if (q.categoryId) conds.push(eq(products.categoryId, q.categoryId));
  if (q.featured) conds.push(eq(products.featured, true));
  if (q.ids?.length) conds.push(inArray(products.id, q.ids));
  if (q.search?.trim()) {
    const s = `%${q.search.trim()}%`;
    conds.push(
      or(
        like(products.name, s),
        like(products.nameBn, s),
        like(products.tagsJson, s),
        sql`exists (select 1 from ${productVariants} v where v.productId = ${products.id} and v.sku like ${s})`
      )!
    );
  }
  const priceExpr = sql<string>`(select min(v.price) from ${productVariants} v where v.productId = ${products.id} and v.status = 'active')`;
  const stockExpr = sql<number>`(select coalesce(sum(v.stockQty - v.reservedQty),0) from ${productVariants} v where v.productId = ${products.id} and v.status = 'active')`;
  if (q.lowStock) conds.push(sql`${stockExpr} <= ${products.lowStockThreshold}`);
  const order =
    q.sort === "price_asc"
      ? [asc(priceExpr)]
      : q.sort === "price_desc"
        ? [desc(priceExpr)]
        : q.sort === "name"
          ? [asc(products.name)]
          : q.sort === "popular"
            ? [desc(sql`(select coalesce(sum(oi.quantity),0) from order_items oi where oi.productId = ${products.id})`)]
            : [desc(products.createdAt), desc(products.id)];
  const where = and(...conds);
  const [{ total }] = await db().select({ total: sql<number>`count(*)` }).from(products).where(where);
  const rows = await db()
    .select({
      id: products.id,
      name: products.name,
      nameBn: products.nameBn,
      slug: products.slug,
      status: products.status,
      featured: products.featured,
      categoryId: products.categoryId,
      lowStockThreshold: products.lowStockThreshold,
      tags: products.tagsJson,
      createdAt: products.createdAt,
      price: priceExpr,
      comparePrice: sql<string | null>`(select max(v.comparePrice) from ${productVariants} v where v.productId = ${products.id} and v.status = 'active')`,
      available: stockExpr,
      variantCount: sql<number>`(select count(*) from ${productVariants} v where v.productId = ${products.id} and v.status = 'active')`,
      image: sql<string | null>`(select i.url from ${productImages} i where i.productId = ${products.id} order by i.sortOrder limit 1)`,
      image2: sql<string | null>`(select i.url from ${productImages} i where i.productId = ${products.id} order by i.sortOrder limit 1 offset 1)`,
    })
    .from(products)
    .where(where)
    .orderBy(...order)
    .limit(q.pageSize)
    .offset((q.page - 1) * q.pageSize);
  return { items: rows.map(r => ({ ...r, available: Number(r.available), variantCount: Number(r.variantCount) })), total: Number(total), page: q.page, pageSize: q.pageSize };
}

export async function getProduct(storeId: number, idOrSlug: number | string) {
  const [p] = await db()
    .select()
    .from(products)
    .where(and(eq(products.storeId, storeId), isNull(products.deletedAt), typeof idOrSlug === "number" ? eq(products.id, idOrSlug) : eq(products.slug, idOrSlug)))
    .limit(1);
  if (!p) return null;
  const variants = await db().select().from(productVariants).where(eq(productVariants.productId, p.id)).orderBy(desc(productVariants.isDefault), asc(productVariants.id));
  const images = await db().select().from(productImages).where(eq(productImages.productId, p.id)).orderBy(asc(productImages.sortOrder));
  return { ...p, variants, images };
}

/* ───────── Inventory ledger & atomic reservations ───────── */
export async function adjustStock(scope: TenantScope, variantId: number, delta: number, reason: string, actorId: number) {
  requireWrite(scope, "inventory.adjust");
  if (!Number.isInteger(delta) || delta === 0) fail("VALIDATION", "Adjustment must be a non-zero whole number");
  if (!reason.trim()) fail("VALIDATION", "A reason is required for every stock adjustment");
  const ok = affected(
    await db()
      .update(productVariants)
      .set({ stockQty: sql`${productVariants.stockQty} + ${delta}` })
      .where(and(eq(productVariants.id, variantId), eq(productVariants.storeId, scope.storeId), sql`${productVariants.stockQty} + ${delta} >= ${productVariants.reservedQty}`))
  );
  if (!ok) fail("INVALID_STATE", "Stock can't go below the quantity reserved for open orders");
  await recordMovement(db(), { storeId: scope.storeId, variantId, type: "adjustment", delta, reason: reason.trim(), actorId });
  await audit({ tenantId: scope.tenantId, actorId, actorType: "merchant", action: "inventory.adjusted", resourceType: "variant", resourceId: variantId, metadata: { delta, reason }, impersonationId: scope.impersonationId });
  await checkLowStock(scope.tenantId, scope.storeId, [variantId]);
}

export async function checkLowStock(tenantId: number, storeId: number, variantIds: number[]) {
  if (!variantIds.length) return;
  const rows = await db()
    .select({ id: productVariants.id, available: sql<number>`${productVariants.stockQty} - ${productVariants.reservedQty}`, threshold: products.lowStockThreshold, name: products.name, productId: products.id, sku: productVariants.sku })
    .from(productVariants)
    .innerJoin(products, eq(products.id, productVariants.productId))
    .where(and(eq(productVariants.storeId, storeId), inArray(productVariants.id, variantIds)));
  for (const r of rows) {
    if (Number(r.available) <= r.threshold) {
      await notifyTenant(tenantId, "catalog.read", {
        type: "inventory.low_stock",
        title: `Low stock: ${r.name}`,
        body: `${Number(r.available)} left${r.sku ? ` (SKU ${r.sku})` : ""}. Restock soon to avoid missed orders.`,
        link: `/app/products/${r.productId}`,
        dedupeKey: `lowstock:${r.id}:${new Date().toISOString().slice(0, 10)}`,
      });
      await emitEvent(tenantId, storeId, "inventory.low_stock", { variantId: r.id, productId: r.productId, available: Number(r.available) });
    }
  }
}

export async function reserveStock(tx: DbOrTx, storeId: number, variantId: number, qty: number, ref: string) {
  const ok = affected(
    await tx
      .update(productVariants)
      .set({ reservedQty: sql`${productVariants.reservedQty} + ${qty}` })
      .where(and(eq(productVariants.id, variantId), eq(productVariants.storeId, storeId), eq(productVariants.status, "active"), sql`${productVariants.stockQty} - ${productVariants.reservedQty} >= ${qty}`))
  );
  if (!ok) return false;
  await recordMovement(tx, { storeId, variantId, type: "reserve", delta: qty, affects: "reserved", refType: "order", refId: ref });
  return true;
}
export async function releaseStock(tx: DbOrTx, storeId: number, variantId: number, qty: number, ref: string, reason: string) {
  await tx
    .update(productVariants)
    .set({ reservedQty: sql`GREATEST(0, ${productVariants.reservedQty} - ${qty})` })
    .where(and(eq(productVariants.id, variantId), eq(productVariants.storeId, storeId)));
  await recordMovement(tx, { storeId, variantId, type: "release", delta: -qty, affects: "reserved", refType: "order", refId: ref, reason });
}
export async function commitStock(tx: DbOrTx, storeId: number, variantId: number, qty: number, ref: string) {
  await tx
    .update(productVariants)
    .set({ stockQty: sql`${productVariants.stockQty} - ${qty}`, reservedQty: sql`GREATEST(0, ${productVariants.reservedQty} - ${qty})` })
    .where(and(eq(productVariants.id, variantId), eq(productVariants.storeId, storeId)));
  await recordMovement(tx, { storeId, variantId, type: "sale", delta: -qty, refType: "order", refId: ref });
}
export async function restock(tx: DbOrTx, storeId: number, variantId: number, qty: number, ref: string, type: "cancel_restock" | "return", actorId?: number | null) {
  await tx
    .update(productVariants)
    .set({ stockQty: sql`${productVariants.stockQty} + ${qty}` })
    .where(and(eq(productVariants.id, variantId), eq(productVariants.storeId, storeId)));
  await recordMovement(tx, { storeId, variantId, type, delta: qty, refType: "order", refId: ref, actorId, reason: type === "return" ? "Returned items restocked" : "Order cancelled" });
}

export async function inventoryLedger(scope: TenantScope, q: { variantId?: number; page: number; pageSize: number }) {
  requirePerm(scope, "catalog.read");
  const where = and(eq(inventoryMovements.storeId, scope.storeId), q.variantId ? eq(inventoryMovements.variantId, q.variantId) : undefined);
  const [{ total }] = await db().select({ total: sql<number>`count(*)` }).from(inventoryMovements).where(where);
  const rows = await db()
    .select({ m: inventoryMovements, productName: products.name, sku: productVariants.sku, options: productVariants.optionValuesJson })
    .from(inventoryMovements)
    .innerJoin(productVariants, eq(productVariants.id, inventoryMovements.variantId))
    .innerJoin(products, eq(products.id, productVariants.productId))
    .where(where)
    .orderBy(desc(inventoryMovements.id))
    .limit(q.pageSize)
    .offset((q.page - 1) * q.pageSize);
  return { items: rows, total: Number(total) };
}

export async function inventoryOverview(scope: TenantScope, search?: string) {
  requirePerm(scope, "catalog.read");
  const s = search?.trim() ? `%${search.trim()}%` : null;
  return db()
    .select({
      variantId: productVariants.id,
      productId: products.id,
      name: products.name,
      sku: productVariants.sku,
      options: productVariants.optionValuesJson,
      stockQty: productVariants.stockQty,
      reservedQty: productVariants.reservedQty,
      threshold: products.lowStockThreshold,
      status: productVariants.status,
      price: productVariants.price,
    })
    .from(productVariants)
    .innerJoin(products, eq(products.id, productVariants.productId))
    .where(and(eq(productVariants.storeId, scope.storeId), isNull(products.deletedAt), eq(productVariants.status, "active"), s ? or(like(products.name, s), like(productVariants.sku, s)) : undefined))
    .orderBy(asc(sql`${productVariants.stockQty} - ${productVariants.reservedQty}`))
    .limit(300);
}

/* ───────── CSV import (validation + dry-run) & export ───────── */
export const CSV_COLUMNS = [
  "name",
  "name_bn",
  "slug",
  "category",
  "description",
  "status",
  "tags",
  "featured",
  "low_stock_threshold",
  "sku",
  "price",
  "compare_price",
  "stock",
  "option1_name",
  "option1_value",
  "option2_name",
  "option2_value",
  "image_url",
] as const;

type ImportError = { row: number; field: string; message: string };
type ImportPlanItem = { key: string; slug: string; existingId: number | null; input: ProductInput; categoryName: string | null; rows: number[] };

export async function planImport(scope: TenantScope, csvText: string) {
  requirePerm(scope, "catalog.write");
  const parsed = Papa.parse<Record<string, string>>(csvText.trim(), { header: true, skipEmptyLines: true, transformHeader: h => h.trim().toLowerCase() });
  const errors: ImportError[] = [];
  if (parsed.errors.length) for (const e of parsed.errors.slice(0, 20)) errors.push({ row: (e.row ?? 0) + 2, field: "csv", message: e.message });
  const rows = parsed.data;
  if (rows.length > 2000) fail("VALIDATION", "Import up to 2,000 rows at a time");
  const missing = ["name", "price"].filter(c => !parsed.meta.fields?.includes(c));
  if (missing.length) fail("VALIDATION", `Missing required column(s): ${missing.join(", ")}`);
  const groups = new Map<string, ImportPlanItem>();
  const skus = new Set<string>();
  rows.forEach((r, i) => {
    const rowNo = i + 2;
    const name = (r.name ?? "").trim();
    if (!name) return errors.push({ row: rowNo, field: "name", message: "Name is required" });
    const price = Number((r.price ?? "").replace(/[৳,\s]/g, ""));
    if (!(price > 0)) return errors.push({ row: rowNo, field: "price", message: "Price must be a number greater than 0" });
    const compare = r.compare_price ? Number(r.compare_price.replace(/[৳,\s]/g, "")) : null;
    if (compare !== null && (isNaN(compare) || compare <= price)) errors.push({ row: rowNo, field: "compare_price", message: "Compare price must be higher than price" });
    const stock = r.stock ? Number(r.stock) : 0;
    if (!Number.isInteger(stock) || stock < 0) return errors.push({ row: rowNo, field: "stock", message: "Stock must be a whole number ≥ 0" });
    const status = (r.status || "active").trim().toLowerCase();
    if (!["draft", "active", "archived"].includes(status)) errors.push({ row: rowNo, field: "status", message: "Status must be draft, active or archived" });
    const sku = r.sku?.trim();
    if (sku) {
      if (skus.has(sku)) errors.push({ row: rowNo, field: "sku", message: `Duplicate SKU ${sku} in file` });
      skus.add(sku);
    }
    if (r.image_url && !/^https?:\/\/|^\/manus-storage\//.test(r.image_url.trim())) errors.push({ row: rowNo, field: "image_url", message: "Image URL must start with https://" });
    const slug = slugify(r.slug?.trim() || name);
    const options: Record<string, string> = {};
    const optionNames: string[] = [];
    if (r.option1_name?.trim() && r.option1_value?.trim()) {
      options[r.option1_name.trim()] = r.option1_value.trim();
      optionNames.push(r.option1_name.trim());
    }
    if (r.option2_name?.trim() && r.option2_value?.trim()) {
      options[r.option2_name.trim()] = r.option2_value.trim();
      optionNames.push(r.option2_name.trim());
    }
    let g = groups.get(slug);
    if (!g) {
      g = {
        key: slug,
        slug,
        existingId: null,
        categoryName: r.category?.trim() || null,
        rows: [],
        input: {
          name,
          nameBn: r.name_bn?.trim() || null,
          slug,
          description: { en: r.description?.trim() ?? "" },
          categoryId: null,
          status: (["draft", "active", "archived"].includes(status) ? status : "active") as ProductInput["status"],
          tags: (r.tags ?? "").split("|").map(t => t.trim()).filter(Boolean),
          seo: {},
          featured: ["1", "true", "yes"].includes((r.featured ?? "").toLowerCase()),
          lowStockThreshold: r.low_stock_threshold ? Math.max(0, Number(r.low_stock_threshold) || 5) : 5,
          optionNames,
          variants: [],
          images: [],
        },
      };
      groups.set(slug, g);
    }
    g.rows.push(rowNo);
    for (const n of optionNames) if (!g.input.optionNames.includes(n)) g.input.optionNames.push(n);
    g.input.variants.push({ sku: sku || null, options, price: price.toFixed(2), comparePrice: compare ? compare.toFixed(2) : null, stockQty: stock });
    if (r.image_url?.trim() && !g.input.images.some(im => im.url === r.image_url.trim())) g.input.images.push({ url: r.image_url.trim() });
  });
  for (const g of Array.from(groups.values())) {
    const keys = new Set<string>();
    for (const v of g.input.variants) {
      const k = g.input.optionNames.map(n => v.options[n] ?? "").join("|");
      if (keys.has(k)) errors.push({ row: g.rows[0], field: "options", message: `Duplicate variant "${k || "default"}" for ${g.input.name}` });
      keys.add(k);
    }
  }
  const slugs = Array.from(groups.keys());
  if (slugs.length) {
    const existing = await db()
      .select({ id: products.id, slug: products.slug })
      .from(products)
      .where(and(eq(products.storeId, scope.storeId), inArray(products.slug, slugs), isNull(products.deletedAt)));
    for (const e of existing) groups.get(e.slug)!.existingId = e.id;
  }
  if (skus.size) {
    const taken = await db()
      .select({ sku: productVariants.sku, productId: productVariants.productId })
      .from(productVariants)
      .where(and(eq(productVariants.storeId, scope.storeId), inArray(productVariants.sku, Array.from(skus))));
    for (const t of taken) {
      const g = Array.from(groups.values()).find(x => x.input.variants.some(v => v.sku === t.sku));
      if (g && g.existingId !== t.productId) errors.push({ row: g.rows[0], field: "sku", message: `SKU ${t.sku} already belongs to another product` });
    }
  }
  const items = Array.from(groups.values());
  const toCreate = items.filter(i => !i.existingId && i.input.status !== "archived").length;
  const used = await productCount(scope.storeId);
  const limit = scope.ent.limits.products;
  const quota = { used, limit, toCreate, exceeds: limit !== null && used + toCreate > limit };
  return { items, errors, quota, summary: { rows: rows.length, products: items.length, create: items.filter(i => !i.existingId).length, update: items.filter(i => i.existingId).length } };
}

export async function commitImport(scope: TenantScope, csvText: string, actorId: number) {
  requireWrite(scope, "catalog.write");
  const plan = await planImport(scope, csvText);
  if (plan.errors.length) fail("VALIDATION", `Fix ${plan.errors.length} error(s) before importing`, { errors: plan.errors.slice(0, 50) });
  if (plan.quota.exceeds)
    fail("QUOTA_EXCEEDED", `This import would create ${plan.quota.toCreate} products but your ${scope.ent.planName} plan allows ${plan.quota.limit} (${plan.quota.used} used). Upgrade or import fewer products.`, {
      metric: "products",
      ...plan.quota,
    });
  const cats = await listCategories(scope.storeId);
  let created = 0;
  let updated = 0;
  for (const item of plan.items) {
    if (item.categoryName) {
      let cat = cats.find(c => c.name.toLowerCase() === item.categoryName!.toLowerCase());
      if (!cat) {
        const id = await upsertCategory(scope, { name: item.categoryName, status: "active" });
        cat = { id, name: item.categoryName, nameBn: null, slug: slugify(item.categoryName), imageUrl: null, parentId: null, sortOrder: 0, status: "active", productCount: 0 };
        cats.push(cat);
      }
      item.input.categoryId = cat.id;
    }
    if (item.existingId) {
      const current = await getProduct(scope.storeId, item.existingId);
      const variants = item.input.variants.map(v => {
        const match = current?.variants.find(cv => (v.sku && cv.sku === v.sku) || JSON.stringify(cv.optionValuesJson ?? {}) === JSON.stringify(v.options));
        return match ? { ...v, id: match.id, stockQty: undefined } : v;
      });
      await updateProduct(scope, item.existingId, { ...item.input, variants, images: item.input.images.length ? item.input.images : (current?.images ?? []).map(i => ({ url: i.url })) }, actorId);
      updated++;
    } else {
      await createProduct(scope, item.input, actorId, { skipQuota: true, source: "import" });
      created++;
    }
  }
  await audit({ tenantId: scope.tenantId, actorId, actorType: "merchant", action: "product.imported", metadata: { created, updated }, impersonationId: scope.impersonationId });
  return { created, updated };
}

export async function exportProductsCsv(scope: TenantScope) {
  requirePerm(scope, "catalog.read");
  assertFeature(scope.ent.limits.bulkTools, "Product CSV export", "basic");
  const rows = await db()
    .select({ p: products, v: productVariants, cat: categories.name })
    .from(products)
    .innerJoin(productVariants, eq(productVariants.productId, products.id))
    .leftJoin(categories, eq(categories.id, products.categoryId))
    .where(and(eq(products.storeId, scope.storeId), isNull(products.deletedAt), eq(productVariants.status, "active")))
    .orderBy(asc(products.id), asc(productVariants.id));
  const images = await db()
    .select({ productId: productImages.productId, url: productImages.url })
    .from(productImages)
    .innerJoin(products, eq(products.id, productImages.productId))
    .where(eq(products.storeId, scope.storeId))
    .orderBy(asc(productImages.sortOrder));
  const firstImage = new Map<number, string>();
  for (const i of images) if (!firstImage.has(i.productId)) firstImage.set(i.productId, i.url);
  const data = rows.map(({ p, v, cat }) => {
    const names = p.optionNamesJson ?? [];
    const opts = v.optionValuesJson ?? {};
    return {
      name: p.name,
      name_bn: p.nameBn ?? "",
      slug: p.slug,
      category: cat ?? "",
      description: p.descriptionJson?.en ?? "",
      status: p.status,
      tags: (p.tagsJson ?? []).join("|"),
      featured: p.featured ? "true" : "false",
      low_stock_threshold: p.lowStockThreshold,
      sku: v.sku ?? "",
      price: v.price,
      compare_price: v.comparePrice ?? "",
      stock: v.stockQty,
      option1_name: names[0] ?? "",
      option1_value: names[0] ? (opts[names[0]] ?? "") : "",
      option2_name: names[1] ?? "",
      option2_value: names[1] ? (opts[names[1]] ?? "") : "",
      image_url: firstImage.get(p.id) ?? "",
    };
  });
  return Papa.unparse({ fields: [...CSV_COLUMNS], data: data.map(d => CSV_COLUMNS.map(c => (d as Record<string, unknown>)[c])) });
}

/* ───────── Uploads (storage quota tracked in assets) ───────── */
const ALLOWED_MIME = ["image/png", "image/jpeg", "image/webp", "image/gif", "image/svg+xml", "image/x-icon", "image/vnd.microsoft.icon"];
export async function uploadAsset(scope: TenantScope, input: { filename: string; mimeType: string; dataBase64: string; kind: "product_image" | "logo" | "theme_asset" | "other" }) {
  requireWrite(scope, input.kind === "product_image" ? "catalog.write" : "design.manage");
  if (!ALLOWED_MIME.includes(input.mimeType)) fail("VALIDATION", "Only PNG, JPG, WEBP, GIF, SVG or ICO images are allowed");
  const buf = Buffer.from(input.dataBase64, "base64");
  if (buf.length > 5 * 1024 * 1024) fail("VALIDATION", "Images must be 5 MB or smaller");
  await assertStorageQuota(scope.ent, buf.length);
  const ext = input.filename.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") || "bin";
  const { key, url } = await storagePut(`tenants/${scope.tenantId}/${input.kind}/${Date.now()}.${ext}`, buf, input.mimeType);
  const [row] = await db()
    .insert(assets)
    .values({ tenantId: scope.tenantId, storeId: scope.storeId, objectKey: key, url, mimeType: input.mimeType, sizeBytes: buf.length, kind: input.kind, metadataJson: { filename: input.filename } })
    .$returningId();
  return { id: row.id, url };
}
export async function deleteAsset(scope: TenantScope, id: number) {
  requireWrite(scope, "catalog.write");
  await db().update(assets).set({ deletedAt: new Date() }).where(and(eq(assets.id, id), eq(assets.tenantId, scope.tenantId)));
}
export async function listAssets(scope: TenantScope) {
  requirePerm(scope, "catalog.read");
  return db()
    .select()
    .from(assets)
    .where(and(eq(assets.tenantId, scope.tenantId), isNull(assets.deletedAt)))
    .orderBy(desc(assets.id))
    .limit(200);
}
