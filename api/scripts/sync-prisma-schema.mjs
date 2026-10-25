/**
 * Keeps the API's Prisma schema in sync with the single source of truth at
 * `../prisma/schema.prisma`.
 *
 * Why a copy instead of importing the root schema? Prisma resolves the client
 * `output` path relative to the schema file, and TypeScript needs the generated
 * client inside `api/` so `nest build` can keep `rootDir: src` (importing the
 * Next.js copy would drag `.tsx` files into the API build).
 *
 * Both files sit at `<package>/prisma/schema.prisma`, so the relative `output`
 * ("../src/generated/prisma") resolves correctly without rewriting.
 *
 * Run automatically by `npm install` (postinstall) and before generate/dev/build.
 */

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const apiRoot = join(here, "..");
const source = join(apiRoot, "..", "prisma", "schema.prisma");
const target = join(apiRoot, "prisma", "schema.prisma");

const header = `// ---------------------------------------------------------------------------
// GENERATED FILE — do not edit.
// Source of truth: ../prisma/schema.prisma (edit that one, then run
// \`npm run db:sync\` in api/, or any of the db:* / build / dev scripts).
// ---------------------------------------------------------------------------

`;

const schema = readFileSync(source, "utf8");
mkdirSync(dirname(target), { recursive: true });
writeFileSync(target, header + schema, "utf8");
console.log(`[prisma] synced ${source} -> ${target}`);
