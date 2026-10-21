import { z } from "zod";
import { prisma } from "@/lib/db";
import { AppError, ConflictError, NotFoundError } from "@/lib/errors";
import { assertPermission, type ActorContext } from "@/lib/rbac";
import { assertStoreAccess } from "@/lib/tenant";
import { assertCustomDomain, loadEntitlementSnapshot } from "@/lib/entitlements";
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

  const snapshot = await loadEntitlementSnapshot(actor.tenantId);
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

  const domain = await prisma.domain.findFirst({ where: { id: domainId, storeId } });
  if (!domain) throw new NotFoundError("Domain");
  if (domain.type !== "CUSTOM") return domain;
  if (!domain.verificationToken) throw new NotFoundError("Verification token");

  const sandboxHost =
    domain.host.endsWith(".localhost") ||
    /\.(test|example|invalid|local)$/.test(domain.host);

  let verified = sandboxHost;
  if (!verified) {
    verified = await hasVerificationRecord(domain.host, domain.verificationToken);
  }

  if (!verified) {
    await prisma.domain.update({
      where: { id: domain.id },
      data: { verificationStatus: "FAILED" },
    });
    throw new AppError(
      "VALIDATION_FAILED",
      `TXT record এখনো পাওয়া যায়নি। ${verificationRecordName(domain.host)} → ${verificationRecordValue(domain.verificationToken)} যোগ করে আবার চেষ্টা করুন।`,
      422,
      {
        record: {
          name: verificationRecordName(domain.host),
          value: verificationRecordValue(domain.verificationToken),
        },
      },
    );
  }

  const updated = await prisma.domain.update({
    where: { id: domain.id },
    data: {
      verificationStatus: "ACTIVE",
      tlsStatus: "ACTIVE",
      verifiedAt: new Date(),
    },
  });

  await recordAudit({
    action: "domain.verified",
    tenantId: actor.tenantId,
    actorId: actor.userId,
    resourceType: "Domain",
    resourceId: domain.id,
    metadata: { storeId, host: domain.host, sandbox: sandboxHost },
  });

  return updated;
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

  const domain = await prisma.domain.findFirst({ where: { id: domainId, storeId } });
  if (!domain) throw new NotFoundError("Domain");
  if (domain.verificationStatus !== "ACTIVE") {
    throw new AppError("VALIDATION_FAILED", "শুধু verified domain-ই primary করা যায়।", 422);
  }

  await prisma.$transaction([
    prisma.domain.updateMany({ where: { storeId }, data: { isPrimary: false } }),
    prisma.domain.update({ where: { id: domain.id }, data: { isPrimary: true } }),
  ]);

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
