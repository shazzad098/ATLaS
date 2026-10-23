import dns from "node:dns/promises";
import { and, eq, ne } from "drizzle-orm";
import { db } from "../db";
import { domains } from "../../drizzle/schema";
import { ROOT_STORE_DOMAIN } from "../../shared/domain";
import { fail } from "../lib/core";
import { randomToken } from "../lib/crypto";
import { assertFeature } from "./billing";
import { enqueue, registerJob } from "./jobs";
import { audit, notifyTenant } from "./ops";
import { clearStoreCache } from "./stores";
import { requirePerm, requireWrite, type TenantScope } from "./tenancy";

const HOST_RE = /^(?=.{4,253}$)(?!-)(?:[a-z0-9-]{1,63}\.)+[a-z]{2,63}$/;
export const EDGE_TARGET = `edge.${ROOT_STORE_DOMAIN}`;

export async function listDomains(scope: TenantScope) {
  requirePerm(scope, "settings.manage");
  const rows = await db().select().from(domains).where(eq(domains.storeId, scope.storeId));
  const customAllowed = scope.ent.limits.customDomain;
  return {
    domains: rows.map(d => ({
      ...d,
      effectiveStatus: d.type === "custom" && !customAllowed && d.verificationStatus !== "failed" ? ("suspended" as const) : d.verificationStatus,
      instructions:
        d.type === "custom"
          ? {
              txt: { name: `_atlas-verify.${d.host}`, value: `atlas-verify=${d.verificationToken}` },
              cname: { name: d.host, value: EDGE_TARGET },
            }
          : null,
    })),
    customAllowed,
    subdomainAlongside: scope.ent.limits.customDomainWithSubdomain,
  };
}

export async function addCustomDomain(scope: TenantScope, rawHost: string, actorId: number) {
  requireWrite(scope, "settings.manage");
  assertFeature(scope.ent.limits.customDomain, "Custom domain", "standard");
  const host = rawHost.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "");
  if (!HOST_RE.test(host)) fail("VALIDATION", "Enter a valid domain like shop.example.com");
  if (host.endsWith(ROOT_STORE_DOMAIN)) fail("VALIDATION", "Use your own domain, not an ATLaS subdomain");
  const existing = await db()
    .select({ id: domains.id })
    .from(domains)
    .where(and(eq(domains.storeId, scope.storeId), eq(domains.type, "custom"), ne(domains.verificationStatus, "failed")));
  if (existing.length >= 3) fail("QUOTA_EXCEEDED", "Up to 3 custom domains per store");
  try {
    const [row] = await db()
      .insert(domains)
      .values({ tenantId: scope.tenantId, storeId: scope.storeId, host, type: "custom", verificationToken: randomToken(18), verificationStatus: "pending", tlsStatus: "none" })
      .$returningId();
    await audit({ tenantId: scope.tenantId, actorId, actorType: "merchant", action: "domain.added", resourceType: "domain", resourceId: row.id, metadata: { host }, impersonationId: scope.impersonationId });
    return row.id;
  } catch (e) {
    if (String((e as Error).message).includes("Duplicate")) fail("CONFLICT", "This domain is already connected to an ATLaS store");
    throw e;
  }
}

async function lookupTxt(name: string): Promise<string[]> {
  try {
    return (await dns.resolveTxt(name)).map(r => r.join(""));
  } catch {
    return [];
  }
}
async function lookupCname(name: string): Promise<string[]> {
  try {
    return await dns.resolveCname(name);
  } catch {
    return [];
  }
}

