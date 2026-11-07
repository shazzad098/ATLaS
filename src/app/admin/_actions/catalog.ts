import { revalidatePath } from "next/cache";
import { AppError } from "@/lib/errors";
import { prisma } from "@/lib/db";
import { bnNumber } from "@/lib/dates";
import { storePath } from "@/lib/storefront";
import {
  adjustVariantStock,
  applyProductDiscount,
  archiveProduct,
  createCategory,
  createProduct,
  importProductsCsv,
  updateCategory,
  updateProduct,
} from "@/lib/services/catalog-service";
import { ctx, message, required, revalidateAdmin, text } from "@/app/admin/_actions/shared";
import type { AdminState } from "@/app/admin/state";

/** Catalog, inventory and category actions (see `actions.ts` for the barrel). */

function parseVariants(formData: FormData): Array<{
  id?: string;
  sku: string;
  optionValues: Record<string, string>;
  price: number;
  comparePrice: number | null;
  stockQty: number;
  status: "ACTIVE" | "DRAFT" | "ARCHIVED";
}> {
  const raw = text(formData, "variants");
  if (!raw) return [];
  const parsed = JSON.parse(raw) as Array<Record<string, unknown>>;
  return parsed.map((row) => ({
    id: typeof row.id === "string" ? row.id : undefined,
    sku: String(row.sku ?? "").trim(),
    optionValues: (row.optionValues ?? {}) as Record<string, string>,
    price: Number(row.price ?? 0),
    comparePrice: row.comparePrice === null || row.comparePrice === "" ? null : Number(row.comparePrice),
    stockQty: Number(row.stockQty ?? 0),
    status: (row.status as "ACTIVE" | "DRAFT" | "ARCHIVED") ?? "ACTIVE",
  }));
}

function parseImages(formData: FormData): Array<{ url: string; altText: string }> {
  const raw = text(formData, "images");
  if (!raw) return [];
  const parsed = JSON.parse(raw) as Array<Record<string, unknown>>;
  return parsed
    .map((row) => ({ url: String(row.url ?? "").trim(), altText: String(row.altText ?? "").trim() }))
    .filter((row) => row.url.length > 0);
}

/**
 * Apply or clear a percentage discount on one product. Writes real prices so
 * cart, checkout and the storefront (badge + strikethrough) all pick it up.
 */
export async function applyProductDiscountAction(
  _prev: AdminState,
  formData: FormData,
): Promise<AdminState> {
  try {
    const { actor } = await ctx("discounts:write");
    const storeId = required(formData, "storeId");
    const productId = required(formData, "productId");
    const clear = text(formData, "mode") === "clear";
    const percent = Number.parseInt(text(formData, "percent") || "0", 10) || 0;

    const result = await applyProductDiscount(actor, storeId, productId, { percent, clear });

    revalidateAdmin(
      "/admin/products",
      `/admin/products/${productId}`,
      "/store/[slug]/shop",
      "/store/[slug]/product/[productSlug]",
    );
    return {
      ok: true,
      message: result.cleared
        ? "ডিসকাউন্ট সরিয়ে আগের দামে ফেরা হয়েছে।"
        : `${bnNumber(result.percent)}% ডিসকাউন্ট প্রয়োগ হয়েছে।`,
    };
  } catch (error) {
    return message(error, "ডিসকাউন্ট প্রয়োগ করা যায়নি।");
  }
}

export async function saveProductAction(
  _prev: AdminState,
  formData: FormData,
): Promise<AdminState> {
  try {
    const { actor } = await ctx("catalog:write");
    const storeId = required(formData, "storeId");
    const productId = text(formData, "productId");

    const payload = {
      name: text(formData, "name"),
      slug: text(formData, "slug") || undefined,
      categoryId: text(formData, "categoryId") || null,
      description: text(formData, "description"),
      tags: text(formData, "tags")
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean),
      status: (text(formData, "status") || "DRAFT") as "ACTIVE" | "DRAFT" | "ARCHIVED",
      lowStockThreshold: Number.parseInt(text(formData, "lowStockThreshold") || "5", 10) || 5,
      variants: parseVariants(formData),
      images: parseImages(formData),
    };

    const result = productId
      ? await updateProduct(actor, storeId, productId, payload)
      : await createProduct(actor, storeId, payload);

    revalidateAdmin("/admin/products", `/admin/products/${result.id}`);

    // The storefront renders from the database on the next request; clear the
    // public paths as well so a cached HTML copy cannot keep the old photo.
    const store = await prisma.store.findUnique({
      where: { id: storeId },
      select: { slug: true },
    });
    if (store) {
      revalidatePath(storePath(store.slug));
      revalidatePath(storePath(store.slug, "/shop"));
      revalidatePath(storePath(store.slug, `/product/${result.slug}`));
    }

    return { ok: true, message: "পণ্য সংরক্ষণ হয়েছে।" };
  } catch (error) {
    return message(error, "পণ্য সংরক্ষণ করা যায়নি।");
  }
}

