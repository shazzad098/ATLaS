import { createHash, randomUUID } from "node:crypto";
import { prisma } from "@/lib/db";
import { ValidationError } from "@/lib/errors";
import { assertPermission, type ActorContext } from "@/lib/rbac";
import { assertStoreAccess } from "@/lib/tenant";
import {
  assertStorageQuotaBytes,
  invalidateEntitlements,
  requireWritableTenant,
} from "@/lib/entitlements";
import { deleteObject, putObject } from "@/lib/storage";

/**
 * Merchant asset pipeline (PRD §5.1 storage quota).
 *
 * Every uploaded file gets an `Asset` row so the quota is enforced on real
 * bytes (not the UI), and so deleting/replacing an image can remove the object
 * from disk or the bucket instead of leaking storage forever.
 */

export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

export const ALLOWED_IMAGE_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/avif": "avif",
  "image/gif": "gif",
};

function validateImage(file: File): string {
  if (!(file instanceof File) || file.size === 0) {
    throw new ValidationError("কোনো ফাইল পাওয়া যায়নি।");
  }
  const extension = ALLOWED_IMAGE_TYPES[file.type];
  if (!extension) {
    throw new ValidationError("JPG, PNG, WebP, AVIF বা GIF ছবি আপলোড করা যাবে।");
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    throw new ValidationError("ছবিটি ৫ MB এর চেয়ে বড়। ছোট ছবি দিন।");
  }
  return extension;
}

export async function uploadStoreAsset(input: {
  actor: ActorContext;
  storeId: string;
  file: File;
  permission?: "catalog:write" | "design:write" | "settings:write";
}): Promise<{ assetId: string; url: string; sizeBytes: number }> {
  const { actor, storeId, file } = input;
  assertPermission(actor, input.permission ?? "catalog:write");
  await assertStoreAccess(actor, storeId);

  const snapshot = await requireWritableTenant(actor.tenantId);
  const extension = validateImage(file);
  assertStorageQuotaBytes(snapshot, file.size);

  const bytes = Buffer.from(await file.arrayBuffer());
  const checksum = createHash("sha256").update(bytes).digest("hex");
  const now = new Date();
  const key = `${storeId}/${now.getUTCFullYear()}/${now.getUTCMonth() + 1}/${randomUUID()}.${extension}`;

  const url = await putObject(key, bytes, file.type);
  try {
    const asset = await prisma.asset.create({
      data: {
        storeId,
        objectKey: key,
        url,
        mimeType: file.type,
        sizeBytes: bytes.byteLength,
        checksum,
        metadataJson: {
          originalName: file.name.slice(0, 200),
          uploadedBy: actor.userId,
        },
      },
    });
    invalidateEntitlements(actor.tenantId);
    return { assetId: asset.id, url, sizeBytes: asset.sizeBytes };
  } catch (error) {
    // Never leave an orphan object when the metadata write fails.
    await deleteObject(key);
    throw error;
  }
}

/**
 * Called after a product edit removes/replaces images. Objects are only deleted
 * when no current product image references the same URL, so a duplicated URL
 * cannot break another product.
 */
export async function deleteAssetsByUrls(storeId: string, urls: string[]): Promise<number> {
  const unique = [...new Set(urls.filter((url) => url.startsWith("/uploads/") || url.startsWith("http")))];
  if (unique.length === 0) return 0;

  const assets = await prisma.asset.findMany({
    where: { storeId, url: { in: unique } },
    select: { id: true, objectKey: true, url: true },
  });
  if (assets.length === 0) return 0;

  let removed = 0;
  for (const asset of assets) {
    if (!asset.url) continue;
    const stillUsed = await prisma.productImage.count({ where: { url: asset.url } });
    if (stillUsed > 0) continue;
    await deleteObject(asset.objectKey);
    await prisma.asset.delete({ where: { id: asset.id } }).catch(() => undefined);
    removed += 1;
  }
  return removed;
}

export async function listStoreAssets(storeId: string, limit = 50) {
  return prisma.asset.findMany({
    where: { storeId },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
}
