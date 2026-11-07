/**
 * Registers the `@/*` path-alias resolver for plain Node runs.
 *
 *   node --import ./scripts/register-ts-paths.mjs --experimental-strip-types ...
 *
 * Used by `npm test` / `npm run test:db` so the integration suite can import
 * the real service modules (`@/lib/services/...`) without a bundler.
 */

import { register } from "node:module";

register("./ts-paths-resolver.mjs", import.meta.url);
