import { ApiProperty, ApiPropertyOptional, PartialType } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from "class-validator";

export const CATALOG_STATUSES = ["DRAFT", "ACTIVE", "ARCHIVED"] as const;
export type CatalogStatus = (typeof CATALOG_STATUSES)[number];

/** Money is validated as a decimal string so floats never touch the Decimal columns. */
const DECIMAL = /^\d+(\.\d{1,2})?$/;

export class VariantInputDto {
  @ApiPropertyOptional({ description: "Existing variant id (update only)" })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  id?: string;

  @ApiProperty({ maxLength: 64, example: "LIGHT-BLUE-10ML" })
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  sku!: string;

  @ApiPropertyOptional({ type: Object, example: { size: "10ml", color: "blue" } })
  @IsOptional()
  @IsObject()
  optionValues?: Record<string, string>;

  @ApiProperty({ example: "1299.00", description: "Selling price, decimal string" })
  @IsString()
  @Matches(DECIMAL, { message: "price must be a decimal string like 1299.00" })
  price!: string;

  @ApiPropertyOptional({ example: "1599.00" })
  @IsOptional()
  @Matches(DECIMAL, { message: "comparePrice must be a decimal string" })
  comparePrice?: string | null;

  @ApiPropertyOptional({ example: "800.00" })
  @IsOptional()
  @Matches(DECIMAL, { message: "costPrice must be a decimal string" })
  costPrice?: string | null;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  stockQty?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  weightGrams?: number | null;

  @ApiPropertyOptional({ enum: CATALOG_STATUSES, default: "ACTIVE" })
  @IsOptional()
  @IsEnum(CATALOG_STATUSES)
  status?: CatalogStatus;
}

export class ProductImageInputDto {
  @ApiProperty({ maxLength: 800, description: "Public image URL" })
  @IsString()
  @MinLength(1)
  @MaxLength(800)
  url!: string;

  @ApiPropertyOptional({ maxLength: 200 })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  altText?: string;
}

export class CreateProductDto {
  @ApiProperty({ minLength: 2, maxLength: 160 })
  @IsString()
  @MinLength(2)
  @MaxLength(160)
  name!: string;

  @ApiPropertyOptional({ maxLength: 80 })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  slug?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(40)
  categoryId?: string | null;

  @ApiPropertyOptional({ maxLength: 8000 })
  @IsOptional()
  @IsString()
  @MaxLength(8000)
  description?: string;

  @ApiPropertyOptional({ type: [String], maxLength: 20 })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @MaxLength(40, { each: true })
  tags?: string[];

  @ApiPropertyOptional({ enum: CATALOG_STATUSES, default: "ACTIVE" })
  @IsOptional()
  @IsEnum(CATALOG_STATUSES)
  status?: CatalogStatus;

  @ApiPropertyOptional({ default: 5 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1000)
  lowStockThreshold?: number;

  @ApiPropertyOptional({ type: [ProductImageInputDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ProductImageInputDto)
  images?: ProductImageInputDto[];

  @ApiProperty({ type: [VariantInputDto] })
  @IsArray()
  @ArrayMinSize(1, { message: "At least one variant is required" })
  @ValidateNested({ each: true })
  @Type(() => VariantInputDto)
  variants!: VariantInputDto[];
}

export class UpdateProductDto extends PartialType(CreateProductDto) {}

export class ListProductsQueryDto {
  @ApiPropertyOptional({ default: 20, maximum: 100 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  @ApiPropertyOptional({ description: "Opaque cursor from a previous page" })
  @IsOptional()
  @IsString()
  cursor?: string;

  @ApiPropertyOptional({ enum: CATALOG_STATUSES })
  @IsOptional()
  @IsEnum(CATALOG_STATUSES)
  status?: CatalogStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(160)
  search?: string;
}

export class CreateCategoryDto {
  @ApiProperty({ minLength: 1, maxLength: 120 })
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name!: string;

  @ApiPropertyOptional({ maxLength: 80 })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  slug?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(40)
  parentId?: string | null;
}
