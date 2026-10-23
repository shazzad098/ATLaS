import { prisma } from "@/lib/db";
import { AppError, NotFoundError } from "@/lib/errors";
import { addMoney, compareMoney, formatBdt, fromPaisa, rateOf, subtractMoney, toPaisa } from "@/lib/money";

/**
 * Cart + pricing.
 *
 * A cart belongs to a storefront session, identified by a `sessionKey` cookie,
 * so guest checkout works without an account (PRD §3.3). Prices are re-read
 * from the database on every render; the cart only stores quantities.
 */

export const CART_COOKIE = "atlas_cart";
export const CART_TTL_DAYS = 14;

export type CartWithItems = Awaited<ReturnType<typeof loadCart>>;

export async function getOrCreateOpenCart(
  storeId: string,
  sessionKey: string,
  customerId?: string | null,
) {
  const existing = await prisma.cart.findUnique({
    where: { storeId_sessionKey: { storeId, sessionKey } },
  });
  if (existing && existing.status === "OPEN") {
    if (existing.expiresAt && existing.expiresAt < new Date()) {
      await prisma.cart.update({ where: { id: existing.id }, data: { status: "EXPIRED" } });
    } else {
      return existing;
    }
  }

  return prisma.cart.upsert({
    where: { storeId_sessionKey: { storeId, sessionKey } },
    create: {
      storeId,
      sessionKey,
      customerId: customerId ?? null,
      status: "OPEN",
      expiresAt: new Date(Date.now() + CART_TTL_DAYS * 86_400_000),
    },
    update: {
      status: "OPEN",
      customerId: customerId ?? undefined,
      expiresAt: new Date(Date.now() + CART_TTL_DAYS * 86_400_000),
    },
  });
}

export async function loadCart(storeId: string, sessionKey: string) {
  const cart = await prisma.cart.findUnique({
    where: { storeId_sessionKey: { storeId, sessionKey } },
    include: {
      items: {
        orderBy: { id: "asc" },
        include: {
          variant: {
            include: {
              product: {
                include: { images: { orderBy: { sortOrder: "asc" }, take: 1 } },
              },
            },
          },
        },
      },
    },
  });
  if (!cart || cart.status !== "OPEN") return null;
  return cart;
}

export async function addItem(
  storeId: string,
  sessionKey: string,
  input: { variantId: string; quantity: number },
) {
  const quantity = Math.max(1, Math.min(Math.trunc(input.quantity), 50));

  const variant = await prisma.productVariant.findFirst({
    where: { id: input.variantId, status: "ACTIVE", product: { storeId, status: "ACTIVE", deletedAt: null } },
    select: { id: true, price: true, stockQty: true, reservedQty: true },
  });
  if (!variant) throw new NotFoundError("Product variant");

  const cart = await getOrCreateOpenCart(storeId, sessionKey);

  const existing = await prisma.cartItem.findUnique({
    where: { cartId_variantId: { cartId: cart.id, variantId: variant.id } },
  });
  const nextQuantity = (existing?.quantity ?? 0) + quantity;

  const available = variant.stockQty - variant.reservedQty;
  if (available < nextQuantity) {
    throw new AppError(
      "VALIDATION_FAILED",
      available <= 0
        ? "এই পণ্যটি এই মুহূর্তে স্টকে নেই।"
        : `মাত্র ${available}টি স্টকে আছে।`,
      422,
      { available, requested: nextQuantity },
    );
  }

  await prisma.cartItem.upsert({
    where: { cartId_variantId: { cartId: cart.id, variantId: variant.id } },
    create: {
      cartId: cart.id,
      variantId: variant.id,
      quantity,
      unitPriceSnapshot: variant.price,
    },
    update: { quantity: nextQuantity, unitPriceSnapshot: variant.price },
  });

  return loadCart(storeId, sessionKey);
}

export async function updateItem(
  storeId: string,
  sessionKey: string,
  itemId: string,
  quantity: number,
) {
  const cart = await getOrCreateOpenCart(storeId, sessionKey);
  if (quantity <= 0) {
    await prisma.cartItem.deleteMany({ where: { id: itemId, cartId: cart.id } });
    return loadCart(storeId, sessionKey);
  }

  const item = await prisma.cartItem.findFirst({
    where: { id: itemId, cartId: cart.id },
    include: { variant: { select: { stockQty: true, reservedQty: true } } },
  });
  if (!item) throw new NotFoundError("Cart item");

  const available = item.variant.stockQty - item.variant.reservedQty;
  if (available < quantity) {
    throw new AppError("VALIDATION_FAILED", `মাত্র ${available}টি স্টকে আছে।`, 422, { available });
  }

  await prisma.cartItem.update({ where: { id: itemId }, data: { quantity } });
  return loadCart(storeId, sessionKey);
}

export async function removeItem(storeId: string, sessionKey: string, itemId: string) {
  const cart = await getOrCreateOpenCart(storeId, sessionKey);
  await prisma.cartItem.deleteMany({ where: { id: itemId, cartId: cart.id } });
  return loadCart(storeId, sessionKey);
}

export async function setCoupon(storeId: string, sessionKey: string, code: string | null) {
  const cart = await getOrCreateOpenCart(storeId, sessionKey);
  await prisma.cart.update({
    where: { id: cart.id },
    data: { couponCode: code ? code.trim().toUpperCase() : null },
  });
  return loadCart(storeId, sessionKey);
}

// ── Pricing ──────────────────────────────────────────────────────────────────

