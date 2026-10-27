import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import type { AuthenticatedUser } from "../auth/auth.types";
import {
  assertPermission,
  ORDERS_READ,
  ORDERS_WRITE,
  permissionsForRole,
  STORE_READ,
} from "../common/rbac";
import { PrismaService } from "../database/prisma.service";
import { QueueService } from "../queue/queue.service";
import type { Prisma } from "../generated/prisma/client";
import {
  allowedNextStatuses,
  canTransition,
  isCommittedStatus,
  type OrderStatusValue,
} from "./order.constants";
import type { ListOrdersQueryDto, UpdateOrderStatusDto } from "./dto/orders.dto";
import {
  applyAllOrderFees,
  enqueueMerchantWebhook,
  notifyInApp,
  releaseCouponReservation,
  reverseFeesForOrder,
} from "./order-side-effects";

type StoreContext = { storeId: string; tenantId: string; permissions: string[] };

/**
 * Orders (FR-04) — tenant-scoped reads plus a guarded status transition.
 *
 * Mirrors the Next.js order-service. The transition is wrapped in a conditional
 * UPDATE (so two requests cannot both move an order) and writes an OrderEvent,
 * applies inventory side effects and queues an audit record.
 *
 * Fee reversal, coupon release, merchant webhooks and notifications are still
 * emitted by the Next.js path until those services are migrated; the core
 * order + event + inventory state is fully consistent here.
 */
@Injectable()
export class OrdersService {
  private readonly logger = new Logger(OrdersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly queue: QueueService,
  ) {}

  async listOrders(user: AuthenticatedUser, storeId: string, query: ListOrdersQueryDto) {
    await this.resolveStore(user, storeId, ORDERS_READ);
    const limit = query.limit ?? 20;

    const rows = await this.prisma.order.findMany({
      where: {
        storeId,
        deletedAt: null,
        ...(query.status ? { status: query.status } : {}),
        ...(query.paymentStatus ? { paymentStatus: query.paymentStatus as never } : {}),
        ...(query.from || query.to
          ? {
              placedAt: {
                ...(query.from ? { gte: new Date(query.from) } : {}),
                ...(query.to ? { lte: new Date(query.to) } : {}),
              },
            }
          : {}),
        ...(query.q
          ? {
              OR: [
                { orderNo: { contains: query.q } },
                { customerName: { contains: query.q } },
                { customerPhone: { contains: query.q } },
              ],
            }
          : {}),
      },
      orderBy: [{ placedAt: "desc" }, { id: "desc" }],
      take: limit + 1,
      ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
      include: { _count: { select: { items: true } } },
    });

    const hasMore = rows.length > limit;
    const items = hasMore ? rows.slice(0, limit) : rows;
    return { items, nextCursor: hasMore ? items[items.length - 1]?.id ?? null : null, hasMore };
  }

  async getOrderDetail(user: AuthenticatedUser, storeId: string, idOrNo: string) {
    await this.resolveStore(user, storeId, ORDERS_READ);
    const order = await this.prisma.order.findFirst({
      where: { storeId, deletedAt: null, OR: [{ id: idOrNo }, { orderNo: idOrNo }] },
      include: {
        items: true,
        events: { orderBy: { createdAt: "asc" } },
        payments: { orderBy: { createdAt: "desc" } },
        returns: { orderBy: { requestedAt: "desc" } },
        feeLedger: true,
      },
    });
    if (!order) throw new NotFoundException("Order not found");
    return order;
  }

  async countsByStatus(user: AuthenticatedUser, storeId: string) {
    await this.resolveStore(user, storeId, ORDERS_READ);
    return this.prisma.order.groupBy({
      by: ["status"],
      where: { storeId, deletedAt: null },
      _count: { _all: true },
      _sum: { grandTotal: true },
    });
  }

  async recentOrders(user: AuthenticatedUser, storeId: string, limit = 8) {
    await this.resolveStore(user, storeId, ORDERS_READ);
    return this.prisma.order.findMany({
      where: { storeId, deletedAt: null },
      orderBy: { placedAt: "desc" },
      take: Math.min(Math.max(limit, 1), 50),
    });
  }

