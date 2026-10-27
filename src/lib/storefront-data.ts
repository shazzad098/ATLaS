import { cache } from "react";
import { prisma } from "@/lib/db";
import { storefrontProduct, storefrontProducts } from "@/lib/services/catalog-service";
import type { StorefrontCategory, StorefrontProduct } from "@/themes/types";

/**
 * Storefront data adapters.
 *
 * The catalog service returns Prisma rows; themes consume the small, stable
 * `Storefront*` shapes from `@/themes/types`. Mapping in one place keeps section
 * components free of Prisma types and of money conversion.
 */

type ProductRow = Awaited<ReturnType<typeof storefrontProducts>>["items"][number];

function toStorefrontProduct(row: ProductRow): StorefrontProduct {
  const priced = row.variants
    .map((variant) => ({
      price: Number(variant.price),
      comparePrice: variant.comparePrice === null ? null : Number(variant.comparePrice),
    }))
    .filter((entry) => Number.isFinite(entry.price));

  const cheapest = priced.length
    ? priced.reduce((min, entry) => (entry.price < min.price ? entry : min))
    : null;

  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    priceFrom: cheapest?.price ?? 0,
    comparePriceFrom: cheapest?.comparePrice ?? null,
    imageUrl: row.images[0]?.url ?? null,
    inStock: row.inStock,
    categoryName: row.category?.name ?? null,
  };
}

export async function listStorefrontProducts(
  storeId: string,
  options: {
    q?: string;
    categorySlug?: string;
    sort?: "newest" | "price-asc" | "price-desc" | "name";
    page?: number;
    perPage?: number;
  } = {},
): Promise<{ products: StorefrontProduct[]; total: number; page: number; pageCount: number }> {
  const result = await storefrontProducts(storeId, options);
  return {
    products: result.items.map(toStorefrontProduct),
    total: result.total,
    page: result.page,
    pageCount: result.pageCount,
  };
}

export const listStorefrontCategories = cache(async (storeId: string): Promise<StorefrontCategory[]> => {
  const rows = await prisma.category.findMany({
    where: { storeId, status: "ACTIVE" },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    include: { _count: { select: { products: { where: { status: "ACTIVE", deletedAt: null } } } } },
  });

  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    slug: row.slug,
    productCount: row._count.products,
  }));
});

export type StorefrontProductDetail = Awaited<ReturnType<typeof storefrontProduct>>;

export async function getStorefrontProduct(storeId: string, slug: string) {
  return storefrontProduct(storeId, slug);
}
