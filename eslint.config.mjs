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
      "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
    },
  },
  {
    // Legal/marketing copy is written in Bangla with typographic quotes; forcing
    // HTML entities there makes the source unreadable and serves no purpose.
    files: ["src/app/(marketing)/**/*.tsx"],
    rules: { "react/no-unescaped-entities": "off" },
  },
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "dist/**",
    "next-env.d.ts",
    // Prisma generates this on every `prisma generate`.
    "src/generated/**",
    // Legacy Create-App scaffold is not part of the current Next.js runtime.
    "client/**",
    "server/**",
    // The NestJS API is linted by its own flat config (`npm run api:lint`).
    "api/**",
    // Plain Node helper scripts (ESM) are executed, not bundled.
    "scripts/**",
  ]),
]);

export default eslintConfig;
