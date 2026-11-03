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
  /** CNAME target merchants point custom domains at (edge/proxy host). */
  get domainCnameTarget() {
    return optional("DOMAIN_CNAME_TARGET", `edge.${optional("APP_ROOT_DOMAIN", "atlas.example")}`);
  },
  sms: {
    get provider() {
      return optional("SMS_PROVIDER").toLowerCase();
    },
    get apiKey() {
      return optional("SMS_API_KEY");
    },
    get baseUrl() {
      return optional("SMS_API_URL");
    },
    /** Twilio: `SMS_ACCOUNT_SID`; SSLWireless: `SMS_SENDER_ID` is the sid. */
    get accountSid() {
      return optional("SMS_ACCOUNT_SID");
    },
    get authToken() {
      return optional("SMS_AUTH_TOKEN");
    },
    get senderId() {
      return optional("SMS_SENDER_ID", "ATLaS");
    },
    get configured() {
      const provider = optional("SMS_PROVIDER").toLowerCase();
      if (!provider) return false;
      if (provider === "twilio") {
        return Boolean(optional("SMS_ACCOUNT_SID") && optional("SMS_AUTH_TOKEN"));
      }
      if (provider === "generic") return Boolean(optional("SMS_API_URL"));
      return Boolean(optional("SMS_API_KEY"));
    },
  },
  email: {
    get provider() {
      return optional("EMAIL_PROVIDER").toLowerCase();
    },
    get apiKey() {
      return optional("EMAIL_API_KEY");
    },
    get baseUrl() {
      return optional("EMAIL_API_URL");
    },
    get from() {
      return optional("EMAIL_FROM", "no-reply@atlas.example");
    },
    get fromName() {
      return optional("EMAIL_FROM_NAME", "ATLaS");
    },
    get configured() {
      const provider = optional("EMAIL_PROVIDER").toLowerCase();
      if (!provider) return false;
      if (provider === "generic") return Boolean(optional("EMAIL_API_URL"));
      return Boolean(optional("EMAIL_API_KEY"));
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
    /** `auto` (default) picks live when a provider has credentials, else sandbox. */
    get mode() {
      return optional("COURIER_MODE", "auto");
    },
    get webhookSecret() {
      return optional("COURIER_WEBHOOK_SECRET");
    },
    pathao: {
      baseUrl: optional("PATHAO_BASE_URL", "https://api-hermes.pathao.com"),
      clientId: optional("PATHAO_CLIENT_ID"),
      clientSecret: optional("PATHAO_CLIENT_SECRET"),
      username: optional("PATHAO_USERNAME"),
      password: optional("PATHAO_PASSWORD"),
      /** Pathao needs numeric city/zone ids; these defaults target Dhaka. */
      defaultCityId: optional("PATHAO_DEFAULT_CITY_ID", "1"),
      defaultZoneId: optional("PATHAO_DEFAULT_ZONE_ID", "1"),
      get configured() {
        return Boolean(
          optional("PATHAO_CLIENT_ID") &&
            optional("PATHAO_CLIENT_SECRET") &&
            optional("PATHAO_USERNAME") &&
            optional("PATHAO_PASSWORD"),
        );
      },
    },
    redx: {
      baseUrl: optional("REDX_BASE_URL", "https://openapi.redx.com.bd"),
      apiToken: optional("REDX_API_TOKEN"),
      /** RedX requires a numeric delivery area id; set it before going live. */
      defaultAreaId: optional("REDX_DEFAULT_AREA_ID"),
      get configured() {
        return Boolean(optional("REDX_API_TOKEN") && optional("REDX_DEFAULT_AREA_ID"));
      },
    },
    steadfast: {
      baseUrl: optional("STEADFAST_BASE_URL", "https://portal.packzy.com/api/v1"),
      apiKey: optional("STEADFAST_API_KEY"),
      secretKey: optional("STEADFAST_SECRET_KEY"),
      get configured() {
        return Boolean(optional("STEADFAST_API_KEY") && optional("STEADFAST_SECRET_KEY"));
      },
    },
  },
  storage: {
    /** `local` writes under `UPLOAD_DIR`; `s3` uses any S3-compatible endpoint. */
    get driver() {
      return optional("STORAGE_DRIVER", "local") as "local" | "s3";
    },
    get uploadDir() {
      return optional("UPLOAD_DIR", "public/uploads");
    },
    get publicBaseUrl() {
      return optional("STORAGE_PUBLIC_BASE_URL");
    },
    s3: {
      get endpoint() {
        return optional("S3_ENDPOINT");
      },
      get region() {
        return optional("S3_REGION", "us-east-1");
      },
      get bucket() {
        return optional("S3_BUCKET");
      },
      get accessKeyId() {
        return optional("S3_ACCESS_KEY_ID");
      },
      get secretAccessKey() {
        return optional("S3_SECRET_ACCESS_KEY");
      },
      get configured() {
        return Boolean(
          optional("S3_ENDPOINT") &&
            optional("S3_BUCKET") &&
            optional("S3_ACCESS_KEY_ID") &&
            optional("S3_SECRET_ACCESS_KEY"),
        );
      },
    },
  },
  get secretsKey() {
    const value = optional("SECRETS_KEY");
    if (value) {
      if (value.length < 16) {
        throw new Error("SECRETS_KEY must be at least 16 characters of high-entropy material.");
      }
      return value;
    }
    // Never fall back to a known key in production: that would make
    // "encrypted" gateway credentials readable by anyone with the repo.
    if (process.env.NODE_ENV === "production") {
      throw new Error(
        "SECRETS_KEY is required in production. Set a 32+ character random value in the deployment secret manager.",
      );
    }
    return "dev-only-32-char-secret-manager-key";
  },
  get isProduction() {
    return process.env.NODE_ENV === "production";
  },
  /** Shared secret for `/api/cron/*`. Required outside development. */
  get cronSecret() {
    return optional("CRON_SECRET");
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