  async updateOrderStatus(
    user: AuthenticatedUser,
    storeId: string,
    orderId: string,
    dto: UpdateOrderStatusDto,
  ) {
    const context = await this.resolveStore(user, storeId, ORDERS_WRITE);

    const order = await this.prisma.order.findFirst({
      where: { id: orderId, storeId, deletedAt: null },
      include: { items: true },
    });
    if (!order) throw new NotFoundException("Order not found");

    if (!canTransition(order.status, dto.status)) {
      throw new BadRequestException({
        message: `Cannot transition order from ${order.status} to ${dto.status}`,
        allowed: allowedNextStatuses(order.status),
      });
    }

    const from = order.status as OrderStatusValue;
    const to = dto.status;

    await this.prisma.$transaction(async (tx) => {
      const changed = await tx.order.updateMany({
        where: { id: orderId, status: from },
        data: {
          status: to,
          ...(to === "PAID" ? { paymentStatus: "PAID" } : {}),
          ...(to === "CONFIRMED" ? { confirmedAt: new Date() } : {}),
          ...(to === "DELIVERED" ? { deliveredAt: new Date(), fulfillmentStatus: "FULFILLED" } : {}),
          ...(to === "CANCELLED" ? { cancelledAt: new Date() } : {}),
          ...(to === "REFUNDED" ? { paymentStatus: "REFUNDED" } : {}),
          ...(to === "RETURN_REQUESTED" ? { fulfillmentStatus: "PARTIAL" } : {}),
          ...(to === "RETURNED" ? { fulfillmentStatus: "RETURNED" } : {}),
          ...(to === "PROCESSING" || to === "SHIPPED" ? { fulfillmentStatus: "PARTIAL" } : {}),
        },
      });
      if (changed.count !== 1) {
        throw new ConflictException("The order was changed by another request.");
      }

      await tx.orderEvent.create({
        data: {
          orderId,
          fromStatus: from,
          toStatus: to,
          actorType: dto.actorType ?? "STAFF",
          actorId: user.id,
          note: dto.note,
        },
      });

      if (to === "CONFIRMED") {
        for (const item of order.items) {
          if (!item.variantId) continue;
          await this.commitReservedSale(tx, item.variantId, item.quantity, orderId);
        }
      }

      if (to === "CANCELLED") {
        const alreadyCommitted = isCommittedStatus(from);
        for (const item of order.items) {
          if (!item.variantId) continue;
          if (alreadyCommitted) await this.restockVariant(tx, item.variantId, item.quantity, "Order cancelled", orderId);
          else await this.releaseReservation(tx, item.variantId, item.quantity);
        }
      }

      if (to === "RETURNED") {
        for (const item of order.items) {
          if (!item.variantId) continue;
          await this.restockVariant(tx, item.variantId, item.quantity, "Return received", orderId);
        }
      }
    });

    void this.queue.enqueueAudit({
      action: "order.status_changed",
      actorId: user.id,
      tenantId: context.tenantId,
      resourceType: "Order",
      resourceId: orderId,
      metadata: { from, to, note: dto.note ?? null },
    });

    await this.runSideEffects(orderId, order.orderNo, order.grandTotal, context.tenantId, storeId, from, to);

    return this.getOrderDetail(user, storeId, orderId);
  }

