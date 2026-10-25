import { ApiProperty } from "@nestjs/swagger";
import { IsIn, IsInt, IsNotEmpty, IsString, Max, MaxLength, Min } from "class-validator";

export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

export const ALLOWED_UPLOAD_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
] as const;

export type UploadContentType = (typeof ALLOWED_UPLOAD_TYPES)[number];

const ALLOWED_TYPES: string[] = [...ALLOWED_UPLOAD_TYPES];

/**
 * Request a short-lived presigned PUT URL.
 *
 * The browser uploads straight to R2/S3, so image bytes never pass through the
 * API. Content type and size are signed into the URL, and the key is generated
 * server-side under the merchant's store prefix — a client cannot choose a path.
 */
export class PresignUploadDto {
  @ApiProperty({ description: "Store that owns the image", maxLength: 40 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(40)
  storeId!: string;

  @ApiProperty({ enum: ALLOWED_UPLOAD_TYPES, example: "image/webp" })
  @IsIn(ALLOWED_TYPES, { message: `contentType must be one of: ${ALLOWED_TYPES.join(", ")}` })
  contentType!: UploadContentType;

  @ApiProperty({ description: "Original filename (extension is derived from it)", maxLength: 160 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(160)
  filename!: string;

  @ApiProperty({ description: "File size in bytes", maximum: MAX_UPLOAD_BYTES })
  @IsInt()
  @Min(1)
  @Max(MAX_UPLOAD_BYTES, { message: "Image must be 5 MB or smaller" })
  size!: number;
}
