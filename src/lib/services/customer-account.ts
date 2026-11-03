import { z } from "zod";
import { prisma } from "@/lib/db";
import { AppError, NotFoundError } from "@/lib/errors";
import { checkPasswordStrength, hashPassword, verifyPassword } from "@/lib/auth/password";
import { isValidBdPhone, normalizePhone } from "@/lib/auth/phone";
import { signOrderAccessToken } from "@/lib/order-access";
import { fromPaisa, toPaisa } from "@/lib/money";

/**
 * Buyer accounts on a merchant storefront (FR-08).
 *
 * Buyers are `Customer` rows scoped to one store. They can sign up, sign in,
 * track orders, keep a wishlist and leave reviews/comments. Guests keep the
 * existing checkout flow — an account is optional until a buyer wants history.
 */

export const buyerSignupSchema = z.object({
  name: z.string().trim().min(2, "নাম কমপক্ষে ২ অক্ষরের হতে হবে।").max(120),
  phone: z.string().trim().min(6, "মোবাইল নম্বর দিন।").max(24),
  email: z.string().trim().email("সঠিক email দিন।").optional().or(z.literal("")),
  password: z.string().min(8, "পাসওয়ার্ড কমপক্ষে ৮ অক্ষরের হতে হবে।").max(72),
});

export const buyerLoginSchema = z.object({
  identifier: z.string().trim().min(4, "মোবাইল নম্বর বা email দিন।").max(120),
  password: z.string().min(1, "পাসওয়ার্ড দিন।").max(72),
});

export const buyerProfileSchema = z.object({
  name: z.string().trim().min(2, "নাম কমপক্ষে ২ অক্ষরের হতে হবে।").max(120),
  email: z.string().trim().email("সঠিক email দিন।").optional().or(z.literal("")),
  address: z
    .object({
      line1: z.string().trim().max(240).optional().or(z.literal("")),
      line2: z.string().trim().max(240).optional().or(z.literal("")),
      area: z.string().trim().max(120).optional().or(z.literal("")),
      city: z.string().trim().max(120).optional().or(z.literal("")),
      district: z.string().trim().max(120).optional().or(z.literal("")),
      postcode: z.string().trim().max(20).optional().or(z.literal("")),
    })
    .default({}),
});

export const reviewSchema = z.object({
  rating: z.coerce.number().int().min(1, "রেটিং দিন।").max(5),
  title: z.string().trim().max(120).optional().or(z.literal("")),
  body: z.string().trim().min(3, "রিভিউ কমপক্ষে ৩ অক্ষরের হতে হবে।").max(2000),
});

export type BuyerAddress = z.infer<typeof buyerProfileSchema>["address"];

export type BuyerAccount = {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  address: BuyerAddress;
  createdAt: Date;
  lastLoginAt: Date | null;
};

function emptyAddress(): BuyerAddress {
  return { line1: "", line2: "", area: "", city: "", district: "", postcode: "" };
}

function toAddress(value: unknown): BuyerAddress {
  const parsed = buyerProfileSchema.shape.address.safeParse(value ?? {});
  return parsed.success ? parsed.data : emptyAddress();
}

// ── Authentication ──────────────────────────────────────────────────────────

