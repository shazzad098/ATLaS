import "dotenv/config";
import { prisma } from "@/lib/db";
import { courierAdapterStatus } from "@/lib/couriers";
import { env } from "@/lib/env";
import { paymentAdapterStatus } from "@/lib/payments";

/**
 * Read-only deployment readiness probe.
 *
 *   npm run integrations:check
 *
 * It never calls a provider with credentials; it reports which integrations are
 * configured, which will run in sandbox mode, and which production-critical
 * values are missing. Exit code is non-zero only for critical production gaps.
 */

type Level = "ok" | "warn" | "fail";

type Row = { name: string; detail: string; level: Level };

function row(name: string, detail: string, level: Level = "ok"): Row {
  return { name, detail, level };
}

function safe(reader: () => boolean): boolean {
  try {
    return reader();
  } catch {
    return false;
  }
}

async function main() {
  const production = process.env.NODE_ENV === "production";
  const rows: Row[] = [];

  try {
    await prisma.$queryRaw`SELECT 1`;
    rows.push(row("Database", "reachable", "ok"));
  } catch (error) {
    rows.push(
      row("Database", error instanceof Error ? error.message.slice(0, 120) : "unreachable", "fail"),
    );
  }

  const authOk = safe(() => Boolean(env.authSecret));
  rows.push(row("AUTH_SECRET", authOk ? "set" : "missing", authOk ? "ok" : "fail"));

  const otpOk = safe(() => Boolean(env.otpHashSecret));
  rows.push(row("OTP_HASH_SECRET", otpOk ? "set" : "missing", otpOk ? "ok" : "fail"));

  const secretsConfigured = Boolean(process.env.SECRETS_KEY?.trim());
  rows.push(
    row(
      "SECRETS_KEY",
      secretsConfigured
        ? "set"
        : production
          ? "missing (encrypted gateway credentials need it)"
          : "dev fallback in use",
      secretsConfigured ? "ok" : production ? "fail" : "warn",
    ),
  );

  const cronOk = Boolean(env.cronSecret);
  rows.push(
    row(
      "CRON_SECRET",
      cronOk ? "set" : "missing (cron endpoints are disabled outside dev)",
      cronOk ? "ok" : production ? "fail" : "warn",
    ),
  );

  const smsOk = safe(() => env.sms.configured);
  rows.push(
    row(
      "SMS / OTP delivery",
      smsOk
        ? `${env.sms.provider || "custom"} configured`
        : "not configured — development logs the code; production fails closed",
      smsOk ? "ok" : production ? "fail" : "warn",
    ),
  );
  if (smsOk) {
    const url = env.sms.baseUrl;
    if (url && !url.startsWith("https://") && env.sms.provider !== "twilio") {
      rows.push(row("SMS endpoint", "not HTTPS — credentials and OTP would travel in clear text", "fail"));
    }
  }

  const emailOk = safe(() => env.email.configured);
  rows.push(
    row(
      "Email",
      emailOk ? `${env.email.provider} configured` : "not configured — sandbox/no-op",
      emailOk ? "ok" : "warn",
    ),
  );

  const payments = paymentAdapterStatus();
  const livePayments = payments.filter((provider) => provider.configured && provider.provider !== "COD");
  rows.push(
    row(
      "Payment gateways",
      livePayments.length > 0
        ? `${livePayments.map((provider) => provider.label).join(", ")} live`
        : "COD only / gateways in sandbox",
      livePayments.length > 0 ? "ok" : "warn",
    ),
  );

  const couriers = courierAdapterStatus();
  const liveCouriers = couriers.filter((provider) => provider.mode === "live" && provider.configured);
  rows.push(
    row(
      "Courier providers",
      liveCouriers.length > 0
        ? `${liveCouriers.map((provider) => provider.label).join(", ")} live`
        : `sandbox (mode=${env.courier.mode})`,
      liveCouriers.length > 0 ? "ok" : "warn",
    ),
  );

  const webhookOk = Boolean(env.courier.webhookSecret);
  rows.push(
    row(
      "Courier webhook secret",
      webhookOk ? "set" : "missing — unsigned webhooks are dev-only",
      webhookOk ? "ok" : production ? "fail" : "warn",
    ),
  );

  rows.push(
    row(
      "Storage",
      env.storage.driver === "s3"
        ? env.storage.s3.configured
          ? "s3 configured"
          : "s3 selected but credentials incomplete"
        : `local (${env.storage.uploadDir})`,
      env.storage.driver === "s3" && !env.storage.s3.configured ? "fail" : "ok",
    ),
  );

  const width = Math.max(...rows.map((entry) => entry.name.length));
  for (const entry of rows) {
    const marker = entry.level === "ok" ? "OK  " : entry.level === "warn" ? "WARN" : "FAIL";
    console.log(`${marker}  ${entry.name.padEnd(width)}  ${entry.detail}`);
  }

  const failures = rows.filter((entry) => entry.level === "fail");
  if (failures.length > 0) {
    console.error(`\n${failures.length} critical integration problem(s) found.`);
    process.exitCode = 1;
  } else {
    console.log("\nNo critical integration gaps.");
  }

  await prisma.$disconnect();
}

main().catch(async (error) => {
  console.error(error);
  await prisma.$disconnect().catch(() => undefined);
  process.exitCode = 1;
});
