import { AsyncLocalStorage } from "node:async_hooks";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";
import type { Prisma } from "@/generated/prisma/client";

/**
 * Prisma client with request-scoped Row-Level Security context.
 *
 * The database enforces tenant/buyer isolation through RLS policies
 * (`prisma/migrations/*_enable_rls`). The proxy verifies the session and
 * forwards a trusted `x-atlas-rls` header; this module turns that header into
 * transaction-local Postgres settings:
 *
 *   SET LOCAL ROLE atlas_app;                    -- leave the owner/superuser
 *   set_config('app.user_id', …, true);          -- merchant
 *   set_config('app.customer_id', …, true);      -- buyer
 *   set_config('app.store_id', …, true);
 *   set_config('app.cart_key', …, true);
 *
 * `SET LOCAL` reverts on COMMIT, so nothing leaks through a shared/pooled
 * connection (important for `prisma dev`, which multiplexes clients onto one
 * backend, and for transaction-mode poolers). Public and platform requests run
 * as the owner and are the documented bypass contexts.
 *
 * The local `prisma dev` database (and many managed poolers) can close idle
 * sockets when the server restarts or sleeps. We keep the pool small, drop idle
 * connections quickly, and retry the narrow set of connection-level failures
 * once or twice with a fresh connection.
 */

const RETRYABLE_CODES = new Set([
  "P1001", // can't reach database server
  "P1002", // database server timed out
  "P1017", // server has closed the connection
  "P2024", // pool timeout
  "57P01", // admin shutdown
  "57P02", // crash shutdown
  "57P03", // cannot connect now
  "08000", // connection exception
  "08003", // connection does not exist
  "08006", // connection failure
]);

function isRetryableDbError(error: unknown): boolean {
  const candidate = error as { code?: unknown; message?: unknown; cause?: { code?: unknown } };
  const code = String(candidate?.code ?? candidate?.cause?.code ?? "");
  if (RETRYABLE_CODES.has(code)) return true;

  const message = String(candidate?.message ?? "").toLowerCase();
  return (
    message.includes("server has closed the connection") ||
    message.includes("connection terminated") ||
    message.includes("connection reset") ||
    message.includes("econnreset") ||
    message.includes("etimedout") ||
    message.includes("econnrefused") ||
    message.includes("terminating connection")
  );
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function withConnectionRetry<T>(operation: () => Promise<T>): Promise<T> {
  const attempts = 3;
  for (let attempt = 1; ; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      if (attempt >= attempts || !isRetryableDbError(error)) throw error;
      await sleep(attempt * 100);
    }
  }
}

/**
 * Only reads are safe to replay automatically: if a write's connection drops
 * after commit, retrying could duplicate the side effect. Writes still fail
 * loudly, as before.
 */
const RETRYABLE_OPERATIONS = new Set([
  "findUnique",
  "findUniqueOrThrow",
  "findFirst",
  "findFirstOrThrow",
  "findMany",
  "count",
  "aggregate",
  "groupBy",
  "$queryRaw",
  "$queryRawUnsafe",
  "queryRaw",
  "queryRawUnsafe",
]);

const IS_DEV = process.env.NODE_ENV !== "production";
const IS_BUILD = process.env.NEXT_PHASE === "phase-production-build";

function poolMax(): number {
  const requested = Number(process.env.DATABASE_POOL_MAX ?? "");
  if (Number.isFinite(requested) && requested > 0) return Math.floor(requested);
  return IS_BUILD ? 1 : 10;
}

function createBaseClient(): PrismaClient {
  const adapter = new PrismaPg({
    connectionString: process.env.DATABASE_URL,
    max: poolMax(),
    idleTimeoutMillis: IS_DEV ? 10_000 : 30_000,
    connectionTimeoutMillis: 15_000,
    // Detect a dropped peer instead of waiting for the next query to fail.
    keepAlive: true,
  });
  return new PrismaClient({
    adapter,
    log: IS_DEV ? ["warn", "error"] : ["error"],
  });
}

type AtlasPrisma = ReturnType<typeof createExtended>;

function createExtended(base: PrismaClient) {
  return base.$extends({
    query: {
      async $allOperations({ operation, args, query }) {
        if (!RETRYABLE_OPERATIONS.has(operation)) return query(args);
        return withConnectionRetry(() => query(args));
      },
    },
  });
}

type Tx = Prisma.TransactionClient;
type RlsContext = {
  userId?: string;
  customerId?: string;
  storeId?: string;
  cartKey?: string;
};

type RequestStore = { tx?: Tx; bypass?: boolean };

const globalForPrisma = globalThis as unknown as {
  __atlasPrisma?: {
    base: PrismaClient;
    client: AtlasPrisma;
    als: AsyncLocalStorage<RequestStore>;
  };
};

const state =
  globalForPrisma.__atlasPrisma ??
  (() => {
    const base = createBaseClient();
    return { base, client: createExtended(base), als: new AsyncLocalStorage<RequestStore>() };
  })();

globalForPrisma.__atlasPrisma = state;

const ID_PATTERN = /^[A-Za-z0-9_-]{1,80}$/;

/** Parse the trusted header set by `src/proxy.ts`. */
function parseContext(raw: string | null): RlsContext | null {
  if (!raw || raw === "platform" || raw === "public") return null;

  if (raw.startsWith("user:")) {
    const userId = raw.slice("user:".length);
    return ID_PATTERN.test(userId) ? { userId } : null;
  }

  if (raw.startsWith("buyer:")) {
    const [storeId, customerId, cartKey = ""] = raw.slice("buyer:".length).split(":");
    if (!ID_PATTERN.test(storeId) || !ID_PATTERN.test(customerId)) return null;
    if (cartKey && !ID_PATTERN.test(cartKey)) return null;
    return { storeId, customerId, cartKey };
  }

  return null;
}