/** Creates (or claims) the buyer account after the phone OTP is verified. */
export async function createBuyerAccount(
  storeId: string,
  input: z.infer<typeof buyerSignupSchema>,
): Promise<BuyerAccount> {
  const phone = normalizePhone(input.phone);
  if (!isValidBdPhone(phone)) {
    throw new AppError(
      "VALIDATION_FAILED",
      "সঠিক বাংলাদেশি মোবাইল নম্বর দিন (যেমন 01712345678)।",
      422,
      { field: "phone" },
    );
  }

  const strength = checkPasswordStrength(input.password);
  if (!strength.ok) {
    throw new AppError("VALIDATION_FAILED", strength.problems.join(" "), 422, {
      field: "password",
    });
  }

  const existing = await prisma.customer.findUnique({
    where: { storeId_phone: { storeId, phone } },
    select: { id: true, passwordHash: true },
  });
  if (existing?.passwordHash) {
    throw new AppError(
      "CONFLICT",
      "এই নম্বরে ইতিমধ্যে অ্যাকাউন্ট আছে। মোবাইল নম্বর ও পাসওয়ার্ড দিয়ে লগইন করুন।",
      409,
    );
  }

  if (input.email) {
    const emailTaken = await prisma.customer.findFirst({
      where: {
        storeId,
        email: { equals: input.email.toLowerCase(), mode: "insensitive" },
        NOT: { phone },
      },
      select: { id: true },
    });
    if (emailTaken) {
      throw new AppError("CONFLICT", "এই email দিয়ে এই দোকানে অ্যাকাউন্ট আছে।", 409);
    }
  }

  const passwordHash = await hashPassword(input.password);
  const now = new Date();

  // A guest who checked out before creating an account keeps their order
  // history: the OTP proved ownership of the phone number.
  const customer = existing
    ? await prisma.customer.update({
        where: { id: existing.id },
        data: {
          name: input.name,
          email: input.email || null,
          passwordHash,
          lastLoginAt: now,
          consentJson: { accountCreatedAt: now.toISOString() } as never,
        },
      })
    : await prisma.customer.create({
        data: {
          storeId,
          name: input.name,
          phone,
          email: input.email || null,
          passwordHash,
          lastLoginAt: now,
          consentJson: { accountCreatedAt: now.toISOString() } as never,
        },
      });

  return {
    id: customer.id,
    name: customer.name,
    phone: customer.phone,
    email: customer.email,
    address: toAddress(customer.addressJson),
    createdAt: customer.createdAt,
    lastLoginAt: customer.lastLoginAt,
  };
}

/** Password sign-in with a phone number or email address. */
export async function authenticateBuyer(
  storeId: string,
  identifier: string,
  password: string,
): Promise<BuyerAccount> {
  const trimmed = identifier.trim();
  const phone = isValidBdPhone(trimmed) ? normalizePhone(trimmed) : null;

  const customer = await prisma.customer.findFirst({
    where: phone
      ? { storeId, phone }
      : { storeId, email: { equals: trimmed.toLowerCase(), mode: "insensitive" } },
  });

  // The same message for "no account" and "wrong password" avoids disclosing
  // which phone numbers/emails have accounts at this store.
  const invalid = new AppError(
    "UNAUTHENTICATED",
    "মোবাইল নম্বর/email বা পাসওয়ার্ড মেলেনি।",
    401,
  );
  if (!customer || !customer.passwordHash) throw invalid;
  if (!(await verifyPassword(password, customer.passwordHash))) throw invalid;

  if (customer.status !== "ACTIVE" || customer.isBlacklisted) {
    throw new AppError("FORBIDDEN", "এই অ্যাকাউন্টটি এই দোকানে বন্ধ আছে।", 403);
  }

  const updated = await prisma.customer.update({
    where: { id: customer.id },
    data: { lastLoginAt: new Date() },
  });

  return {
    id: updated.id,
    name: updated.name,
    phone: updated.phone,
    email: updated.email,
    address: toAddress(updated.addressJson),
    createdAt: updated.createdAt,
    lastLoginAt: updated.lastLoginAt,
  };
}

// ── Profile ─────────────────────────────────────────────────────────────────

export async function getBuyerAccount(storeId: string, customerId: string): Promise<BuyerAccount> {
  const customer = await prisma.customer.findFirst({ where: { id: customerId, storeId } });
  if (!customer) throw new NotFoundError("Buyer account");
  return {
    id: customer.id,
    name: customer.name,
    phone: customer.phone,
    email: customer.email,
    address: toAddress(customer.addressJson),
    createdAt: customer.createdAt,
    lastLoginAt: customer.lastLoginAt,
  };
}

