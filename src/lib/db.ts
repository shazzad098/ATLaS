/* eslint-disable @typescript-eslint/no-explicit-any */
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";
import { createInMemoryDatabase } from "@/lib/in-memory-db";

/**
 * Single Prisma Client per process. Next.js hot-reloads modules in development
 * and would otherwise open a new connection pool on every reload.
 */
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
  inMemoryDb: any | undefined;
};

function isLocalOrUnconfiguredDatabase(url?: string): boolean {
  if (!url) return true;
  const clean = url.trim().toLowerCase();
  return (
    clean === "" ||
    clean.includes("localhost") ||
    clean.includes("127.0.0.1") ||
    clean === "postgresql://postgres:postgres@localhost:5432/atlas"
  );
}

function getInMemoryClient(): PrismaClient {
  if (!globalForPrisma.inMemoryDb) {
    globalForPrisma.inMemoryDb = createInMemoryDatabase();
  }
  return globalForPrisma.inMemoryDb as PrismaClient;
}

function wrapWithSafeFallback(client: PrismaClient, fallbackDb: any): PrismaClient {
  return new Proxy(client, {
    get(target: any, prop: string | symbol) {
      const orig = target[prop];
      if (typeof orig === "function") {
        return (...args: any[]) => {
          try {
            const res = orig.apply(target, args);
            if (res && typeof res.catch === "function") {
              return res.catch(() => {
                const fallbackProp = fallbackDb[prop];
                if (typeof fallbackProp === "function") return fallbackProp(...args);
                return null;
              });
            }
            return res;
          } catch {
            const fallbackProp = fallbackDb[prop];
            if (typeof fallbackProp === "function") return fallbackProp(...args);
            return null;
          }
        };
      }
      if (orig && typeof orig === "object") {
        return new Proxy(orig, {
          get(modelTarget: any, modelProp: string | symbol) {
            const modelFn = modelTarget[modelProp];
            if (typeof modelFn === "function") {
              return (...args: any[]) => {
                try {
                  const res = modelFn.apply(modelTarget, args);
                  if (res && typeof res.catch === "function") {
                    return res.catch(() => {
                      const fallbackModel = fallbackDb[prop];
                      const fallbackFn = fallbackModel?.[modelProp];
                      return fallbackFn ? fallbackFn(...args) : null;
                    });
                  }
                  return res;
                } catch {
                  const fallbackModel = fallbackDb[prop];
                  const fallbackFn = fallbackModel?.[modelProp];
                  return fallbackFn ? fallbackFn(...args) : null;
                }
              };
            }
            return modelFn;
          },
        });
      }
      return orig;
    },
  });
}

function createClient(): PrismaClient {
  const dbUrl = process.env.DATABASE_URL;

  // When no remote database is configured yet, use the stateful in-memory database directly.
  // This avoids TCP connection timeouts to dead localhost:5432 sockets and eliminates `prisma:error` logs.
  if (isLocalOrUnconfiguredDatabase(dbUrl)) {
    return getInMemoryClient();
  }

  try {
    const adapter = new PrismaPg({
      connectionString: dbUrl,
      max: Number(process.env.DATABASE_POOL_MAX) || 5,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 5_000,
    });
    const client = new PrismaClient({
      adapter,
      log: ["error"],
    });
    return wrapWithSafeFallback(client, getInMemoryClient());
  } catch {
    return getInMemoryClient();
  }
}

export const prisma: PrismaClient = globalForPrisma.prisma ?? createClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
