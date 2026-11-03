import { type NextRequest } from "next/server";
import { ok, rateLimit, route } from "@/lib/api";
import { UnauthenticatedError, ValidationError } from "@/lib/errors";
import { assertPermission } from "@/lib/rbac";
import { getWorkspace } from "@/lib/tenant";
import { uploadStoreAsset } from "@/lib/services/storage-service";

/**
 * Merchant image upload (product photos).
 *
 * The route is deliberately thin: permission, tenant access, exact-byte storage
 * quota and the object write all live in `uploadStoreAsset`. Local disk is the
 * dev driver; production can switch to S3/R2 with env vars only.
 */

export const runtime = "nodejs";

export const POST = route(async (request: NextRequest) => {
  const workspace = await getWorkspace();
  if (!workspace) throw new UnauthenticatedError();
  assertPermission(workspace.actor, "catalog:write");
  rateLimit(`uploads:${workspace.actor.userId}`, 30);

  const formData = await request.formData();
  const file = formData.get("file");
  const storeId = String(formData.get("storeId") ?? "");
  if (!(file instanceof File)) {
    throw new ValidationError("কোনো ফাইল পাওয়া যায়নি।");
  }

  const asset = await uploadStoreAsset({
    actor: workspace.actor,
    storeId,
    file,
  });

  return ok({ url: asset.url, assetId: asset.assetId, sizeBytes: asset.sizeBytes }, { status: 201 });
});