export async function updateBuyerProfile(
  storeId: string,
  customerId: string,
  input: z.infer<typeof buyerProfileSchema>,
): Promise<void> {
  if (input.email) {
    const emailTaken = await prisma.customer.findFirst({
      where: {
        storeId,
        email: { equals: input.email.toLowerCase(), mode: "insensitive" },
        NOT: { id: customerId },
      },
      select: { id: true },
    });
    if (emailTaken) {
      throw new AppError("CONFLICT", "এই email দিয়ে এই দোকানে অন্য অ্যাকাউন্ট আছে।", 409);
    }
  }

  const result = await prisma.customer.updateMany({
    where: { id: customerId, storeId },
    data: {
      name: input.name,
      email: input.email || null,
      addressJson: input.address as never,
    },
  });
  if (result.count === 0) throw new NotFoundError("Buyer account");
}

export async function changeBuyerPassword(
  storeId: string,
  customerId: string,
  currentPassword: string,
  nextPassword: string,
): Promise<void> {
  const customer = await prisma.customer.findFirst({ where: { id: customerId, storeId } });
  if (!customer) throw new NotFoundError("Buyer account");
  if (!(await verifyPassword(currentPassword, customer.passwordHash))) {
    throw new AppError("VALIDATION_FAILED", "বর্তমান পাসওয়ার্ড মেলেনি।", 422, {
      field: "currentPassword",
    });
  }
  const strength = checkPasswordStrength(nextPassword);
  if (!strength.ok) {
    throw new AppError("VALIDATION_FAILED", strength.problems.join(" "), 422, {
      field: "newPassword",
    });
  }
  await prisma.customer.update({
    where: { id: customer.id },
    data: { passwordHash: await hashPassword(nextPassword) },
  });
}

// ── Orders ──────────────────────────────────────────────────────────────────

export type BuyerOrder = {
  id: string;
  orderNo: string;
  status: string;
  paymentStatus: string;
  fulfillmentStatus: string;
  total: string;
  placedAt: Date;
  itemCount: number;
  accessToken: string;
  items: Array<{
    name: string;
    quantity: number;
    productSlug: string | null;
    imageUrl: string | null;
  }>;
};

export type BuyerOrderStats = {
  totalOrders: number;
  openOrders: number;
  deliveredOrders: number;
  totalSpent: string;
};

const OPEN_ORDER_STATUSES = ["PENDING_PAYMENT", "CONFIRMED", "PROCESSING", "SHIPPED"] as const;

export async function getBuyerOrderStats(
  storeId: string,
  customerId: string,
): Promise<BuyerOrderStats> {
  const [totalOrders, openOrders, deliveredOrders, spend] = await Promise.all([
    prisma.order.count({ where: { storeId, customerId, deletedAt: null } }),
    prisma.order.count({
      where: { storeId, customerId, deletedAt: null, status: { in: [...OPEN_ORDER_STATUSES] } },
    }),
    prisma.order.count({
      where: { storeId, customerId, deletedAt: null, status: "DELIVERED" },
    }),
    prisma.order.aggregate({
      where: {
        storeId,
        customerId,
        deletedAt: null,
        status: { notIn: ["CANCELLED", "REFUNDED"] },
      },
      _sum: { grandTotal: true },
    }),
  ]);

  return {
    totalOrders,
    openOrders,
    deliveredOrders,
    totalSpent: fromPaisa(toPaisa(spend._sum.grandTotal ?? 0)),
  };
}

