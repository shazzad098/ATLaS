/**
 * Dev-only helper: make sure the local database is up before `next dev`.
 *
 * ATLaS ships with Prisma's zero-install local Postgres (`prisma dev`) whose
 * data lives in %LOCALAPPDATA%\prisma-dev-nodejs. The server does not survive a
 * reboot or `prisma dev stop`, and when it is down every page that touches the
 * database dies with "Can't reach database server at 127.0.0.1:51214".
 *
 * This script probes DATABASE_URL first and only starts the local server when:
 *   - the URL points at localhost, and
 *   - nothing is listening on that port.
 * Remote/managed databases are never touched, and a failure here is not fatal —
 * the app still boots and shows the friendly error surface.
 */

import "dotenv/config";
import { execSync } from "node:child_process";
import net from "node:net";

const SERVER_NAME = "atlas";
const CONNECT_TIMEOUT_MS = 1_000;
const START_TIMEOUT_MS = 30_000;

function parseTarget() {
  const raw = process.env.DATABASE_URL;
  if (!raw) return null;
  try {
    const url = new URL(raw);
    const host = url.hostname.replace(/^\[|\]$/g, "");
    const port = Number(url.port || (url.protocol === "postgres:" ? 5432 : 0));
    if (!host || !port) return null;
    return { host, port };
  } catch {
    return null;
  }
}

function probe(host, port) {
  return new Promise((resolve) => {
    const socket = net.connect({ host, port });
    const done = (reachable) => {
      socket.destroy();
      resolve(reachable);
    };
    socket.setTimeout(CONNECT_TIMEOUT_MS);
    socket.once("connect", () => done(true));
    socket.once("timeout", () => done(false));
    socket.once("error", () => done(false));
  });
}

function startLocalServer() {
  // `prisma dev start` daemonises and returns as soon as the server is up, so
  // this does not block `next dev`. execSync + a fixed command keeps Windows
  // happy (npx is a .cmd shim there).
  execSync(`npx prisma dev start ${SERVER_NAME}`, { stdio: "inherit" });
}

const target = parseTarget();
if (!target) {
  console.log("[db] DATABASE_URL is missing or unparsable — skipping local database check.");
  process.exit(0);
}

const isLocal = ["localhost", "127.0.0.1", "::1"].includes(target.host);
if (!isLocal) {
  // Hosted Postgres: nothing to start, and we must not assume it is down.
  process.exit(0);
}

if (await probe(target.host, target.port)) {
  process.exit(0);
}

console.log(
  `[db] Nothing listening on ${target.host}:${target.port} — starting local Prisma Postgres (${SERVER_NAME})…`,
);

try {
  startLocalServer();
} catch {
  console.warn(
    `[db] Could not start the local server. Run \`npx prisma dev start ${SERVER_NAME}\` manually.`,
  );
  process.exit(0);
}

const deadline = Date.now() + START_TIMEOUT_MS;
let reachable = false;
while (Date.now() < deadline && !reachable) {
  await new Promise((resolve) => setTimeout(resolve, 500));
  reachable = await probe(target.host, target.port);
}

console.log(
  reachable
    ? `[db] Local Postgres ready on ${target.host}:${target.port}.`
    : `[db] Still unreachable after ${START_TIMEOUT_MS / 1000}s — the app will show a database hint.`,
);

// Never block `next dev`: the UI has a dedicated error surface for this.
process.exit(0);