export async function archiveProductAction(
  _prev: AdminState,
  formData: FormData,
): Promise<AdminState> {
  try {
    const { actor } = await ctx("catalog:write");
    await archiveProduct(actor, required(formData, "storeId"), required(formData, "productId"));
    revalidateAdmin("/admin/products");
    return { ok: true, message: "পণ্য archive করা হয়েছে।" };
  } catch (error) {
    return message(error, "Archive করা যায়নি।");
  }
}

export async function adjustStockAction(
  _prev: AdminState,
  formData: FormData,
): Promise<AdminState> {
  try {
    const { actor } = await ctx("catalog:write");
    await adjustVariantStock(actor, required(formData, "storeId"), required(formData, "variantId"), {
      delta: Number.parseInt(text(formData, "delta") || "0", 10),
      reason: text(formData, "reason") || "Manual adjustment",
    });
    revalidateAdmin("/admin/products");
    return { ok: true, message: "স্টক হালনাগাদ হয়েছে।" };
  } catch (error) {
    return message(error, "স্টক হালনাগাদ করা যায়নি।");
  }
}

export async function saveCategoryAction(
  _prev: AdminState,
  formData: FormData,
): Promise<AdminState> {
  try {
    const { actor } = await ctx("catalog:write");
    const storeId = required(formData, "storeId");
    const categoryId = text(formData, "categoryId");

    const payload = {
      name: text(formData, "name"),
      slug: text(formData, "slug") || undefined,
      sortOrder: Number.parseInt(text(formData, "sortOrder") || "0", 10) || 0,
      status: (text(formData, "status") || "ACTIVE") as "ACTIVE" | "DRAFT" | "ARCHIVED",
      parentId: text(formData, "parentId") || null,
    };

    if (categoryId) {
      await updateCategory(actor, storeId, categoryId, payload);
    } else {
      await createCategory(actor, storeId, payload);
    }

    revalidateAdmin("/admin/categories");
    return { ok: true, message: "ক্যাটাগরি সংরক্ষণ হয়েছে।" };
  } catch (error) {
    return message(error, "ক্যাটাগরি সংরক্ষণ করা যায়নি।");
  }
}

/**
 * Inline category creation from the product form.
 *
 * Returns the new row so the client can append it to the dropdown and select it
 * without leaving the (possibly unsaved) product the merchant is editing.
 */
export type QuickCategoryResult = {
  ok: boolean;
  message: string;
  category?: { id: string; name: string };
};

export async function createProductCategoryAction(input: {
  storeId: string;
  name: string;
}): Promise<QuickCategoryResult> {
  try {
    const { actor } = await ctx("catalog:write");
    const name = input.name.trim();
    if (name.length < 2) {
      return { ok: false, message: "ক্যাটাগরির নাম কমপক্ষে ২ অক্ষরের হতে হবে।" };
    }
    const category = await createCategory(actor, input.storeId, {
      name,
      sortOrder: 0,
      status: "ACTIVE",
      parentId: null,
    });
    revalidateAdmin("/admin/categories", "/admin/products");
    return {
      ok: true,
      message: "ক্যাটাগরি তৈরি হয়েছে।",
      category: { id: category.id, name: category.name },
    };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof AppError ? error.message : "ক্যাটাগরি তৈরি করা যায়নি।",
    };
  }
}

export async function archiveCategoryAction(
  _prev: AdminState,
  formData: FormData,
): Promise<AdminState> {
  try {
    const { actor } = await ctx("catalog:write");
    await updateCategory(actor, required(formData, "storeId"), required(formData, "categoryId"), {
      name: text(formData, "name") || "—",
      status: "ARCHIVED",
    });
    revalidateAdmin("/admin/categories");
    return { ok: true, message: "ক্যাটাগরি archive করা হয়েছে।" };
  } catch (error) {
    return message(error, "Archive করা যায়নি।");
  }
}

/**
 * CSV import (FR-03). Runs the validator first (dry-run) unless `commit=1`, so
 * a merchant always sees which rows would fail before anything is written.
 */
export async function importProductsAction(
  _prev: AdminState,
  formData: FormData,
): Promise<AdminState> {
  try {
    const { actor } = await ctx("catalog:write");
    const storeId = required(formData, "storeId");
    const csv = text(formData, "csv");
    if (!csv.trim()) return { ok: false, message: "CSV লিখুন বা ফাইল আপলোড করুন।" };

    const commit = formData.get("commit") === "1";
    const result = await importProductsCsv(actor, storeId, csv, { dryRun: !commit });

    const skipped = result.results.filter((row) => row.action === "skip").length;
    const summary = commit
      ? `${result.created}টি নতুন, ${result.updated}টি হালনাগাদ, ${skipped}টি বাদ।`
      : `Dry-run: ${result.results.length}টি row — ${skipped}টিতে সমস্যা। কিছুই লেখা হয়নি।`;

    if (commit) revalidateAdmin("/admin/products", "/admin/inventory");
    return { ok: skipped === 0, message: summary, data: { results: result.results } };
  } catch (error) {
    return message(error, "Import করা যায়নি।");
  }
}
