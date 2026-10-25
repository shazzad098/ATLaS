import eslint from "@eslint/js";
import { defineConfig, globalIgnores } from "eslint/config";
import tseslint from "typescript-eslint";

/**
 * API lint config. NestJS leans on decorators and parameter properties, so the
 * recommended non type-checked ruleset is enough here; `npm run typecheck`
 * enforces the strict-mode guarantees instead.
 */
export default defineConfig([
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["**/*.ts"],
    languageOptions: {
      parserOptions: {
        projectService: false,
      },
    },
    rules: {
      // Nest modules and DTOs declare parameter properties / empty classes on purpose.
      "@typescript-eslint/no-extraneous-class": "off",
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_", caughtErrorsIgnorePattern: "^_" },
      ],
      "no-console": ["warn", { allow: ["error", "warn"] }],
    },
  },
  globalIgnores(["dist/**", "node_modules/**", "coverage/**", "src/generated/**"]),
]);
