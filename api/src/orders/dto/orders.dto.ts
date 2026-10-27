import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsEnum, IsInt, IsISO8601, IsOptional, IsString, Max, MaxLength, Min } from "class-validator";
import { ORDER_STATUSES } from "../order.constants";

export class ListOrdersQueryDto {
  @ApiPropertyOptional({ default: 20, maximum: 100 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  cursor?: string;

  @ApiPropertyOptional({ enum: ORDER_STATUSES })
  @IsOptional()
  @IsEnum(ORDER_STATUSES)
  status?: (typeof ORDER_STATUSES)[number];

  @ApiPropertyOptional({
    enum: ["PENDING", "PAID", "PARTIALLY_REFUNDED", "REFUNDED", "FAILED", "CANCELLED"],
  })
  @IsOptional()
  @IsEnum(["PENDING", "PAID", "PARTIALLY_REFUNDED", "REFUNDED", "FAILED", "CANCELLED"])
  paymentStatus?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  q?: string;

  @ApiPropertyOptional({ description: "ISO date lower bound" })
  @IsOptional()
  @IsISO8601()
  from?: string;

  @ApiPropertyOptional({ description: "ISO date upper bound" })
  @IsOptional()
  @IsISO8601()
  to?: string;
}

export class UpdateOrderStatusDto {
  @ApiProperty({ enum: ORDER_STATUSES })
  @IsEnum(ORDER_STATUSES)
  status!: (typeof ORDER_STATUSES)[number];

  @ApiPropertyOptional({ maxLength: 600 })
  @IsOptional()
  @IsString()
  @MaxLength(600)
  note?: string;

  @ApiPropertyOptional({ enum: ["STAFF", "SYSTEM", "CUSTOMER"], default: "STAFF" })
  @IsOptional()
  @IsEnum(["STAFF", "SYSTEM", "CUSTOMER"])
  actorType?: "STAFF" | "SYSTEM" | "CUSTOMER";
}
