/** @type {import('jest').Config} */
module.exports = {
  rootDir: ".",
  testEnvironment: "node",
  testMatch: ["<rootDir>/src/**/*.spec.ts", "<rootDir>/test/**/*.e2e-spec.ts"],
  transform: {
    "^.+\\.ts$": ["ts-jest", { tsconfig: "<rootDir>/tsconfig.json" }],
  },
  moduleFileExtensions: ["ts", "js", "json"],
  setupFiles: ["<rootDir>/test/setup-env.ts"],
  testTimeout: 30_000,
  clearMocks: true,
  collectCoverageFrom: ["src/**/*.ts", "!src/generated/**", "!src/main.ts", "!**/*.module.ts"],
};
