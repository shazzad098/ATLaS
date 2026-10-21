import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      // Merchant imagery lives on arbitrary object-storage hosts, so the MVP
      // renders raw <img> tags instead of routing every thumbnail through the
      // Next image optimiser (which would need sharp + a fetch per variant).
      "@next/next/no-img-element": "off",
    },
  },
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Prisma generates this on every `prisma generate`.
    "src/generated/**",
    // Leftover Manus/Vite starter trees. `tsconfig.json` already excludes them
    // and nothing under `src/` imports them, so linting them only reports on
    // code that never runs.
    "client/**",
    "server/**",
    "shared/**",
    "drizzle/**",
    "vite.config.ts",
    "vite.config.ts.bak",
  ]),
]);

export default eslintConfig;
