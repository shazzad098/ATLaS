import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import type { AuthenticatedUser } from "../auth/auth.types";
import { assertPermission, CATALOG_READ, CATALOG_WRITE, permissionsForRole, STORE_READ } from "../common/rbac";
import { PrismaService } from "../database/prisma.service";
import {
  CreateCategoryDto,
  CreateProductDto,
  ListProductsQueryDto,
  UpdateProductDto,
} from "./dto/catalog.dto";

export type StoreContext = {
  storeId: string;
  tenantId: string;
  permissions: string[];
};

type StoreSummary = {
  id: string;
  name: string;
  slug: string;
  status: string;
};

function slugify(input: string): string {
  const slug = input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\p{L}]+/gu, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
  return slug || `product-${Date.now()}`;
}

/**
 * Catalog read/write, tenant-scoped on the server.
 *
 * Mirrors the Next.js `catalog-service` so the two surfaces behave identically
 * while the UI migrates: every store access resolves the caller's membership
 * and role permissions, and a `tenantId`/`storeId` from the request is never
 * trusted on its own.
 */
@Injectable()
export class CatalogService {
  constructor(private readonly prisma: PrismaService) {}

  async listStores(user: AuthenticatedUser): Promise<StoreSummary[]> {
    if (user.isSuperAdmin) {
      return this.prisma.store.findMany({
        where: { deletedAt: null },
        orderBy: { createdAt: "asc" },
        select: { id: true, name: true, slug: true, status: true },
      });
    }

    const memberships = await this.prisma.membership.findMany({
      where: { userId: user.id, status: "ACTIVE" },
      select: { tenantId: true },
    });
    return this.prisma.store.findMany({
      where: { tenantId: { in: memberships.map((m) => m.tenantId) }, deletedAt: null },
      orderBy: { createdAt: "asc" },
      select: { id: true, name: true, slug: true, status: true },
    });
  }

  async listCategories(user: AuthenticatedUser, storeId: string) {
    await this.resolveStore(user, storeId, CATALOG_READ);
    return this.prisma.category.findMany({
      where: { storeId, status: "ACTIVE" },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      select: { id: true, name: true, slug: true, parentId: true, sortOrder: true },
    });
  }

  async createCategory(user: AuthenticatedUser, storeId: string, dto: CreateCategoryDto) {
    await this.resolveStore(user, storeId, CATALOG_WRITE);
    const slug = await this.uniqueCategorySlug(storeId, dto.slug ?? dto.name);

    if (dto.parentId) {
      const parent = await this.prisma.category.findFirst({
        where: { id: dto.parentId, storeId },
        select: { id: true },
      });
      if (!parent) throw new NotFoundException("Parent category not found");
    }

    return this.prisma.category.create({
      data: {
        storeId,
        name: dto.name,
        slug,
        parentId: dto.parentId ?? null,
      },
      select: { id: true, name: true, slug: true, parentId: true },
    });
  }

  async listProducts(user: AuthenticatedUser, storeId: string, query: ListProductsQueryDto) {
    await this.resolveStore(user, storeId, CATALOG_READ);

    const limit = query.limit ?? 20;
    const rows = await this.prisma.product.findMany({
      where: {
        storeId,
        deletedAt: null,
        ...(query.status ? { status: query.status } : {}),
        ...(query.search
          ? { OR: [{ name: { contains: query.search } }, { slug: { contains: query.search } }] }
          : {}),
      },
      take: limit + 1,
      ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        slug: true,
        status: true,
        categoryId: true,
        lowStockThreshold: true,
        createdAt: true,
        variants: { select: { id: true, sku: true, price: true, comparePrice: true, stockQty: true, status: true } },
        images: { select: { id: true, url: true, altText: true, sortOrder: true }, orderBy: { sortOrder: "asc" } },
      },
    });

