/**
 * Child process: run s3rver and ensure the bucket exists.
 * Kept separate so `local-s3.mjs` can daemonise it with a clean stdio.
 */
import { readFile } from "node:fs/promises";
import S3rver from "s3rver";

const port = Number(process.argv[2] ?? 9000);
const directory = process.argv[3];
const bucket = process.argv[4] ?? "atlas";

const server = new S3rver({
  port,
  address: "127.0.0.1",
  directory,
  silent: true,
  // Local dev: accept well-formed presigned URLs without a matching secret.
  allowMismatchedSignatures: true,
});

await server.run();

// s3rver does not auto-create buckets; create the app bucket once.
try {
  const res = await fetch(`http://127.0.0.1:${port}/${bucket}`, {
    method: "PUT",
    headers: { "Content-Length": "0" },
  });
  if (!res.ok && res.status !== 409) console.error(`[s3] bucket create -> ${res.status}`);
} catch {
  // A race with another start is harmless.
}

// Browsers PUT directly to the presigned URL, so the bucket needs a CORS rule
// (otherwise Chromium blocks the upload after a 403 preflight).
try {
  const cors = await readFile(new URL("./s3-cors.xml", import.meta.url), "utf8");
  const res = await fetch(`http://127.0.0.1:${port}/${bucket}?cors`, {
    method: "PUT",
    headers: { "Content-Type": "application/xml" },
    body: cors,
  });
  if (!res.ok) console.error(`[s3] bucket CORS -> ${res.status}`);
} catch (error) {
  console.error(`[s3] bucket CORS failed: ${error instanceof Error ? error.message : String(error)}`);
}

// Keep the process alive until killed.
await new Promise(() => {});
