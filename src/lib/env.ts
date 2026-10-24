/**
 * Environment access. Everything is read through this module so that a missing
 * secret fails loudly at the boundary instead of producing `undefined` deep
 * inside a payment adapter.
 */

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
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
      return optional("SMS_PROVIDER");
    },
    get apiKey() {
      return optional("SMS_API_KEY");
    },
    get apiUrl() {
      return optional("SMS_API_URL");
    },
    get senderId() {
      return optional("SMS_SENDER_ID", "ATLaS");
    },
    get configured() {
      return Boolean(optional("SMS_PROVIDER") && optional("SMS_API_KEY") && optional("SMS_API_URL"));
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
