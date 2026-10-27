/**
 * One-command local development.
 *
 *   npm run dev
 *
 * Starts the database, the local S3-compatible server (product images), the
 * Nest API (used by the upload presign route) and the Next.js web app. A
 * separately running API is detected and reused instead of starting a second
 * process on port 4000.
 */

import "dotenv/config";
import { execFileSync, spawn, spawnSync } from "node:child_process";
import net from "node:net";

const root = process.cwd();
const isWindows = process.platform === "win32";
const children = new Set();
let shuttingDown = false;

function probe(host, port) {
  return new Promise((resolve) => {
    const socket = net.connect({ host, port });
    const done = (reachable) => {
      socket.destroy();
      resolve(reachable);
    };
    socket.setTimeout(800);
    socket.once("connect", () => done(true));
    socket.once("timeout", () => done(false));
    socket.once("error", () => done(false));
  });
}

function apiTarget() {
  try {
    const url = new URL(process.env.API_INTERNAL_URL ?? "http://localhost:4000");
    return {
      host: url.hostname.replace(/^\[|\]$/g, ""),
      port: Number(url.port || 4000),
    };
  } catch {
    return { host: "127.0.0.1", port: 4000 };
  }
}

function start(label, commandLine) {
  const child = spawn(commandLine, {
    cwd: root,
    env: process.env,
    shell: true,
    stdio: "inherit",
  });
  children.add(child);
  child.on("exit", (code) => children.delete(child));
  child.on("error", (error) => console.error(`[dev] ${label}: ${error.message}`));
  return child;
}

function stop(child) {
  if (!child || child.killed) return;
  if (isWindows) {
    spawnSync("taskkill", ["/pid", String(child.pid), "/T", "/F"], { stdio: "ignore" });
  } else {
    child.kill("SIGTERM");
  }
}

function shutdown(code = 0) {
  if (shuttingDown) return;
  shuttingDown = true;
  for (const child of children) stop(child);
  process.exit(code);
}

process.on("SIGINT", () => shutdown(0));
process.on("SIGTERM", () => shutdown(0));

// 1. Database (idempotent; remote databases are left alone).
execFileSync(process.execPath, ["scripts/ensure-db.mjs"], { cwd: root, stdio: "inherit" });

// 2. Local S3 (product uploads).
execFileSync(process.execPath, ["./api/scripts/local-s3.mjs", "start"], {
  cwd: root,
  stdio: "inherit",
});

// 3. Nest API. Reuse an already-running instance (common when the developer
//    starts `npm run api:dev` in a second terminal).
const target = apiTarget();
if (await probe(target.host, target.port)) {
  console.log(`[dev] API already running on ${target.host}:${target.port}.`);
} else {
  console.log(`[dev] Starting API on ${target.host}:${target.port}…`);
  start("api", "npm --prefix api run dev");
}

// 4. Next.js web app (foreground).
const web = start("web", "npm run dev:web");
web.on("exit", (code) => shutdown(code ?? 0));
