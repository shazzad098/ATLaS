import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import type { AuthenticatedUser } from "../auth/auth.types";
import { CatalogService } from "./catalog.service";
import {
  CreateCategoryDto,
  CreateProductDto,
  ListProductsQueryDto,
  UpdateProductDto,
} from "./dto/catalog.dto";

@ApiTags("catalog")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("catalog")
export class CatalogController {
  constructor(private readonly catalog: CatalogService) {}

  @Get("stores")
  @ApiOperation({ summary: "Stores the caller can manage (tenant-scoped)" })
  listStores(@CurrentUser() user: AuthenticatedUser) {
    return this.catalog.listStores(user);
  }

  @Get("stores/:storeId/categories")
  @ApiOperation({ summary: "Categories of a store" })
  listCategories(@CurrentUser() user: AuthenticatedUser, @Param("storeId") storeId: string) {
    return this.catalog.listCategories(user, storeId);
  }

  @Post("stores/:storeId/categories")
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: "Create a category" })
  createCategory(
    @CurrentUser() user: AuthenticatedUser,
    @Param("storeId") storeId: string,
    @Body() dto: CreateCategoryDto,
  ) {
    return this.catalog.createCategory(user, storeId, dto);
  }

  @Get("stores/:storeId/products")
  @ApiOperation({ summary: "Paginated products of a store" })
  listProducts(
    @CurrentUser() user: AuthenticatedUser,
    @Param("storeId") storeId: string,
    @Query() query: ListProductsQueryDto,
  ) {
    return this.catalog.listProducts(user, storeId, query);
  }

  @Post("stores/:storeId/products")
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: "Create a product (with variants and images)" })
  createProduct(
    @CurrentUser() user: AuthenticatedUser,
    @Param("storeId") storeId: string,
    @Body() dto: CreateProductDto,
  ) {
    return this.catalog.createProduct(user, storeId, dto);
  }

  @Get("products/:productId")
  @ApiOperation({ summary: "Single product" })
  getProduct(@CurrentUser() user: AuthenticatedUser, @Param("productId") productId: string) {
    return this.catalog.getProduct(user, productId);
  }

  @Patch("products/:productId")
  @ApiOperation({ summary: "Update a product" })
  updateProduct(
    @CurrentUser() user: AuthenticatedUser,
    @Param("productId") productId: string,
    @Body() dto: UpdateProductDto,
  ) {
    return this.catalog.updateProduct(user, productId, dto);
  }
}
