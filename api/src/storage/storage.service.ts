import { randomUUID } from "node:crypto";
import {
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from "@nestjs/common";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import type { AuthenticatedUser } from "../auth/auth.types";
import { storageEnv } from "../config/env";
import { PrismaService } from "../database/prisma.service";
import { MAX_UPLOAD_BYTES, type PresignUploadDto } from "./dto/presign-upload.dto";

const PRESIGN_TTL_SECONDS = 300;

const EXTENSIONS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};

/** Deterministic, path-safe object key: stripes uploads per store. */
export function buildObjectKey(dto: PresignUploadDto): string {
  const extension = EXTENSIONS[dto.contentType] ?? "bin";
  const stem =
    dto.filename
      .replace(/\.[^.]+$/, "")
      .toLowerCase()
      .replace(/[^a-z0-9_-]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 48) || "image";

  return `stores/${dto.storeId}/${randomUUID()}-${stem}.${extension}`;
}

/**
 * S3-compatible storage (Cloudflare R2, AWS S3, MinIO).
 *
 * Uploads use presigned PUT URLs so large files bypass the API process, and the
 * bucket can stay private behind a CDN/public base URL. When the S3_* variables
 * are absent the service reports 503 instead of silently accepting uploads that
 * would 404 later.
 */
@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private readonly client: S3Client | null;

  constructor(private readonly prisma: PrismaService) {
    this.client = storageEnv.configured
      ? new S3Client({
          region: storageEnv.region,
          endpoint: storageEnv.endpoint,
          forcePathStyle: storageEnv.forcePathStyle,
          credentials: {
            accessKeyId: storageEnv.accessKeyId,
            secretAccessKey: storageEnv.secretAccessKey,
          },
        })
      : null;

    if (this.client) {
      this.logger.log(`Object storage ready (bucket=${storageEnv.bucket})`);
    } else {
      this.logger.warn("Object storage disabled — set S3_* env vars to enable product image uploads.");
    }
  }

  isConfigured(): boolean {
    return this.client !== null;
  }

  async presignUpload(
    user: AuthenticatedUser,
    dto: PresignUploadDto,
  ): Promise<{
    uploadUrl: string;
    key: string;
    publicUrl: string;
    expiresIn: number;
    maxBytes: number;
    headers: Record<string, string>;
  }> {
    if (!this.client) {
      throw new ServiceUnavailableException(
        "Object storage is not configured. Set S3_ENDPOINT, S3_BUCKET, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY and S3_PUBLIC_BASE_URL.",
      );
    }

    await this.assertStoreAccess(user, dto.storeId);

    const key = buildObjectKey(dto);
    const uploadUrl = await getSignedUrl(
      this.client,
      new PutObjectCommand({
        Bucket: storageEnv.bucket,
        Key: key,
        ContentType: dto.contentType,
        ContentLength: dto.size,
      }),
      { expiresIn: PRESIGN_TTL_SECONDS },
    );

    return {
      uploadUrl,
      key,
      publicUrl: `${storageEnv.publicBaseUrl.replace(/\/+$/, "")}/${key}`,
      expiresIn: PRESIGN_TTL_SECONDS,
      maxBytes: MAX_UPLOAD_BYTES,
      headers: { "Content-Type": dto.contentType },
    };
  }

  /**
   * Super admins may manage every store; everyone else needs an active
   * membership in the store's tenant. Never trust a storeId from the client.
   */
  private async assertStoreAccess(user: AuthenticatedUser, storeId: string): Promise<void> {
    if (user.isSuperAdmin) return;

    const store = await this.prisma.store.findFirst({
      where: { id: storeId, deletedAt: null },
      select: { tenantId: true },
    });
    if (!store) throw new NotFoundException("Store not found");

    const membership = await this.prisma.membership.findFirst({
      where: { tenantId: store.tenantId, userId: user.id, status: "ACTIVE" },
      select: { id: true },
    });
    if (!membership) throw new ForbiddenException("You do not have access to this store");
  }
}
