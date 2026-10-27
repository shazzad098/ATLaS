import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Query,
  UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import type { AuthenticatedUser } from "../auth/auth.types";
import { ListOrdersQueryDto, UpdateOrderStatusDto } from "./dto/orders.dto";
import { OrdersService } from "./orders.service";

@ApiTags("orders")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("orders")
export class OrdersController {
  constructor(private readonly orders: OrdersService) {}

  @Get("stores/:storeId")
  @ApiOperation({ summary: "Paginated orders of a store" })
  listOrders(
    @CurrentUser() user: AuthenticatedUser,
    @Param("storeId") storeId: string,
    @Query() query: ListOrdersQueryDto,
  ) {
    return this.orders.listOrders(user, storeId, query);
  }

  @Get("stores/:storeId/counts")
  @ApiOperation({ summary: "Order counts + gross by status" })
  countsByStatus(@CurrentUser() user: AuthenticatedUser, @Param("storeId") storeId: string) {
    return this.orders.countsByStatus(user, storeId);
  }

  @Get("stores/:storeId/recent")
  @ApiOperation({ summary: "Most recent orders" })
  recentOrders(@CurrentUser() user: AuthenticatedUser, @Param("storeId") storeId: string) {
    return this.orders.recentOrders(user, storeId);
  }

  @Get("stores/:storeId/:idOrNo")
  @ApiOperation({ summary: "Order detail (id or order number)" })
  getOrderDetail(
    @CurrentUser() user: AuthenticatedUser,
    @Param("storeId") storeId: string,
    @Param("idOrNo") idOrNo: string,
  ) {
    return this.orders.getOrderDetail(user, storeId, idOrNo);
  }

  @Patch("stores/:storeId/:orderId/status")
  @ApiOperation({ summary: "Transition an order status (guarded)" })
  updateOrderStatus(
    @CurrentUser() user: AuthenticatedUser,
    @Param("storeId") storeId: string,
    @Param("orderId") orderId: string,
    @Body() dto: UpdateOrderStatusDto,
  ) {
    return this.orders.updateOrderStatus(user, storeId, orderId, dto);
  }
}
