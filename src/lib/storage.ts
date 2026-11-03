import { createHash, createHmac } from "node:crypto";
import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { env } from "@/lib/env";

/**
 * Object storage abstraction (PRD §5.1 storage quota, §8.1 deployment).
 *
 * Local disk is the development default. Production can point at any
 * S3-compatible bucket (AWS S3, Cloudflare R2, Backblaze B2, MinIO) without an
 * SDK dependency — the requests are signed with SigV4 directly. Keeping this
 * behind `putObject`/`deleteObject` means the upload route never knows which
 * driver is active.
 */

export type StorageDriver = "local" | "s3";

function sha256(value: string | Buffer): string {
  return createHash("sha256").update(value).digest("hex");
}

function hmac(key: string | Buffer, value: string, encoding: "hex" | "base64" = "hex"): string {
  return createHmac("sha256", key).update(value).digest(encoding);
}

function signatureKey(secret: string, date: string, region: string): Buffer {
  const kDate = hmac(`AWS4${secret}`, date, "base64");
  const kRegion = hmac(Buffer.from(kDate, "base64"), region, "base64");
  const kService = hmac(Buffer.from(kRegion, "base64"), "s3", "base64");
  return Buffer.from(hmac(kService, "aws4_request", "base64"), "base64");
}

function requireS3() {
  const { endpoint, region, bucket, accessKeyId, secretAccessKey } = env.storage.s3;
  if (!endpoint || !bucket || !accessKeyId || !secretAccessKey) {
    throw new Error(
      "STORAGE_DRIVER=s3 requires S3_ENDPOINT, S3_BUCKET, S3_ACCESS_KEY_ID and S3_SECRET_ACCESS_KEY.",
    );
  }
  return { endpoint: endpoint.replace(/\/$/, ""), region, bucket, accessKeyId, secretAccessKey };
}

async function s3Request(
  method: "PUT" | "DELETE",
  key: string,
  body?: Buffer,
  contentType = "application/octet-stream",
): Promise<Response> {
  const config = requireS3();
  const url = new URL(`${config.endpoint}/${config.bucket}/${key}`);
  const now = new Date();
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, "");
  const dateStamp = amzDate.slice(0, 8);
  const payloadHash = sha256(body ?? Buffer.alloc(0));

  const canonicalHeaders = [
    `content-type:${contentType}`,
    `host:${url.host}`,
    `x-amz-content-sha256:${payloadHash}`,
    `x-amz-date:${amzDate}`,
    "",
  ].join("\n");
  const signedHeaders = "content-type;host;x-amz-content-sha256;x-amz-date";
  const canonicalRequest = [
    method,
    url.pathname,
    "",
    canonicalHeaders,
    signedHeaders,
    payloadHash,
  ].join("\n");

  const scope = `${dateStamp}/${config.region}/s3/aws4_request`;
  const stringToSign = [
    "AWS4-HMAC-SHA256",
    amzDate,
    scope,
    sha256(canonicalRequest),
  ].join("\n");
  const signature = hmac(signatureKey(config.secretAccessKey, dateStamp, config.region), stringToSign);

  const response = await fetch(url, {
    method,
    body: body ? new Uint8Array(body) : undefined,
    headers: {
      "content-type": contentType,
      "x-amz-content-sha256": payloadHash,
      "x-amz-date": amzDate,
      authorization: `AWS4-HMAC-SHA256 Credential=${config.accessKeyId}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}`,
    },
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`Object storage ${method} failed (${response.status}): ${detail.slice(0, 300)}`);
  }
  return response;
}

export function storageDriver(): StorageDriver {
  return env.storage.driver === "s3" ? "s3" : "local";
}

export function publicUrlFor(key: string): string {
  if (storageDriver() === "s3") {
    const config = requireS3();
    const base = env.storage.publicBaseUrl || `${config.endpoint}/${config.bucket}`;
    return `${base.replace(/\/$/, "")}/${key}`;
  }
  const base = env.storage.publicBaseUrl || "/uploads";
  return `${base.replace(/\/$/, "")}/${key}`;
}

/** Writes an object and returns its public URL. */
export async function putObject(
  key: string,
  bytes: Buffer,
  contentType: string,
): Promise<string> {
  if (!/^[a-zA-Z0-9/_\-.]+$/.test(key) || key.includes("..")) {
    throw new Error("Unsafe object key");
  }

  if (storageDriver() === "s3") {
    await s3Request("PUT", key, bytes, contentType);
    return publicUrlFor(key);
  }

  const root = path.resolve(process.cwd(), env.storage.uploadDir);
  const target = path.resolve(root, key);
  if (!target.startsWith(`${root}${path.sep}`)) throw new Error("Unsafe upload path");
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, bytes);
  return publicUrlFor(key);
}

/** Best-effort delete; a missing object is not an error. */
export async function deleteObject(key: string): Promise<void> {
  if (!/^[a-zA-Z0-9/_\-.]+$/.test(key) || key.includes("..")) return;

  if (storageDriver() === "s3") {
    try {
      await s3Request("DELETE", key);
    } catch {
      // Cleanup must never block the merchant's delete action.
    }
    return;
  }

  const root = path.resolve(process.cwd(), env.storage.uploadDir);
  const target = path.resolve(root, key);
  if (!target.startsWith(`${root}${path.sep}`)) return;
  await rm(target, { force: true }).catch(() => undefined);
}