export async function listBuyerOrders(
  storeId: string,
  customerId: string,
  limit = 50,
): Promise<BuyerOrder[]> {
  const orders = await prisma.order.findMany({
    where: { storeId, customerId, deletedAt: null },
    orderBy: { placedAt: "desc" },
    take: limit,
    include: {
      items: {
        select: {
          nameSnapshot: true,
          quantity: true,
          productId: true,
          product: {
            select: {
              slug: true,
              images: { take: 1, orderBy: { sortOrder: "asc" }, select: { url: true } },
            },
          },
        },
      },
    },
  });

  return orders.map((order) => ({
    id: order.id,
    orderNo: order.orderNo,
    status: order.status,
    paymentStatus: order.paymentStatus,
    fulfillmentStatus: order.fulfillmentStatus,
    total: fromPaisa(toPaisa(order.grandTotal)),
    placedAt: order.placedAt,
    itemCount: order.items.reduce((sum, item) => sum + item.quantity, 0),
    accessToken: signOrderAccessToken({
      storeId,
      orderId: order.id,
      orderNo: order.orderNo,
    }),
    items: order.items.map((item) => ({
      name: item.nameSnapshot,
      quantity: item.quantity,
      productSlug: item.product?.slug ?? null,
      imageUrl: item.product?.images[0]?.url ?? null,
    })),
  }));
}

// ── Reviews & comments ──────────────────────────────────────────────────────

export type ProductReviewView = {
  id: string;
  rating: number;
  title: string | null;
  body: string;
  createdAt: Date;
  authorName: string;
  verifiedPurchase: boolean;
  isMine: boolean;
  comments: Array<{ id: string; authorName: string; body: string; createdAt: Date }>;
};

export type ReviewSummary = {
  average: number;
  count: number;
  distribution: Array<{ rating: number; count: number }>;
};

export async function getReviewSummary(
  storeId: string,
  productId: string,
): Promise<ReviewSummary> {
  const [aggregate, grouped] = await Promise.all([
    prisma.productReview.aggregate({
      where: { storeId, productId, status: "APPROVED" },
      _avg: { rating: true },
      _count: { _all: true },
    }),
    prisma.productReview.groupBy({
      by: ["rating"],
      where: { storeId, productId, status: "APPROVED" },
      _count: { _all: true },
    }),
  ]);

  const counts = new Map(grouped.map((row) => [row.rating, row._count._all]));
  return {
    average: Math.round((aggregate._avg.rating ?? 0) * 10) / 10,
    count: aggregate._count._all,
    distribution: [5, 4, 3, 2, 1].map((rating) => ({ rating, count: counts.get(rating) ?? 0 })),
  };
}

export async function listProductReviews(
  storeId: string,
  productId: string,
  viewerId: string | null = null,
  limit = 30,
): Promise<ProductReviewView[]> {
  const reviews = await prisma.productReview.findMany({
    where: { storeId, productId, status: "APPROVED" },
    orderBy: { createdAt: "desc" },
    take: limit,
    include: {
      comments: {
        orderBy: { createdAt: "asc" },
        take: 20,
        select: { id: true, authorName: true, body: true, createdAt: true },
      },
    },
  });

  return reviews.map((review) => ({
    id: review.id,
    rating: review.rating,
    title: review.title,
    body: review.body,
    createdAt: review.createdAt,
    authorName: review.authorName,
    verifiedPurchase: Boolean(review.orderId),
    isMine: viewerId === review.customerId,
    comments: review.comments,
  }));
}

export type BuyerReview = ProductReviewView & {
  productId: string;
  productName: string;
  productSlug: string;
};

export async function listBuyerReviews(
  storeId: string,
  customerId: string,
): Promise<BuyerReview[]> {
  const reviews = await prisma.productReview.findMany({
    where: { storeId, customerId },
    orderBy: { createdAt: "desc" },
    include: {
      product: { select: { name: true, slug: true } },
      comments: {
        orderBy: { createdAt: "asc" },
        take: 20,
        select: { id: true, authorName: true, body: true, createdAt: true },
      },
    },
  });

  return reviews.map((review) => ({
    id: review.id,
    productId: review.productId,
    productName: review.product.name,
    productSlug: review.product.slug,
    rating: review.rating,
    title: review.title,
    body: review.body,
    createdAt: review.createdAt,
    authorName: review.authorName,
    verifiedPurchase: Boolean(review.orderId),
    isMine: true,
    comments: review.comments,
  }));
}

