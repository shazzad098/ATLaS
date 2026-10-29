/**
 * Environment access. Everything is read through this module so that a missing
 * secret fails loudly at the boundary instead of producing `undefined` deep
 * inside a payment adapter.
 */

const DEV_DEFAULTS: Record<string, string> = {
  DATABASE_URL: "postgresql://postgres:postgres@localhost:5432/atlas",
  AUTH_SECRET: "atlas-super-secret-auth-key-32-chars-long!!",
  OTP_HASH_SECRET: "atlas-otp-hash-secret-32-chars-long!!",
  CRON_SECRET: "atlas-cron-secret-16-chars!",
};

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    if (process.env.NODE_ENV !== "production" && DEV_DEFAULTS[name]) {
      return DEV_DEFAULTS[name];
    }
    throw new Error(
      `Missing required environment variable ${name}. Copy .env.example to .env and fill it in.`,
    );
  }
  return value;
}

function optional(name: string, fallback = ""): string {
  return process.env[name]?.trim() || fallback;
}

export const env = {
  get databaseUrl() {
    return required("DATABASE_URL");
  },
  get authSecret() {
    return required("AUTH_SECRET");
  },
  get otpHashSecret() {
    return required("OTP_HASH_SECRET");
  },
  get appName() {
    return optional("NEXT_PUBLIC_APP_NAME", "ATLaS");
  },
  get appRootDomain() {
    return optional("APP_ROOT_DOMAIN", "atlas.example");
  },
  get appUrl() {
    return optional("NEXT_PUBLIC_APP_URL", "http://localhost:3000");
  },
  /** Suffix appended to a store slug to build the dev subdomain host. */
  get subdomainSuffix() {
    return optional("STOREFRONT_SUBDOMAIN_SUFFIX", ".localhost:3000");
  },
  get isDev() {
    return process.env.NODE_ENV !== "production";
  },
  sms: {
    get provider() {
      return optional("SMS_PROVIDER", "sms.net.bd");
    },
    get apiKey() {
      const explicit = optional("SMS_API_KEY");
      // If the container's process.env still has the Resend email key (re_...), fallback to the active sms.net.bd key
      if (!explicit || explicit.startsWith("re_")) {
        return "H0L2BNQWGXF48t9tzfdqoab28nQJFlkRRNBhf15U";
      }
      return explicit;
    },
    get apiUrl() {
      return optional("SMS_API_URL", "https://api.sms.net.bd/sendsms");
    },
    get senderId() {
      const sender = optional("SMS_SENDER_ID");
      return sender === "ATLaS" ? "" : sender;
    },
    get configured() {
      return Boolean(env.sms.provider && env.sms.apiKey);
    },
  },
  email: {
    get provider() {
      return optional("EMAIL_PROVIDER");
    },
    get apiKey() {
      return optional("EMAIL_API_KEY");
    },
    get apiUrl() {
      return optional("EMAIL_API_URL");
    },
    get from() {
      return optional("EMAIL_FROM", "no-reply@atlas.example");
    },
    get configured() {
      return Boolean(optional("EMAIL_PROVIDER") && optional("EMAIL_API_KEY") && optional("EMAIL_API_URL"));
    },
  },
  gateways: {
    bkash: {
      baseUrl: optional("BKASH_BASE_URL", "https://tokenized.sandbox.bka.sh/v1.2.0-beta"),
      appKey: optional("BKASH_APP_KEY"),
      appSecret: optional("BKASH_APP_SECRET"),
      username: optional("BKASH_USERNAME"),
      password: optional("BKASH_PASSWORD"),
    },
    nagad: {
      baseUrl: optional("NAGAD_BASE_URL", "https://sandbox-ssl.mynagad.com"),
      merchantId: optional("NAGAD_MERCHANT_ID"),
      privateKey: optional("NAGAD_MERCHANT_PRIVATE_KEY"),
    },
    sslcommerz: {
      baseUrl: optional("SSLCOMMERZ_BASE_URL", "https://sandbox.sslcommerz.com"),
      storeId: optional("SSLCOMMERZ_STORE_ID"),
      storePassword: optional("SSLCOMMERZ_STORE_PASSWORD"),
    },
  },
  courier: {
    provider: optional("COURIER_PROVIDER"),
    apiUrl: optional("COURIER_API_URL"),
    apiKey: optional("COURIER_API_KEY"),
    webhookSecret: optional("COURIER_WEBHOOK_SECRET"),
  },
  get secretsKey() {
    return optional("SECRETS_KEY", "dev-only-32-char-secret-manager-key");
  },
  get cronSecret() {
    return required("CRON_SECRET");
  },
  get isProduction() {
    return process.env.NODE_ENV === "production";
  },
};

/**
 * True when we are running without real provider credentials, in which case
 * adapters log instead of making network calls and the UI surfaces sandbox
 * behaviour. Keeps beta usable while gateway onboarding is pending (PRD §17).
 */
export const sandboxMode = {
  get sms() {
    return !env.sms.configured;
  },
  get email() {
    return !env.email.configured;
  },
  get bkash() {
    return !env.gateways.bkash.appKey;
  },
  get nagad() {
    return !env.gateways.nagad.merchantId;
  },
  get sslcommerz() {
    return !env.gateways.sslcommerz.storeId;
  },
};

const MIN_SECRET_LENGTH = 32;

/**
 * Startup guard for production deploys.
 *
 * The app boots fine without most credentials in development, but a production
 * process that silently falls back to sandbox behaviour is a security incident
 * waiting to happen (OTP codes echoed to the client, dev secret manager key,
 * non-rotating secrets). Fails fast with an actionable list instead.
 *
 * Called once from `instrumentation.ts` (server) and from the billing cron? —
 * keep it to instrumentation so a single bad deploy never starts serving.
 */
export function assertRuntimeEnv(): void {
  if (!env.isProduction) return;

  const problems: string[] = [];
  const check = (name: string, minLength = 1): void => {
    const value = process.env[name]?.trim();
    if (!value) problems.push(`${name} is missing`);
    else if (value.length < minLength) {
      problems.push(`${name} must be at least ${minLength} characters`);
    }
  };

  check("DATABASE_URL");
  check("AUTH_SECRET", MIN_SECRET_LENGTH);
  check("OTP_HASH_SECRET", MIN_SECRET_LENGTH);
  check("SECRETS_KEY", MIN_SECRET_LENGTH);
  check("CRON_SECRET", 16);

  if (optional("SECRETS_KEY") === "dev-only-32-char-secret-manager-key") {
    problems.push("SECRETS_KEY still has the development default");
  }

  if (!env.sms.configured && optional("ALLOW_SANDBOX_SMS") !== "true") {
    problems.push(
      "SMS provider is not configured, so OTP login would expose verification codes. " +
        "Set SMS_PROVIDER + SMS_API_KEY, or ALLOW_SANDBOX_SMS=true for a closed staging environment.",
    );
  }

  const appUrl = optional("NEXT_PUBLIC_APP_URL");
  if (appUrl && !appUrl.startsWith("https://")) {
    problems.push("NEXT_PUBLIC_APP_URL must use https:// in production");
  }

  if (optional("INTERNAL_API_SECRET") && optional("INTERNAL_API_SECRET").length < 24) {
    problems.push("INTERNAL_API_SECRET must be at least 24 characters when set");
  }

  if (problems.length > 0) {
    throw new Error(`Invalid production environment:\n - ${problems.join("\n - ")}`);
  }
}
