import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { config as loadDotenv } from "dotenv";

/**
 * Environment access for the API.
 *
 * The API lives in `api/` but shares the single `.env` at the repository root
 * (Next.js and the API must point at the same database, so two files would only
 * drift). `__dirname` differs between `nest start` (api/src) and the compiled
 * server (api/dist), so the file is located by walking up from here instead of
 * hard-coding a relative path.
 */

function findDotenv(start: string): string | null {
  let dir = resolve(start);
  for (let depth = 0; depth < 6; depth += 1) {
    const candidate = join(dir, ".env");
    if (existsSync(candidate)) return candidate;
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return null;
}

const envFile = findDotenv(__dirname);
if (envFile) {
  loadDotenv({ path: envFile, quiet: true });
}

export function optional(name: string, fallback = ""): string {
  return process.env[name]?.trim() || fallback;
}

export function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(
      `Missing required environment variable ${name}. Copy .env.example to .env at the repository root and fill it in.`,
    );
  }
  return value;
}

export function intFromEnv(name: string, fallback: number, min: number, max: number): number {
  const raw = process.env[name]?.trim();
  if (!raw) return fallback;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new Error(`Environment variable ${name} must be an integer between ${min} and ${max} (got "${raw}").`);
  }
  return value;
}

export function csvFromEnv(name: string, fallback: readonly string[]): string[] {
  const raw = process.env[name]?.trim();
  if (!raw) return [...fallback];
  return raw
    .split(",")
    .map((value) => value.trim())
    .filter((value) => value.length > 0);
}

export const apiEnv = {
  /** Port the HTTP server listens on. The Next.js app owns 3000. */
  port: intFromEnv("API_PORT", 4000, 1, 65_535),
  /** Browser origins allowed to call the API with credentials. */
  corsOrigins: csvFromEnv("API_ALLOWED_ORIGINS", ["http://localhost:3000"]),
  /** Which .env was loaded — logged once at boot so the wrong file is obvious. */
  envFile,
} as const;

/**
 * Auth settings are read lazily (getters) so importing this module never throws
 * during unit tests that only exercise unrelated code paths.
 *
 * AUTH_SECRET is shared with the Next.js app: both surfaces sign and verify the
 * same HS256 tokens (iss `atlas`, aud `atlas-app`), which lets a session created
 * by either one authenticate against the other.
 */
export const authEnv = {
  get secret(): string {
    return required("AUTH_SECRET");
  },
  /** Set to `.example.com` in production so API + web share the refresh cookie. */
  get cookieDomain(): string | undefined {
    return optional("AUTH_COOKIE_DOMAIN") || undefined;
  },
  get cookieSecure(): boolean {
    return process.env.NODE_ENV === "production";
  },
  /** OpenAPI UI is off by default in production (it documents internal surfaces). */
  get docsEnabled(): boolean {
    return process.env.NODE_ENV !== "production" || optional("API_DOCS_ENABLED") === "true";
  },
  /** Login brute-force budget (per source IP + identifier). */
  get loginMaxAttempts(): number {
    return intFromEnv("AUTH_LOGIN_MAX_ATTEMPTS", 8, 1, 10_000);
  },
  get loginWindowMs(): number {
    return intFromEnv("AUTH_LOGIN_WINDOW_MS", 15 * 60_000, 1_000, 24 * 60 * 60_000);
  },
} as const;

/** Optional error reporting. No DSN -> Sentry stays disabled (local dev). */
export const monitoringEnv = {
  get dsn(): string {
    return optional("SENTRY_DSN");
  },
  get environment(): string {
    return optional("SENTRY_ENVIRONMENT", process.env.NODE_ENV ?? "development");
  },
  get tracesSampleRate(): number {
    const raw = optional("SENTRY_TRACES_SAMPLE_RATE", "0.1");
    const value = Number(raw);
    return Number.isFinite(value) && value >= 0 && value <= 1 ? value : 0.1;
  },
} as const;

/** S3-compatible object storage (Cloudflare R2, AWS S3, MinIO). */
export const storageEnv = {
  get endpoint(): string {
    return optional("S3_ENDPOINT");
  },
  get region(): string {
    return optional("S3_REGION", "auto");
  },
  get bucket(): string {
    return optional("S3_BUCKET");
  },
  get accessKeyId(): string {
    return optional("S3_ACCESS_KEY_ID");
  },
  get secretAccessKey(): string {
    return optional("S3_SECRET_ACCESS_KEY");
  },
  /** Public base URL (R2 dev domain / CDN) used to build returned image URLs. */
  get publicBaseUrl(): string {
    return optional("S3_PUBLIC_BASE_URL");
  },
  get forcePathStyle(): boolean {
    return optional("S3_FORCE_PATH_STYLE", "false") === "true";
  },
  get configured(): boolean {
    return Boolean(
      this.endpoint && this.bucket && this.accessKeyId && this.secretAccessKey && this.publicBaseUrl,
    );
  },
} as const;

/**
 * Fail-fast checks for the API process. Production additionally requires the
 * pieces the product cannot run without: object storage for merchant images and
 * Redis for background jobs.
 */
export function assertApiRuntimeEnv(): void {
  const problems: string[] = [];

  if (!optional("DATABASE_URL")) problems.push("DATABASE_URL is required");

  const secret = optional("AUTH_SECRET");
  if (!secret) problems.push("AUTH_SECRET is required");
  else if (secret.length < 32) problems.push("AUTH_SECRET must be at least 32 characters");

  if (process.env.NODE_ENV === "production") {
    if (!storageEnv.configured) {
      problems.push(
        "S3_ENDPOINT/S3_BUCKET/S3_ACCESS_KEY_ID/S3_SECRET_ACCESS_KEY/S3_PUBLIC_BASE_URL are required for image uploads",
      );
    }
    if (!queueEnv.enabled) problems.push("REDIS_URL is required for background jobs");
  }

  if (problems.length > 0) {
    throw new Error(`Invalid API environment:\n - ${problems.join("\n - ")}`);
  }
}

/**
 * Background jobs (BullMQ) read Redis lazily too, so the API still boots when
 * Redis is down — enqueue attempts are logged and dropped instead of failing the
 * user's request. `QUEUE_ENABLED=false` turns the whole subsystem off.
 */
export const queueEnv = {
  get url(): string {
    return optional("REDIS_URL");
  },
  get enabled(): boolean {
    return optional("QUEUE_ENABLED", "true") !== "false" && Boolean(optional("REDIS_URL"));
  },
  get prefix(): string {
    return optional("QUEUE_PREFIX", "atlas");
  },
  get concurrency(): number {
    return intFromEnv("QUEUE_CONCURRENCY", 5, 1, 100);
  },
} as const;

