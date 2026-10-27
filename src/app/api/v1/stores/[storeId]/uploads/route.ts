import { type NextRequest } from "next/server";
import { z } from "zod";
import { ok, route } from "@/lib/api";
import { AppError, UnauthenticatedError } from "@/lib/errors";
import { readSession } from "@/lib/auth/session";
import { signAccessToken } from "@/lib/auth/tokens";

/**
 * Presign a product-image upload for the store the caller is logged into.
 *
 * The web has the session + store context, but the storage/authz logic lives in
 * the Nest API (`POST /api/storage/presign`). We sign a short-lived bearer for
 * the current user and forward; the API re-verifies the session and the caller's
 * membership in the store's tenant, so this route never trusts a storeId on its
 * own beyond what the API allows.
 */

const API_URL = process.env.API_INTERNAL_URL ?? "http://localhost:4000";

const uploadSchema = z.object({
  filename: z.string().min(1).max(160),
  contentType: z.enum(["image/jpeg", "image/png", "image/webp", "image/gif"]),
  size: z.number().int().min(1).max(5 * 1024 * 1024),
});

type Context = { params: Promise<{ storeId: string }> };

export const POST = route(async (request: NextRequest, context: Context) => {
  const { storeId } = await context.params;

  const session = await readSession();
  if (!session || !session.sessionId) throw new UnauthenticatedError();

  const body = uploadSchema.parse(await request.json());
  const token = await signAccessToken({ sub: session.user.id, sid: session.sessionId });

  let response: Response;
  try {
    response = await fetch(`${API_URL}/api/storage/presign`, {
      method: "POST",
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
      body: JSON.stringify({ storeId, ...body }),
      signal: AbortSignal.timeout(10_000),
    });
  } catch {
    throw new AppError(
      "SERVICE_UNAVAILABLE",
      "ইমেজ সার্ভিস চালু নেই। `npm run dev` (অথবা `npm run api:dev` ও `npm run s3:start`) চালান।",
      503,
    );
  }

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { message?: string } | null;
    throw new AppError(
      response.status === 503 ? "SERVICE_UNAVAILABLE" : "INTERNAL",
      payload?.message ?? "Upload URL could not be created",
      response.status,
    );
  }

  return ok(await response.json());
});