export type ReviewableProduct = {
  productId: string;
  name: string;
  slug: string;
  imageUrl: string | null;
  existingRating: number | null;
  reviewBody: string | null;
  reviewCount: number;
};

/** Products this buyer has ordered — the panel's "write a review" shortlist. */
export async function listReviewableProducts(
  storeId: string,
  customerId: string,
): Promise<ReviewableProduct[]> {
  const [items, reviews] = await Promise.all([
    prisma.orderItem.findMany({
      where: {
        productId: { not: null },
        order: {
          storeId,
          customerId,
          deletedAt: null,
          status: { notIn: ["CANCELLED", "REFUNDED"] },
        },
      },
      distinct: ["productId"],
      orderBy: { id: "desc" },
      select: {
        productId: true,
        product: {
          select: {
            id: true,
            name: true,
            slug: true,
            deletedAt: true,
            images: { take: 1, orderBy: { sortOrder: "asc" }, select: { url: true } },
          },
        },
      },
    }),
    prisma.productReview.findMany({
      where: { storeId, customerId },
      orderBy: { createdAt: "desc" },
      select: { productId: true, rating: true, body: true },
    }),
  ]);

  // A buyer can post more than once; show the latest rating plus how many
  // comments they have left on that product.
  const latestByProduct = new Map<string, { rating: number; body: string }>();
  const countByProduct = new Map<string, number>();
  for (const review of reviews) {
    if (!latestByProduct.has(review.productId)) {
      latestByProduct.set(review.productId, { rating: review.rating, body: review.body });
    }
    countByProduct.set(review.productId, (countByProduct.get(review.productId) ?? 0) + 1);
  }

  return items.flatMap((item) => {
    const product = item.product;
    if (!product || product.deletedAt !== null) return [];
    const review = latestByProduct.get(product.id);
    return [
      {
        productId: product.id,
        name: product.name,
        slug: product.slug,
        imageUrl: product.images[0]?.url ?? null,
        existingRating: review?.rating ?? null,
        reviewBody: review?.body ?? null,
        reviewCount: countByProduct.get(product.id) ?? 0,
      },
    ];
  });
}

/** True when this buyer has a non-cancelled order containing the product. */
export async function hasPurchased(
  storeId: string,
  customerId: string,
  productId: string,
): Promise<boolean> {
  const item = await prisma.orderItem.findFirst({
    where: {
      productId,
      order: {
        storeId,
        customerId,
        deletedAt: null,
        status: { notIn: ["CANCELLED", "REFUNDED"] },
      },
    },
    select: { orderId: true },
  });
  return Boolean(item);
}

export async function saveBuyerReview(
  storeId: string,
  customerId: string,
  productId: string,
  input: z.infer<typeof reviewSchema>,
): Promise<void> {
  const product = await prisma.product.findFirst({
    where: { id: productId, storeId, deletedAt: null },
    select: { id: true },
  });
  if (!product) throw new NotFoundError("Product");

  const customer = await prisma.customer.findFirst({
    where: { id: customerId, storeId },
    select: { name: true },
  });
  if (!customer) throw new NotFoundError("Customer");

  const verified = await prisma.orderItem.findFirst({
    where: {
      productId,
      order: { storeId, customerId, deletedAt: null, status: { notIn: ["CANCELLED", "REFUNDED"] } },
    },
    orderBy: { id: "desc" },
    select: { orderId: true },
  });

  // Every submission is a new row: a buyer can comment on the same product
  // repeatedly and the earlier comments stay in the history.
  await prisma.productReview.create({
    data: {
      storeId,
      productId,
      customerId,
      orderId: verified?.orderId ?? null,
      rating: input.rating,
      title: input.title || null,
      body: input.body,
      authorName: customer.name,
      status: "APPROVED",
    },
  });
}

export async function deleteBuyerReview(
  storeId: string,
  customerId: string,
  reviewId: string,
): Promise<void> {
  const result = await prisma.productReview.deleteMany({
    where: { id: reviewId, storeId, customerId },
  });
  if (result.count === 0) throw new NotFoundError("Review");
}