    const hasMore = rows.length > limit;
    const items = hasMore ? rows.slice(0, limit) : rows;
    return { items, nextCursor: hasMore ? items[items.length - 1]?.id ?? null : null };
  }

  async getProduct(user: AuthenticatedUser, productId: string) {
    const product = await this.prisma.product.findFirst({
      where: { id: productId, deletedAt: null },
      include: {
        variants: true,
        images: { orderBy: { sortOrder: "asc" } },
      },
    });
    if (!product) throw new NotFoundException("Product not found");
    await this.resolveStore(user, product.storeId, CATALOG_READ);
    return product;
  }

  async createProduct(user: AuthenticatedUser, storeId: string, dto: CreateProductDto) {
    await this.resolveStore(user, storeId, CATALOG_WRITE);

    if (dto.categoryId) {
      const category = await this.prisma.category.findFirst({
        where: { id: dto.categoryId, storeId },
        select: { id: true },
      });
      if (!category) throw new NotFoundException("Category not found");
    }

    const slug = await this.uniqueProductSlug(storeId, dto.slug ?? dto.name);

    return this.prisma.$transaction(async (tx) => {
      const product = await tx.product.create({
        data: {
          storeId,
          categoryId: dto.categoryId ?? null,
          name: dto.name,
          slug,
          descriptionJson: { text: dto.description ?? "" },
          tags: dto.tags ?? [],
          status: dto.status ?? "ACTIVE",
          publishedAt: (dto.status ?? "ACTIVE") === "ACTIVE" ? new Date() : null,
          lowStockThreshold: dto.lowStockThreshold ?? 5,
          variants: {
            create: dto.variants.map((variant) => ({
              sku: variant.sku,
              optionValuesJson: variant.optionValues ?? {},
              price: variant.price,
              comparePrice: variant.comparePrice ?? null,
              costPrice: variant.costPrice ?? null,
              stockQty: variant.stockQty ?? 0,
              weightGrams: variant.weightGrams ?? null,
              status: variant.status ?? "ACTIVE",
            })),
          },
          images: {
            create: (dto.images ?? []).map((image, index) => ({
              url: image.url,
              altText: image.altText ?? null,
              sortOrder: index,
            })),
          },
        },
        include: { variants: true, images: { orderBy: { sortOrder: "asc" } } },
      });

      return product;
    });
  }

  async updateProduct(user: AuthenticatedUser, productId: string, dto: UpdateProductDto) {
    const existing = await this.prisma.product.findFirst({
      where: { id: productId, deletedAt: null },
      select: { id: true, storeId: true, slug: true },
    });
    if (!existing) throw new NotFoundException("Product not found");
    await this.resolveStore(user, existing.storeId, CATALOG_WRITE);

    const slug = dto.slug
      ? await this.uniqueProductSlug(existing.storeId, dto.slug, productId)
      : existing.slug;

    return this.prisma.product.update({
      where: { id: productId },
      data: {
        name: dto.name,
        slug,
        ...(dto.categoryId !== undefined ? { categoryId: dto.categoryId ?? null } : {}),
        ...(dto.description !== undefined ? { descriptionJson: { text: dto.description } } : {}),
        ...(dto.tags !== undefined ? { tags: dto.tags } : {}),
        ...(dto.status !== undefined ? { status: dto.status } : {}),
        ...(dto.lowStockThreshold !== undefined ? { lowStockThreshold: dto.lowStockThreshold } : {}),
      },
      select: { id: true, name: true, slug: true, status: true },
    });
  }

  /**
   * Resolve the store and the caller's permission set. Super admins pass; every
   * other user needs an ACTIVE membership in the store's tenant.
   */
  private async resolveStore(
    user: AuthenticatedUser,
    storeId: string,
    permission: string,
  ): Promise<StoreContext> {
    const store = await this.prisma.store.findFirst({
      where: { id: storeId, deletedAt: null },
      select: { id: true, tenantId: true },
    });
    if (!store) throw new NotFoundException("Store not found");

    if (user.isSuperAdmin) {
      return { storeId: store.id, tenantId: store.tenantId, permissions: ["*"] };
    }

    const membership = await this.prisma.membership.findFirst({
      where: { tenantId: store.tenantId, userId: user.id, status: "ACTIVE" },
      include: { role: { select: { code: true, permissionsJson: true } } },
    });
    if (!membership) throw new ForbiddenException("You do not have access to this store");

    const permissions = permissionsForRole(membership.role.code, membership.role.permissionsJson);
    if (permission === CATALOG_WRITE) assertPermission(permissions, CATALOG_WRITE);
    else if (permission === CATALOG_READ) assertPermission(permissions, CATALOG_READ);
    else assertPermission(permissions, STORE_READ);

    return { storeId: store.id, tenantId: store.tenantId, permissions };
  }

  private async uniqueProductSlug(storeId: string, base: string, excludeId?: string): Promise<string> {
    const root = slugify(base);
    let candidate = root;
    let suffix = 2;

    while (true) {
      const clash = await this.prisma.product.findFirst({
        where: { storeId, slug: candidate, deletedAt: null, ...(excludeId ? { NOT: { id: excludeId } } : {}) },
        select: { id: true },
      });
      if (!clash) return candidate;
      candidate = `${root}-${suffix}`;
      suffix += 1;
    }
  }

  private async uniqueCategorySlug(storeId: string, base: string): Promise<string> {
    const root = slugify(base);
    let candidate = root;
    let suffix = 2;

    while (true) {
      const clash = await this.prisma.category.findFirst({
        where: { storeId, slug: candidate },
        select: { id: true },
      });
      if (!clash) return candidate;
      candidate = `${root}-${suffix}`;
      suffix += 1;
    }
  }
}