/** Real DNS verification: TXT proves ownership (verified), CNAME to the edge activates routing (active). */
export async function verifyDomain(scope: TenantScope, id: number, actorId: number) {
  requireWrite(scope, "settings.manage");
  assertFeature(scope.ent.limits.customDomain, "Custom domain", "standard");
  const [d] = await db().select().from(domains).where(and(eq(domains.id, id), eq(domains.storeId, scope.storeId))).limit(1);
  if (!d || d.type !== "custom") fail("NOT_FOUND", "Domain not found");
  const txt = await lookupTxt(`_atlas-verify.${d.host}`);
  const txtOk = txt.includes(`atlas-verify=${d.verificationToken}`);
  const cname = await lookupCname(d.host);
  const cnameOk = cname.some(c => c.replace(/\.$/, "").toLowerCase() === EDGE_TARGET);
  const now = new Date();
  if (!txtOk) {
    await db()
      .update(domains)
      .set({ verificationStatus: "failed", lastCheckedAt: now, lastError: txt.length ? "TXT record found but value doesn't match" : "TXT record not found yet (DNS can take up to 24h)" })
      .where(eq(domains.id, d.id));
    return { status: "failed" as const, txtOk, cnameOk };
  }
  const status = cnameOk ? ("active" as const) : ("verified" as const);
  await db()
    .update(domains)
    .set({ verificationStatus: status, lastCheckedAt: now, verifiedAt: d.verifiedAt ?? now, lastError: cnameOk ? null : "Ownership verified. Point a CNAME to the edge to activate.", tlsStatus: cnameOk ? "pending" : "none" })
    .where(eq(domains.id, d.id));
  if (cnameOk) await enqueue("domain.tls", { domainId: d.id }, { tenantId: scope.tenantId, runAt: new Date(Date.now() + 8000) });
  await audit({ tenantId: scope.tenantId, actorId, actorType: "merchant", action: "domain.verify", resourceType: "domain", resourceId: d.id, metadata: { status }, impersonationId: scope.impersonationId });
  if (status === "verified" || status === "active")
    await notifyTenant(scope.tenantId, "settings.manage", { type: "domain.verified", title: `Domain ${d.host} verified`, body: cnameOk ? "TLS certificate is being issued." : "Add the CNAME record to activate it.", link: "/app/settings/domains", dedupeKey: `domain:${d.id}:${status}` });
  return { status, txtOk, cnameOk };
}

/** Edge adapter: certificate issuance for active custom domains (sandbox issues immediately). */
registerJob("domain.tls", async payload => {
  const id = Number(payload.domainId);
  const [d] = await db().select().from(domains).where(eq(domains.id, id)).limit(1);
  if (!d || d.verificationStatus !== "active") return { skipped: true };
  await db().update(domains).set({ tlsStatus: "issued" }).where(eq(domains.id, id));
  clearStoreCache();
  await notifyTenant(d.tenantId, "settings.manage", { type: "domain.active", title: `${d.host} is live with HTTPS`, link: "/app/settings/domains", dedupeKey: `domain:${d.id}:tls` });
  return { issued: true };
});

export async function setPrimaryDomain(scope: TenantScope, id: number) {
  requireWrite(scope, "settings.manage");
  const [d] = await db().select().from(domains).where(and(eq(domains.id, id), eq(domains.storeId, scope.storeId))).limit(1);
  if (!d) fail("NOT_FOUND", "Domain not found");
  if (d.verificationStatus !== "active") fail("INVALID_STATE", "Only active domains can be primary");
  await db().update(domains).set({ isPrimary: false }).where(eq(domains.storeId, scope.storeId));
  await db().update(domains).set({ isPrimary: true }).where(eq(domains.id, d.id));
}

export async function removeDomain(scope: TenantScope, id: number, actorId: number) {
  requireWrite(scope, "settings.manage");
  const [d] = await db().select().from(domains).where(and(eq(domains.id, id), eq(domains.storeId, scope.storeId))).limit(1);
  if (!d) fail("NOT_FOUND", "Domain not found");
  if (d.type === "subdomain") fail("FORBIDDEN", "Your ATLaS subdomain can't be removed");
  await db().delete(domains).where(eq(domains.id, d.id));
  if (d.isPrimary) await db().update(domains).set({ isPrimary: true }).where(and(eq(domains.storeId, scope.storeId), eq(domains.type, "subdomain")));
  clearStoreCache();
  await audit({ tenantId: scope.tenantId, actorId, actorType: "merchant", action: "domain.removed", resourceType: "domain", resourceId: d.id, metadata: { host: d.host }, impersonationId: scope.impersonationId });
}
