import { Body, Controller, Get, HttpCode, HttpStatus, Post, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import type { AuthenticatedUser } from "../auth/auth.types";
import { PresignUploadDto } from "./dto/presign-upload.dto";
import { StorageService } from "./storage.service";

@ApiTags("storage")
@Controller("storage")
export class StorageController {
  constructor(private readonly storage: StorageService) {}

  @Get("status")
  @ApiOperation({ summary: "Whether object storage is configured" })
  status(): { configured: boolean } {
    return { configured: this.storage.isConfigured() };
  }

  @Post("presign")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: "Get a presigned PUT URL for a product image (direct browser upload)",
  })
  @ApiResponse({ status: 201, description: "uploadUrl, key, publicUrl and required headers" })
  @ApiResponse({ status: 403, description: "No membership for the store" })
  @ApiResponse({ status: 503, description: "Object storage is not configured" })
  presign(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: PresignUploadDto,
  ): ReturnType<StorageService["presignUpload"]> {
    return this.storage.presignUpload(user, dto);
  }
}
