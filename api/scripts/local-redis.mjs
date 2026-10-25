/**
 * Local Redis helper for development (Windows).
 *
 * ATLaS uses BullMQ for background jobs, which needs Redis. Production points
 * REDIS_URL at a managed instance; locally we run the portable Windows build
 * unpacked at `%LOCALAPPDATA%\atlas-redis\Redis-*` (no admin rights, no Docker).
 *
 *   node scripts/local-redis.mjs start   # idempotent, daemonised
 *   node scripts/local-redis.mjs stop    # graceful shutdown (saves AOF)
 *   node scripts/local-redis.mjs status  # is the configured endpoint up?
 *
 * A remote REDIS_URL is never started or stopped. A missing local binary only
 * prints instructions — the API degrades to "queue disabled" instead of failing.
 */

import { existsSync, mkdirSync, readdirSync } from "node:fs";
import { spawn, spawnSync } from "node:child_process";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import net from "node:net";
import { config as loadDotenv } from "dotenv";

const here = dirname(fileURLToPath(import.meta.url));
loadDotenv({ path: resolve(here, "../../.env"), quiet: true });

const command = process.argv[2] ?? "start";
const rawUrl = process.env.REDIS_URL?.trim() ?? "";
const url = rawUrl || "redis://127.0.0.1:6379";

let target;
try {
  target = new URL(url);
} catch {
  console.error(`[redis] REDIS_URL is not a valid URL: ${url}`);
  process.exit(0);
}

const host = target.hostname.replace(/^\[|\]$/g, "");
const port = Number(target.port || 6379);
const isLocal = ["localhost", "127.0.0.1", "::1"].includes(host);
const binaryRoot = join(process.env.LOCALAPPDATA ?? "", "atlas-redis");
const dataDir = join(process.env.LOCALAPPDATA ?? "", "atlas-redis-data");

function findBinary(name) {
  if (!existsSync(binaryRoot)) return null;
  for (const entry of readdirSync(binaryRoot)) {
    const candidate = join(binaryRoot, entry, name);
    if (existsSync(candidate)) return candidate;
  }
  return null;
}

function probe() {
  return new Promise((resolveProbe) => {
    const socket = net.connect({ host, port });
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

  if (command === "status") {
    console.log(
      reachable
        ? `[redis] ${host}:${port} is up${rawUrl ? "" : " (REDIS_URL unset, using default)"}`
        : `[redis] ${host}:${port} is DOWN`,
    );
    process.exit(0);
  }

  if (command === "stop") {
    if (!isLocal) {
      console.log(`[redis] ${host}:${port} is remote — not stopping it.`);
      process.exit(0);
    }
    if (!reachable) {
      console.log("[redis] Not running.");
      process.exit(0);
    }
    const cli = findBinary("redis-cli.exe");
    if (!cli) {
      const pid = spawnSync("netstat", ["-ano"], { encoding: "utf8" })
        .stdout?.split(/\r?\n/)
        .find((line) => line.includes(`:${port}`) && line.includes("LISTENING"))
        ?.trim()
        .split(/\s+/)
        .pop();
      if (pid) {
        spawnSync("taskkill", ["/PID", pid, "/F"], { stdio: "inherit" });
        console.log(`[redis] Stopped PID ${pid}.`);
      } else {
        console.log("[redis] Could not find the listening process.");
      }
      process.exit(0);
    }
    spawnSync(cli, ["-h", host, "-p", String(port), "shutdown"], { stdio: "ignore" });
    console.log("[redis] Shutdown requested (data saved to AOF).");
    process.exit(0);
  }

  // start
  if (!isLocal) {
    console.log(`[redis] ${host}:${port} is remote — nothing to start.`);
    process.exit(0);
  }
  if (reachable) {
    console.log(`[redis] Already running on ${host}:${port}.`);
    process.exit(0);
  }

  const server = findBinary("redis-server.exe");
  if (!server) {
    console.log(
      "[redis] Local Redis binary not found. Download a Windows build from\n" +
        "        https://github.com/redis-windows/redis-windows/releases and unzip it to\n" +
        `        ${binaryRoot}\\Redis-<version>\\`,
    );
    process.exit(0);
  }

  mkdirSync(dataDir, { recursive: true });
  const logFile = join(dataDir, "redis.log").replace(/\\/g, "/");
  const child = spawn(
    server,
    [
      "--port", String(port),
      "--bind", host,
      "--dir", dataDir.replace(/\\/g, "/"),
      "--appendonly", "yes",
      "--save", "3600 1",
      "--logfile", logFile,
    ],
    { cwd: dirname(server), detached: true, stdio: "ignore" },
  );
  child.unref();

  const deadline = Date.now() + 10_000;
  let up = false;
  while (Date.now() < deadline && !up) {
    await new Promise((r) => setTimeout(r, 300));
    up = await probe();
  }

  console.log(
    up
      ? `[redis] Started on ${host}:${port} (data: ${dataDir}).`
      : `[redis] Failed to start — see ${logFile}`,
  );
  process.exit(0);
}

void main();
