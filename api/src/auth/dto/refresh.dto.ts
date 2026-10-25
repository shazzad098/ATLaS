import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsOptional, IsString, MaxLength } from "class-validator";

/**
 * Refresh token may arrive in the httpOnly cookie (browser) or in the body
 * (native/mobile clients that cannot use cookies).
 */
export class RefreshDto {
  @ApiPropertyOptional({ description: "Refresh token for non-cookie clients", maxLength: 200 })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  refreshToken?: string;
}