export async function addReviewComment(
  storeId: string,
  customer: { id: string; name: string },
  reviewId: string,
  body: string,
): Promise<void> {
  const trimmed = body.trim();
  if (trimmed.length < 2) {
    throw new AppError("VALIDATION_FAILED", "মন্তব্য লিখুন।", 422, { field: "body" });
  }
  if (trimmed.length > 1000) {
    throw new AppError("VALIDATION_FAILED", "মন্তব্য ১০০০ অক্ষরের বেশি হতে পারবে না।", 422);
  }

  const review = await prisma.productReview.findFirst({
    where: { id: reviewId, storeId, status: "APPROVED" },
    select: { id: true },
  });
  if (!review) throw new NotFoundError("Review");

  await prisma.reviewComment.create({
    data: {
      reviewId,
      customerId: customer.id,
      authorName: customer.name,
      body: trimmed,
    },
  });
}

// ── Wishlist ────────────────────────────────────────────────────────────────

export type BuyerWishlistItem = {
  productId: string;
  name: string;
  slug: string;
  price: string;
  comparePrice: string | null;
  imageUrl: string | null;
  inStock: boolean;
};

export async function isWishlisted(
  storeId: string,
  customerId: string,
  productId: string,
): Promise<boolean> {
  const row = await prisma.wishlistItem.findUnique({
    where: { customerId_productId: { customerId, productId } },
    select: { id: true, storeId: true },
  });
  return Boolean(row && row.storeId === storeId);
}

export async function toggleWishlist(
  storeId: string,
  customerId: string,
  productId: string,
): Promise<{ saved: boolean }> {
  const existing = await prisma.wishlistItem.findUnique({
    where: { customerId_productId: { customerId, productId } },
    select: { id: true, storeId: true },
  });

  if (existing && existing.storeId === storeId) {
    await prisma.wishlistItem.delete({ where: { id: existing.id } });
    return { saved: false };
  }

  const product = await prisma.product.findFirst({
    where: { id: productId, storeId, deletedAt: null },
    select: { id: true },
  });
  if (!product) throw new NotFoundError("Product");

  await prisma.wishlistItem.upsert({
    where: { customerId_productId: { customerId, productId } },
    create: { storeId, customerId, productId },
    update: { storeId },
  });
  return { saved: true };
}

export async function listWishlist(
  storeId: string,
  customerId: string,
): Promise<BuyerWishlistItem[]> {
  const rows = await prisma.wishlistItem.findMany({
    where: { storeId, customerId },
    orderBy: { createdAt: "desc" },
    include: {
      product: {
        select: {
          id: true,
          name: true,
          slug: true,
          status: true,
          deletedAt: true,
          images: { take: 1, orderBy: { sortOrder: "asc" }, select: { url: true } },
          variants: {
            select: { price: true, comparePrice: true, stockQty: true, reservedQty: true },
          },
        },
      },
    },
  });

  return rows
    .filter((row) => row.product.deletedAt === null && row.product.status === "ACTIVE")
    .map((row) => {
      const prices = row.product.variants.map((variant) => toPaisa(variant.price));
      const compares = row.product.variants
        .map((variant) => (variant.comparePrice === null ? null : toPaisa(variant.comparePrice)))
        .filter((value): value is bigint => value !== null);
      const cheapest = prices.length ? prices.reduce((min, value) => (value < min ? value : min)) : 0n;
      return {
        productId: row.product.id,
        name: row.product.name,
        slug: row.product.slug,
        price: fromPaisa(cheapest),
        comparePrice:
          compares.length && compares.some((value) => value > cheapest)
            ? fromPaisa(compares.reduce((min, value) => (value < min ? value : min)))
            : null,
        imageUrl: row.product.images[0]?.url ?? null,
        inStock: row.product.variants.some(
          (variant) => variant.stockQty - variant.reservedQty > 0,
        ),
      };
    });
}