  /**
   * Post-transition side effects (fees, coupon, notification, merchant webhook).
   * The order/event/inventory state is already committed; failures here are
   * logged, not returned as a 500, so a queue/webhook blip cannot fail a
   * transition that already happened.
   */
  private async runSideEffects(
    orderId: string,
    orderNo: string,
    grandTotal: unknown,
    tenantId: string,
    storeId: string,
    from: OrderStatusValue,
    to: OrderStatusValue,
  ): Promise<void> {
    const safe = async (label: string, fn: () => Promise<void>): Promise<void> => {
      try {
        await fn();
      } catch (error) {
        this.logger.error(
          `[orders] side effect "${label}" failed: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    };

    await safe("fees", () =>
      to === "CANCELLED" || to === "REFUNDED"
        ? reverseFeesForOrder(this.prisma, orderId)
        : applyAllOrderFees(this.prisma, orderId),
    );
    if (to === "CANCELLED") {
      await safe("coupon.release", () => releaseCouponReservation(this.prisma, orderId));
    }

    const owner = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { ownerUserId: true },
    });
    if (owner) {
      if (to === "PAID") {
        await safe("notify.paid", () =>
          notifyInApp(this.prisma, owner.ownerUserId, "payment.received", `Payment received — ${orderNo}`, `${String(grandTotal)} paid.`, { orderNo, storeId }),
        );
      } else if (to === "CANCELLED") {
        await safe("notify.cancelled", () =>
          notifyInApp(this.prisma, owner.ownerUserId, "order.cancelled", `Order cancelled — ${orderNo}`, undefined, { orderNo, storeId }),
        );
      }
    }

    await safe("webhook.status", () =>
      enqueueMerchantWebhook(this.prisma, tenantId, "order.status_changed", {
        orderId,
        orderNo,
        storeId,
        fromStatus: from,
        toStatus: to,
        grandTotal: String(grandTotal),
      }),
    );
    if (to === "PAID") {
      await safe("webhook.paid", () =>
        enqueueMerchantWebhook(this.prisma, tenantId, "payment.succeeded", {
          orderId,
          orderNo,
          storeId,
          amount: String(grandTotal),
        }),
      );
    }
  }

  private async resolveStore(user: AuthenticatedUser, storeId: string, permission: string): Promise<StoreContext> {
    const store = await this.prisma.store.findFirst({
      where: { id: storeId, deletedAt: null },
      select: { id: true, tenantId: true },
    });
    if (!store) throw new NotFoundException("Store not found");

    if (user.isSuperAdmin) return { storeId: store.id, tenantId: store.tenantId, permissions: ["*"] };

    const membership = await this.prisma.membership.findFirst({
      where: { tenantId: store.tenantId, userId: user.id, status: "ACTIVE" },
      include: { role: { select: { code: true, permissionsJson: true } } },
    });
    if (!membership) throw new ForbiddenException("You do not have access to this store");

    const permissions = permissionsForRole(membership.role.code, membership.role.permissionsJson);
    if (permission === ORDERS_WRITE) assertPermission(permissions, ORDERS_WRITE);
    else if (permission === ORDERS_READ) assertPermission(permissions, ORDERS_READ);
    else assertPermission(permissions, STORE_READ);

    return { storeId: store.id, tenantId: store.tenantId, permissions };
  }

  // ---- inventory side effects (mirror inventory-service.ts) ----

  private async commitReservedSale(
    tx: Prisma.TransactionClient,
    variantId: string,
    quantity: number,
    orderId: string,
  ): Promise<void> {
    if (quantity <= 0) return;
    const variant = await tx.productVariant.findUnique({
      where: { id: variantId },
      select: { product: { select: { storeId: true } } },
    });
    if (!variant) return;

    await tx.$executeRaw`
      UPDATE "ProductVariant"
         SET "reservedQty" = GREATEST("reservedQty" - ${quantity}, 0),
             "stockQty"    = GREATEST("stockQty" - ${quantity}, 0)
       WHERE "id" = ${variantId}
    `;
    await tx.inventoryMovement.create({
      data: {
        storeId: variant.product.storeId,
        variantId,
        type: "SALE",
        quantityDelta: -quantity,
        reason: "Order fulfilled",
        referenceType: "Order",
        referenceId: orderId,
      },
    });
  }

  private async releaseReservation(
    tx: Prisma.TransactionClient,
    variantId: string,
    quantity: number,
  ): Promise<void> {
    if (quantity <= 0) return;
    await tx.$executeRaw`
      UPDATE "ProductVariant"
         SET "reservedQty" = GREATEST("reservedQty" - ${quantity}, 0)
       WHERE "id" = ${variantId}
    `;
  }

  private async restockVariant(
    tx: Prisma.TransactionClient,
    variantId: string,
    quantity: number,
    reason: string,
    orderId: string,
  ): Promise<void> {
    if (quantity <= 0) return;
    const variant = await tx.productVariant.findUnique({
      where: { id: variantId },
      select: { product: { select: { storeId: true } } },
    });
    if (!variant) return;

    await tx.productVariant.update({
      where: { id: variantId },
      data: { stockQty: { increment: quantity } },
    });
    await tx.inventoryMovement.create({
      data: {
        storeId: variant.product.storeId,
        variantId,
        type: "RETURN",
        quantityDelta: quantity,
        reason,
        referenceType: "Order",
        referenceId: orderId,
      },
    });
  }
}
