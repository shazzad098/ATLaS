/**
 * Node resolver hook that teaches the bare runtime the same specifier rules the
 * Next.js bundler applies:
 *
 *   `@/lib/foo`    → `src/lib/foo.ts`      (tsconfig `paths`)
 *   `@/lib/foo`    → `src/lib/foo/index.ts` (directory import)
 *   `next/headers` → `next/headers.js`     (extensionless package subpath)
 *
 * `node --experimental-strip-types` strips types but does not resolve aliases,
 * and ESM requires the exact file. Integration tests import the real service
 * modules, so both rules are needed to run them without a bundler.
 */

import { statSync } from "node:fs";
import { fileURLToPath } from "node:url";

const SRC_ROOT = new URL("../src/", import.meta.url);
const HAS_EXTENSION = /\.[cm]?[jt]sx?$|\.json$|\.node$/;

function isFile(url) {
  try {
    return statSync(fileURLToPath(url)).isFile();
  } catch {
    return false;
  }
}

function resolveAlias(specifier) {
  const base = new URL(specifier.slice(2), SRC_ROOT);
  // A bare directory is not importable in ESM, so only files are candidates;
  // directory imports fall through to the index.ts variants below.
  const candidates = [
    base,
    new URL(`${base.href}.ts`),
    new URL(`${base.href}.tsx`),
    new URL(`${base.href}/index.ts`),
    new URL(`${base.href}/index.tsx`),
  ];
  return candidates.find(isFile)?.href ?? null;
}

export async function resolve(specifier, context, nextResolve) {
  if (specifier.startsWith("@/")) {
    const target = resolveAlias(specifier);
    if (target) return nextResolve(target, context);
    return nextResolve(specifier, context);
  }

  try {
    return await nextResolve(specifier, context);
  } catch (error) {
    // `next/headers` style subpaths are extensionless in source but ship as .js.
    if (!specifier.startsWith("node:") && !HAS_EXTENSION.test(specifier)) {
      return nextResolve(`${specifier}.js`, context);
    }
    throw error;
  }
}
