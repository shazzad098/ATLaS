// Prisma CLI configuration (Prisma 7).
// The CLI loads this file for every command, so environment variables must be
// pulled in explicitly (`dotenv` is not implicit in Prisma 7).
import "dotenv/config";
import { defineConfig, env } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    url: env("DATABASE_URL"),
  },
});