export type CouponCheck =
  | { ok: true; coupon: { id: string; code: string; type: string; value: unknown; minOrder: unknown } }
  | { ok: false; reason: string };

export async function validateCoupon(
  storeId: string,
  code: string,
  subtotal: string,
): Promise<CouponCheck> {
  const coupon = await prisma.coupon.findFirst({
    where: { storeId, code: code.trim().toUpperCase() },
  });
  if (!coupon) return { ok: false, reason: "কুপন কোডটি পাওয়া যায়নি।" };
  if (coupon.status !== "ACTIVE") return { ok: false, reason: "কুপনটি এখন সক্রিয় নয়।" };

  const now = new Date();
  if (coupon.startsAt && coupon.startsAt > now) return { ok: false, reason: "কুপনটি এখনো শুরু হয়নি।" };
  if (coupon.endsAt && coupon.endsAt < now) return { ok: false, reason: "কুপনের মেয়াদ শেষ হয়েছে।" };
  if (coupon.usageLimit !== null && coupon.usedCount >= coupon.usageLimit) {
    return { ok: false, reason: "কুপনের ব্যবহার সীমা শেষ।" };
  }
  if (compareMoney(subtotal, coupon.minOrder) < 0) {
    return {
      ok: false,
      reason: `এই কুপনের জন্য ন্যূনতম অর্ডার ${formatBdt(coupon.minOrder)}।`,
    };
  }

  return {
    ok: true,
    coupon: {
      id: coupon.id,
      code: coupon.code,
      type: coupon.type,
      value: coupon.value,
      minOrder: coupon.minOrder,
    },
  };
}

export type PricedLine = {
  itemId: string;
  variantId: string;
  productId: string;
  productName: string;
  productSlug: string;
  sku: string;
  optionValues: Record<string, string>;
  imageUrl: string | null;
  quantity: number;
  unitPrice: string;
  lineTotal: string;
  available: number;
};

export type CartPricing = {
  lines: PricedLine[];
  itemCount: number;
  subtotal: string;
  discountTotal: string;
  shippingTotal: string;
  grandTotal: string;
  coupon: { id: string; code: string; amount: string; type: string } | null;
  couponError: string | null;
  zone: { id: string; name: string; charge: string } | null;
  currency: string;
};

export async function priceCart(
  storeId: string,
  cart: NonNullable<Awaited<ReturnType<typeof loadCart>>>,
  options: { zoneId?: string | null } = {},
): Promise<CartPricing> {
  const lines: PricedLine[] = cart.items.map((item) => {
    const available = item.variant.stockQty - item.variant.reservedQty;
    return {
      itemId: item.id,
      variantId: item.variantId,
      productId: item.variant.productId,
      productName: item.variant.product.name,
      productSlug: item.variant.product.slug,
      sku: item.variant.sku,
      optionValues: (item.variant.optionValuesJson ?? {}) as Record<string, string>,
      imageUrl: item.variant.product.images[0]?.url ?? null,
      quantity: item.quantity,
      unitPrice: fromPaisa(toPaisa(item.variant.price)),
      lineTotal: fromPaisa(toPaisa(item.variant.price) * BigInt(item.quantity)),
      available,
    };
  });

  const subtotal = lines.reduce((acc, line) => acc + toPaisa(line.lineTotal), 0n);

  let discountTotal = 0n;
  let coupon: CartPricing["coupon"] = null;
  let couponError: string | null = null;

  if (cart.couponCode) {
    const check = await validateCoupon(storeId, cart.couponCode, fromPaisa(subtotal));
    if (check.ok) {
      const amount =
        check.coupon.type === "PERCENTAGE"
          ? rateOf(fromPaisa(subtotal), Number(check.coupon.value) / 100)
          : String(check.coupon.value);
      const capped = toPaisa(amount) > subtotal ? subtotal : toPaisa(amount);
      discountTotal = capped;
      coupon = { id: check.coupon.id, code: check.coupon.code, amount: fromPaisa(capped), type: check.coupon.type };
    } else {
      couponError = check.reason;
    }
  }

  // Delivery charge: explicit zone, else the store's default zone.
  const zone = options.zoneId
    ? await prisma.deliveryZone.findFirst({ where: { id: options.zoneId, storeId, isActive: true } })
    : await prisma.deliveryZone.findFirst({
        where: { storeId, isActive: true },
        orderBy: [{ isDefault: "desc" }, { sortOrder: "asc" }],
      });

  const netMerchandise = subtotal - discountTotal;
  let shippingTotal = zone ? toPaisa(zone.charge) : 0n;
  if (zone?.freeAbove && netMerchandise >= toPaisa(zone.freeAbove)) shippingTotal = 0n;

  const grandTotal = netMerchandise + shippingTotal;

  return {
    lines,
    itemCount: lines.reduce((acc, line) => acc + line.quantity, 0),
    subtotal: fromPaisa(subtotal),
    discountTotal: fromPaisa(discountTotal),
    shippingTotal: fromPaisa(shippingTotal),
    grandTotal: fromPaisa(grandTotal),
    coupon,
    couponError,
    zone: zone ? { id: zone.id, name: zone.name, charge: fromPaisa(toPaisa(zone.charge)) } : null,
    currency: "BDT",
  };
}

export async function listDeliveryZones(storeId: string, options: { activeOnly?: boolean } = {}) {
  return prisma.deliveryZone.findMany({
    where: { storeId, ...(options.activeOnly ? { isActive: true } : {}) },
    orderBy: [{ isDefault: "desc" }, { sortOrder: "asc" }],
  });
}

export { addMoney, subtractMoney, compareMoney };
