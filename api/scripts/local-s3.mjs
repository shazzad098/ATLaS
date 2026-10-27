/**
 * Local S3-compatible server for development.
 *
 * MinIO stopped publishing free Windows binaries (dl.min.io now returns 410),
 * so we run `s3rver` — a Node S3-compatible server — instead. Production points
 * the same S3_* variables at Cloudflare R2 / AWS S3; nothing here changes.
 *
 *   node scripts/local-s3.mjs start   # idempotent, daemonised, creates bucket
 *   node scripts/local-s3.mjs stop
 */

import { existsSync, mkdirSync, readdirSync } from "node:fs";
import { spawn } from "node:child_process";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import net from "node:net";

const here = dirname(fileURLToPath(import.meta.url));

const PORT = Number(process.env.S3_LOCAL_PORT ?? 9000);
const HOST = "127.0.0.1";
const BUCKET = process.env.S3_BUCKET ?? "atlas";
const dataDir = join(process.env.LOCALAPPDATA ?? "", "atlas-s3");
const command = process.argv[2] ?? "start";

function probe() {
  return new Promise((resolveProbe) => {
    const socket = net.connect({ host: HOST, port: PORT });
    const done = (reachable) => {
      socket.destroy();
      resolveProbe(reachable);
    };
    socket.setTimeout(1_000);
    socket.once("connect", () => done(true));
    socket.once("timeout", () => done(false));
    socket.once("error", () => done(false));
  });
}

async function main() {
  const reachable = await probe();

  if (command === "stop") {
    if (!reachable) {
      console.log("[s3] Not running.");
      process.exit(0);
    }
    // s3rver owns no CLI; kill whatever listens on the port.
    const { execSync } = await import("node:child_process");
    const pid = execSync(`netstat -ano | findstr LISTENING | findstr :${PORT}`)
      .toString()
      .split(/\r?\n/)[0]
      ?.trim()
      .split(/\s+/)
      .pop();
    if (pid) {
      spawn("taskkill", ["/PID", pid, "/F"], { stdio: "ignore" });
      console.log(`[s3] Stopped PID ${pid}.`);
    }
    process.exit(0);
  }

  if (reachable) {
    console.log(`[s3] Already running on ${HOST}:${PORT}.`);
    process.exit(0);
  }

  mkdirSync(dataDir, { recursive: true });
  const child = spawn(
    process.execPath,
    [join(here, "run-s3rver.mjs"), String(PORT), dataDir, BUCKET],
    { cwd: here, detached: true, stdio: "ignore" },
  );
  child.unref();

  const deadline = Date.now() + 10_000;
  let up = false;
  while (Date.now() < deadline && !up) {
    await new Promise((r) => setTimeout(r, 300));
    up = await probe();
  }

  console.log(up ? `[s3] Started on ${HOST}:${PORT} (bucket=${BUCKET}, data=${dataDir}).` : "[s3] Failed to start.");
  process.exit(0);
}

void main();
