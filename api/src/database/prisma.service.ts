import { Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from "@nestjs/common";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client";
import { intFromEnv, required } from "../config/env";

/**
 * Single Prisma client for the API process.
 *
 * Prisma 7 talks to Postgres through a driver adapter, so the pool is created
 * here rather than by the Rust engine. The pool is intentionally small: the API
 * and the Next.js app share one database, and each Next.js worker keeps its own
 * pool of five.
 */
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  constructor() {
    super({
      adapter: new PrismaPg({
        connectionString: required("DATABASE_URL"),
        max: intFromEnv("DATABASE_POOL_MAX", 5, 1, 100),
        idleTimeoutMillis: 30_000,
        connectionTimeoutMillis: 15_000,
      }),
    });
  }

  async onModuleInit(): Promise<void> {
    await this.$connect();
    this.logger.log("Connected to PostgreSQL");
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
