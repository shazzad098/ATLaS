import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { config as loadDotenv } from "dotenv";
import { defineConfig, env } from "prisma/config";

/**
 * Prisma CLI configuration for the API package (Prisma 7 needs it explicitly).
 *
 * The schema is a generated copy of `../prisma/schema.prisma` and the migration
 * history is shared with the Next.js app, so there is exactly one source of
 * truth for the database. `.env` lives at the repository root; it is located by
 * walking up from the working directory so the commands work from either
 * `api/` or the repo root.
 */

function findDotenv(start: string): string | null {
  let dir = resolve(start);
  for (let depth = 0; depth < 6; depth += 1) {
    const candidate = join(dir, ".env");
    if (existsSync(candidate)) return candidate;
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return null;
}

const envFile = findDotenv(process.cwd());
if (envFile) {
  loadDotenv({ path: envFile, quiet: true });
}

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "../prisma/migrations",
  },
  datasource: {
    url: env("DATABASE_URL"),
  },
});
