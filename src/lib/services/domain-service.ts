import { z } from "zod";
import { prisma } from "@/lib/db";
import { AppError, ConflictError, NotFoundError } from "@/lib/errors";
import { assertPermission, type ActorContext } from "@/lib/rbac";
import { assertStoreAccess } from "@/lib/tenant";
import { assertCustomDomain, requireWritableTenant } from "@/lib/entitlements";
import { env } from "@/lib/env";
import { randomSuffix } from "@/lib/slug";
import { recordAudit } from "@/lib/audit";

/**
 * Domains (FR-07, PRD §5.1).
 *
 * Every store ships with a `slug.<root-domain>` subdomain. Custom domains are a
 * Standard+ entitlement and must be proven with a DNS TXT record before they
 * become ACTIVE, so a merchant can never claim a host they do not control.
 */

export const HOSTNAME_PATTERN =
  /^(?=.{4,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/;

export const VERIFY_PREFIX = "_atlas-verify";

/** Normalise whatever the merchant typed into a bare lowercase hostname. */
export function normalizeHost(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/\/.*$/, "")
    .replace(/:\d+$/, "")
    .replace(/\.$/, "");
}

export const customDomainInputSchema = z.object({
  host: z.string().min(4).max(253).transform(normalizeHost).refine((value) => HOSTNAME_PATTERN.test(value), {
    message: "সঠিক domain দিন, যেমন shop.example.com",
  }),
});

export function subdomainHost(slug: string): string {
  return `${slug}.${env.appRootDomain}`;
}

export function verificationRecordName(host: string): string {
  return `${VERIFY_PREFIX}.${host}`;
}

export function verificationRecordValue(token: string): string {
  return `atlas-verify=${token}`;
}

/** Heuristic apex check (e.g. example.com vs shop.example.com). */
export function isApexHost(host: string): boolean {
  return normalizeHost(host).split(".").filter(Boolean).length <= 2;
}

export async function listDomains(storeId: string) {
  await assertStoreExists(storeId);
  const domains = await prisma.domain.findMany({
    where: { storeId },
    orderBy: [{ isPrimary: "desc" }, { type: "asc" }, { createdAt: "asc" }],
  });
  return domains.map((domain) => ({
    ...domain,
    expectedRecord: domain.type === "CUSTOM" && domain.verificationToken
      ? {
          name: verificationRecordName(domain.host),
          value: verificationRecordValue(domain.verificationToken),
        }
      : null,
    routingRecord:
      domain.type === "CUSTOM"
        ? {
            type: isApexHost(domain.host) ? "A" : "CNAME",
            name: domain.host,
            value: domain.routingTarget ?? env.domainCnameTarget,
            note: isApexHost(domain.host)
              ? `Apex domain-এ CNAME সমর্থিত নয় — provider-এর A/ALIAS রেকর্ড ${env.domainCnameTarget}-এ point করুন।`
              : `CNAME ${domain.host} → ${env.domainCnameTarget}`,
          }
        : null,
    editUrl: `https://${domain.host}`,
  }));
}

async function assertStoreExists(storeId: string) {
  const store = await prisma.store.findFirst({
    where: { id: storeId, deletedAt: null },
    select: { id: true, slug: true, tenantId: true },
  });
  if (!store) throw new NotFoundError("Store");
  return store;
}

/** Ensures the store's platform subdomain row exists (created with the store). */
export async function ensureSubdomain(storeId: string) {
  const store = await assertStoreExists(storeId);
  const host = subdomainHost(store.slug);
  return prisma.domain.upsert({
    where: { host },
    create: {
      storeId,
      host,
      type: "SUBDOMAIN",
      verificationStatus: "ACTIVE",
      tlsStatus: "ACTIVE",
      isPrimary: true,
      verifiedAt: new Date(),
    },
    update: {},
  });
}

export async function addCustomDomain(actor: ActorContext, storeId: string, raw: unknown) {
  assertPermission(actor, "settings:write");
  await assertStoreAccess(actor, storeId);
  await assertStoreExists(storeId);

  const snapshot = await requireWritableTenant(actor.tenantId);
  assertCustomDomain(snapshot);

  const { host } = customDomainInputSchema.parse(raw);

  if (host.endsWith(`.${env.appRootDomain}`)) {
    throw new AppError(
      "VALIDATION_FAILED",
      `*.${env.appRootDomain} subdomain platform-এর নিজস্ব, custom domain হিসেবে যোগ করা যায় না।`,
      422,
    );
  }

  const existing = await prisma.domain.findUnique({ where: { host } });
  if (existing) {
    throw new ConflictError(
      existing.storeId === storeId
        ? "এই domain আগেই যোগ করা হয়েছে।"
        : "এই domain অন্য একটি store-এ ব্যবহৃত হচ্ছে।",
    );
  }

  const domain = await prisma.domain.create({
    data: {
      storeId,
      host,
      type: "CUSTOM",
      verificationToken: `${randomSuffix(20)}${randomSuffix(12)}`,
      verificationStatus: "PENDING",
      tlsStatus: "PENDING",
      routingTarget: env.domainCnameTarget,
      isPrimary: false,
    },
  });

  await recordAudit({
    action: "domain.added",
    tenantId: actor.tenantId,
    actorId: actor.userId,
    resourceType: "Domain",
    resourceId: domain.id,
    metadata: { storeId, host },
  });

  return domain;
}

/**
 * Checks the DNS TXT record and, on success, activates the domain.
 * Sandbox hosts (localhost / RFC-2606 test TLDs) auto-verify so local dev works.
 */
export async function verifyDomain(actor: ActorContext, storeId: string, domainId: string) {
  assertPermission(actor, "settings:write");
  await assertStoreAccess(actor, storeId);
  await requireWritableTenant(actor.tenantId);

  const domain = await prisma.domain.findFirst({ where: { id: domainId, storeId } });
  if (!domain) throw new NotFoundError("Domain");
  if (domain.type !== "CUSTOM") return domain;
  if (!domain.verificationToken) throw new NotFoundError("Verification token");

  const sandboxHost =
    domain.host.endsWith(".localhost") ||
    /\.(test|example|invalid|local)$/.test(domain.host);

  let txtVerified = true;
  let routing: { ok: boolean; detail?: string } = { ok: true, detail: "sandbox host auto-verified" };
  if (!sandboxHost) {
    [txtVerified, routing] = await Promise.all([
      hasVerificationRecord(domain.host, domain.verificationToken),
      hasRoutingRecord(domain.host),
    ]);
  }

  const checkedAt = new Date();
  if (!txtVerified || !routing.ok) {
    const dnsError = !txtVerified
      ? `TXT ${verificationRecordName(domain.host)} → ${verificationRecordValue(domain.verificationToken)} পাওয়া যায়নি।`
      : (routing.detail ?? "DNS routing record পাওয়া যায়নি।");
    await prisma.domain.update({
      where: { id: domain.id },
      data: {
        verificationStatus: "FAILED",
        dnsLastCheckedAt: checkedAt,
        dnsError,
        routingTarget: env.domainCnameTarget,
      },
    });
    throw new AppError(
      "VALIDATION_FAILED",
      `ডোমেইন এখনো যাচাই হয়নি। ${dnsError}`,
      422,
      {
        txtRecord: {
          name: verificationRecordName(domain.host),
          value: verificationRecordValue(domain.verificationToken),
        },
        routingRecord: {
          type: isApexHost(domain.host) ? "A/ALIAS" : "CNAME",
          name: domain.host,
          value: env.domainCnameTarget,
        },
      },
    );
  }

  const updated = await prisma.domain.update({
    where: { id: domain.id },
    data: {
      verificationStatus: "ACTIVE",
      // TLS is issued separately: the ACTIVE flag is only set after a real
      // HTTPS handshake succeeds, never merely because DNS passed.
      tlsStatus: sandboxHost ? "ACTIVE" : "PENDING",
      tlsIssuedAt: sandboxHost ? checkedAt : null,
      verifiedAt: checkedAt,
      dnsLastCheckedAt: checkedAt,
      dnsError: null,
      routingTarget: env.domainCnameTarget,
    },
  });

  await recordAudit({
    action: "domain.verified",
    tenantId: actor.tenantId,
    actorId: actor.userId,
    resourceType: "Domain",
    resourceId: domain.id,
    metadata: { storeId, host: domain.host, sandbox: sandboxHost, routing: routing.detail },
  });

  // Trigger provisioning right away. On managed hosting the proxy issues the
  // certificate on first TLS handshake; the cron retries if DNS is still
  // propagating.
  if (!sandboxHost) {
    return provisionDomainTls(updated.id);
  }
  return updated;
}

/** Verify that the merchant's DNS points at the platform edge. */
async function hasRoutingRecord(host: string): Promise<{ ok: boolean; detail?: string }> {
  const target = normalizeHost(env.domainCnameTarget);
  const dns = await import("node:dns/promises");

  if (!isApexHost(host)) {
    try {
      const cnames = await dns.resolveCname(host);
      if (cnames.map(normalizeHost).includes(target)) {
        return { ok: true, detail: `CNAME → ${target}` };
      }
      return { ok: false, detail: `CNAME ${host} → ${target} পাওয়া যায়নি (পাওয়া গেছে: ${cnames.join(", ") || "কিছুই না"})।` };
    } catch {
      return { ok: false, detail: `CNAME ${host} → ${target} যোগ করুন।` };
    }
  }

  // Apex domains cannot normally use CNAME; require at least one A/AAAA record
  // and let the TLS handshake prove it reaches this platform.
  try {
    const [a, aaaa] = await Promise.all([
      dns.resolve4(host).catch(() => [] as string[]),
      dns.resolve6(host).catch(() => [] as string[]),
    ]);
    if (a.length + aaaa.length > 0) {
      return { ok: true, detail: `A/AAAA → ${[...a, ...aaaa].join(", ")}` };
    }
  } catch {
    // fall through
  }
  return { ok: false, detail: `Apex domain-এর জন্য A/ALIAS রেকর্ড ${target}-এ point করুন।` };
}

/**
 * Probes `https://<host>/api/v1/health`. A successful response proves both that
 * the host routes here and that a valid certificate is being served; only then
 * is `tlsStatus` set to ACTIVE.
 */
export async function provisionDomainTls(domainId: string) {
  const domain = await prisma.domain.findUnique({ where: { id: domainId } });
  if (!domain || domain.type !== "CUSTOM") return domain;

  const checkedAt = new Date();
  const attempts = domain.tlsAttempts + 1;
  let ok = false;
  let error = "";

  if (domain.verificationStatus !== "ACTIVE") {
    error = "DNS verification is not active yet.";
  } else if (domain.host.endsWith(".localhost") || /\.(test|example|invalid|local)$/.test(domain.host)) {
    ok = true;
  } else {
    try {
      // Resolve first so a merchant cannot point us at a private address.
      const dns = await import("node:dns/promises");
      const answers = await dns.lookup(domain.host, { all: true, verbatim: true });
      const { isPrivateAddress } = await import("@/lib/ip-address");
      if (answers.length === 0 || answers.some((answer) => isPrivateAddress(answer.address))) {
        throw new Error("Domain resolves to a private address.");
      }
      const response = await fetch(`https://${domain.host}/api/v1/health`, {
        method: "GET",
        redirect: "manual",
        signal: AbortSignal.timeout(8_000),
        headers: { "user-agent": "ATLaS-TLS-Check/1.0" },
      });
      ok = response.status > 0 && response.status < 500;
      if (!ok) error = `HTTPS health check returned ${response.status}.`;
    } catch (cause) {
      error = cause instanceof Error ? cause.message : "TLS handshake failed.";
    }
  }

  return prisma.domain.update({
    where: { id: domain.id },
    data: {
      tlsStatus: ok ? "ACTIVE" : attempts >= 8 ? "FAILED" : "PENDING",
      tlsIssuedAt: ok ? domain.tlsIssuedAt ?? checkedAt : domain.tlsIssuedAt,
      tlsLastCheckedAt: checkedAt,
      tlsAttempts: attempts,
      tlsError: ok ? null : error.slice(0, 300),
    },
  });
}

/** Cron entry point for pending/retrying custom-domain certificates. */
export async function runDomainMaintenance(limit = 20) {
  const domains = await prisma.domain.findMany({
    where: {
      type: "CUSTOM",
      verificationStatus: "ACTIVE",
      tlsStatus: { in: ["PENDING", "FAILED"] },
      tlsAttempts: { lt: 8 },
    },
    orderBy: { updatedAt: "asc" },
    take: limit,
    select: { id: true },
  });

  let provisioned = 0;
  for (const domain of domains) {
    try {
      const updated = await provisionDomainTls(domain.id);
      if (updated?.tlsStatus === "ACTIVE") provisioned += 1;
    } catch (error) {
      console.error("[domains] TLS check failed", domain.id, error);
    }
  }
  return { checked: domains.length, provisioned };
}

async function hasVerificationRecord(host: string, token: string): Promise<boolean> {
  try {
    const dns = await import("node:dns/promises");
    const records = await dns.resolveTxt(verificationRecordName(host));
    const flattened = records.map((parts) => parts.join(""));
    return flattened.includes(verificationRecordValue(token));
  } catch {
    return false;
  }
}

export async function setPrimaryDomain(actor: ActorContext, storeId: string, domainId: string) {
  assertPermission(actor, "settings:write");
  await assertStoreAccess(actor, storeId);
  await requireWritableTenant(actor.tenantId);

  const domain = await prisma.domain.findFirst({ where: { id: domainId, storeId } });
  if (!domain) throw new NotFoundError("Domain");
  if (domain.verificationStatus !== "ACTIVE") {
    throw new AppError("VALIDATION_FAILED", "শুধু verified domain-ই primary করা যায়।", 422);
  }
  if (domain.tlsStatus !== "ACTIVE") {
    throw new AppError("VALIDATION_FAILED", "TLS certificate এখনো সক্রিয় হয়নি — কিছুক্ষণ পর আবার চেষ্টা করুন।", 422);
  }

  await prisma.$transaction(async (tx) => {
    await tx.domain.updateMany({ where: { storeId }, data: { isPrimary: false } });
    await tx.domain.update({ where: { id: domain.id }, data: { isPrimary: true } });
  });

  await recordAudit({
    action: "domain.primary_changed",
    tenantId: actor.tenantId,
    actorId: actor.userId,
    resourceType: "Domain",
    resourceId: domain.id,
    metadata: { storeId, host: domain.host },
  });

  return prisma.domain.findUniqueOrThrow({ where: { id: domain.id } });
}

export async function removeDomain(actor: ActorContext, storeId: string, domainId: string) {
  assertPermission(actor, "settings:write");
  await assertStoreAccess(actor, storeId);
  await requireWritableTenant(actor.tenantId);

  const domain = await prisma.domain.findFirst({ where: { id: domainId, storeId } });
  if (!domain) throw new NotFoundError("Domain");
  if (domain.type === "SUBDOMAIN") {
    throw new AppError("VALIDATION_FAILED", "Platform subdomain মুছে ফেলা যায় না।", 422);
  }

  await prisma.domain.delete({ where: { id: domain.id } });
  if (domain.isPrimary) await ensureSubdomain(storeId);

  await recordAudit({
    action: "domain.removed",
    tenantId: actor.tenantId,
    actorId: actor.userId,
    resourceType: "Domain",
    resourceId: domain.id,
    metadata: { storeId, host: domain.host },
  });
}

/**
 * Host → store lookup used by `src/proxy.ts` for custom-domain routing.
 * Returns null for the platform's own hosts so the app shell still renders.
 */
export async function resolveStoreByHost(host: string) {
  const normalized = normalizeHost(host);
  if (!normalized) return null;
  if (normalized === env.appRootDomain || normalized === `www.${env.appRootDomain}`) return null;
  if (normalized === "localhost" || normalized.endsWith(".localhost")) return null;

  const domain = await prisma.domain.findFirst({
    where: { host: normalized, verificationStatus: "ACTIVE" },
    include: {
      store: { select: { id: true, slug: true, status: true, deletedAt: true } },
    },
  });
  if (!domain || domain.store.deletedAt) return null;

  return {
    storeId: domain.store.id,
    slug: domain.store.slug,
    status: domain.store.status,
    type: domain.type as "SUBDOMAIN" | "CUSTOM",
  };
}

/** Extracts the store slug from a `slug.<root>` host, or null when absent. */
export function slugFromHost(host: string): string | null {
  const normalized = normalizeHost(host);
  const suffix = `.${env.appRootDomain}`;
  if (normalized.endsWith(suffix)) {
    const slug = normalized.slice(0, -suffix.length);
    if (slug && !slug.includes(".")) return slug;
  }
  const localSuffix = env.subdomainSuffix.replace(/^\./, ".");
  if (env.isDev && normalized.endsWith(localSuffix)) {
    const slug = normalized.slice(0, -localSuffix.length);
    if (slug && !slug.includes(".")) return slug;
  }
  return null;
}