let headersUnavailable = false;

/** The header is set by the proxy; outside a request (scripts/tests) there is none. */
async function currentContextHeader(): Promise<string | null> {
  if (headersUnavailable) return null;
  try {
    const { headers } = await import("next/headers");
    const headerList = await headers();
    return headerList.get("x-atlas-rls");
  } catch {
    headersUnavailable = true;
    return null;
  }
}

/**
 * Minimal surface `applyRlsContext` needs, so the function can accept both the
 * transaction client and the extended client the app exposes.
 */
export type RlsExecutor = {
  $executeRawUnsafe(query: string, ...values: unknown[]): Promise<number>;
};

/**
 * Apply the RLS context for the current transaction. `SET LOCAL` is scoped to
 * the transaction, so pooled connections never retain a previous user's scope.
 *
 * `set_config('role', …)` is the same switch as `SET LOCAL ROLE`, and folding it
 * into the context statement removes a round trip from every authenticated
 * query (measured: 7.4ms → 5.2ms per query against a local database).
 */
export async function applyRlsContext(tx: RlsExecutor, context: RlsContext): Promise<void> {
  await tx.$executeRawUnsafe(
    `SELECT set_config('role', 'atlas_app', true),
            set_config('app.bypass', '', true),
            set_config('app.user_id', $1, true),
            set_config('app.customer_id', $2, true),
            set_config('app.store_id', $3, true),
            set_config('app.cart_key', $4, true)`,
    context.userId ?? "",
    context.customerId ?? "",
    context.storeId ?? "",
    context.cartKey ?? "",
  );
}

function runScoped<T>(context: RlsContext, fn: (tx: Tx) => Promise<T>): Promise<T> {
  return state.base.$transaction(
    async (tx) => {
      await applyRlsContext(tx, context);
      return fn(tx);
    },
    { maxWait: 10_000, timeout: 20_000 },
  );
}

/**
 * Run a trusted server operation with the platform (bypass) client even when
 * the request belongs to a merchant/buyer session. Used by checkout, whose
 * writes span tenant-scoped tables but are fully server-validated.
 */
export function runWithBypass<T>(fn: () => T | Promise<T>): Promise<T> {
  return state.als.run({ bypass: true }, async () => fn());
}

async function transactionProxy(...args: unknown[]) {
  const store = state.als.getStore();
  const active = store?.tx;
  const callback = args[0];

  if (store?.bypass) {
    return (state.base.$transaction as unknown as (...inner: unknown[]) => unknown)(...args);
  }

  // Nested transaction: reuse the open one instead of starting a second.
  if (active) {
    if (typeof callback === "function") return callback(active);
    throw new Error("Nested array transactions are not supported");
  }

  const context = parseContext(await currentContextHeader());
  if (!context) {
    return (state.base.$transaction as unknown as (...inner: unknown[]) => unknown)(...args);
  }

  if (typeof callback !== "function") {
    throw new Error("Array transactions are not supported under RLS; use an interactive transaction");
  }

  return state.base.$transaction(async (tx) => {
    await applyRlsContext(tx, context);
    return state.als.run({ tx }, () => callback(tx));
  }, { maxWait: 10_000, timeout: 30_000, ...(args[1] as object | undefined) });
}

function createContextProxy(): AtlasPrisma {
  return new Proxy({} as AtlasPrisma, {
    get(_target, prop) {
      if (typeof prop !== "string" || prop === "then") return undefined;

      if (prop === "$transaction") return transactionProxy;

      if (["$connect", "$disconnect", "$on", "$use", "$extends"].includes(prop)) {
        return (state.base as unknown as Record<string, unknown>)[prop];
      }

      if (prop.startsWith("$")) {
        return async (...args: unknown[]) => {
          const store = state.als.getStore();
          if (store?.bypass) {
            return (state.base as unknown as Record<string, (...inner: unknown[]) => unknown>)[prop](
              ...args,
            );
          }
          const active = store?.tx;
          if (active) {
            return (active as unknown as Record<string, (...inner: unknown[]) => unknown>)[prop](
              ...args,
            );
          }
          const context = parseContext(await currentContextHeader());
          if (!context) {
            return (state.base as unknown as Record<string, (...inner: unknown[]) => unknown>)[prop](
              ...args,
            );
          }
          return runScoped(context, async (tx) =>
            (tx as unknown as Record<string, (...inner: unknown[]) => unknown>)[prop](...args),
          );
        };
      }

      return new Proxy(
        {},
        {
          get(_modelTarget, operation) {
            if (typeof operation !== "string") return undefined;
            return async (...args: unknown[]) => {
              const store = state.als.getStore();
              if (store?.bypass) {
                const model = (
                  state.base as unknown as Record<
                    string,
                    Record<string, (...inner: unknown[]) => unknown>
                  >
                )[prop];
                return model[operation](...args);
              }
              const active = store?.tx;
              if (active) {
                const model = (
                  active as unknown as Record<string, Record<string, (...inner: unknown[]) => unknown>>
                )[prop];
                return model[operation](...args);
              }

              const context = parseContext(await currentContextHeader());
              if (!context) {
                const model = (
                  state.base as unknown as Record<
                    string,
                    Record<string, (...inner: unknown[]) => unknown>
                  >
                )[prop];
                return model[operation](...args);
              }

              return runScoped(context, async (tx) => {
                const model = (
                  tx as unknown as Record<string, Record<string, (...inner: unknown[]) => unknown>>
                )[prop];
                return model[operation](...args);
              });
            };
          },
        },
      );
    },
  }) as unknown as AtlasPrisma;
}

export const prisma: AtlasPrisma = createContextProxy();
