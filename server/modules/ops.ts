import dns from "node:dns/promises";
import net from "node:net";
import { and, eq, inArray, isNull } from "drizzle-orm";
import { db, type DbOrTx } from "../db";
import {
  analyticsEvents,
  auditLogs,
  memberships,
  notifications,
  outboundMessages,
  roles,
  webhookDeliveries,
  webhookEndpoints,
} from "../../drizzle/schema";
import type { AnalyticsEvent } from "../../shared/domain";
import type { Permission } from "../../shared/permissions";
import { decryptSecret, hmacHex, sha256 } from "../lib/crypto";
import { enqueue, registerJob } from "./jobs";

/* ───────── Audit ───────── */
export type AuditEntry = {
  tenantId?: number | null;
  actorId?: number | null;
  actorType: string;
  action: string;
  resourceType?: string;
  resourceId?: string | number;
  metadata?: Record<string, unknown>;
  ip?: string | null;
  impersonationId?: number | null;
};
export async function audit(e: AuditEntry, tx: DbOrTx = db()) {
  await tx.insert(auditLogs).values({
    tenantId: e.tenantId ?? null,
    actorId: e.actorId ?? null,
    actorType: e.actorType,
    action: e.action,
    resourceType: e.resourceType ?? null,
    resourceId: e.resourceId !== undefined ? String(e.resourceId) : null,
    metadataJson: e.metadata ?? null,
    ip: e.ip ?? null,
    impersonationId: e.impersonationId ?? null,
  });
}

/* ───────── Analytics event taxonomy (PRD §15) ───────── */
export async function track(event: AnalyticsEvent, p: { tenantId?: number | null; storeId?: number | null; userId?: number | null; props?: Record<string, unknown> }) {
  await db()
    .insert(analyticsEvents)
    .values({ event, tenantId: p.tenantId ?? null, storeId: p.storeId ?? null, userId: p.userId ?? null, propertiesJson: p.props ?? null })
    .catch(err => console.warn("[analytics] failed", err?.message));
}

/* ───────── In-app notifications ───────── */
export type NotificationInput = { tenantId?: number | null; type: string; title: string; body?: string; link?: string; dedupeKey?: string; payload?: Record<string, unknown> };
export async function notifyUsers(userIds: number[], n: NotificationInput) {
  const unique = Array.from(new Set(userIds));
  for (const userId of unique) {
    await db()
      .insert(notifications)
      .values({
        userId,
        tenantId: n.tenantId ?? null,
        type: n.type,
        title: n.title,
        body: n.body ?? null,
        link: n.link ?? null,
        payloadJson: n.payload ?? null,
        dedupeKey: n.dedupeKey ? `${n.dedupeKey}:u${userId}` : null,
      })
      .catch(err => {
        if (!String(err?.message).includes("Duplicate")) console.warn("[notify] failed", err?.message);
      });
  }
}

export async function tenantMembersWith(tenantId: number, permission: Permission | null): Promise<number[]> {
  const rows = await db()
    .select({ userId: memberships.userId, perms: roles.permissionsJson })
    .from(memberships)
    .innerJoin(roles, eq(roles.id, memberships.roleId))
    .where(and(eq(memberships.tenantId, tenantId), eq(memberships.status, "active")));
  return rows.filter(r => r.userId && (!permission || r.perms.includes(permission))).map(r => r.userId!) as number[];
}

export async function notifyTenant(tenantId: number, permission: Permission | null, n: Omit<NotificationInput, "tenantId">) {
  const users = await tenantMembersWith(tenantId, permission);
  await notifyUsers(users, { ...n, tenantId });
}

/* ───────── Messaging adapters (SMS / email / WhatsApp-ready) ───────── */
export interface MessageAdapter {
  provider: string;
  send(msg: { to: string; subject?: string; body: string }): Promise<{ ok: boolean; error?: string }>;
}
/** Sandbox SMS driver: messages are stored and surfaced in the Demo SMS inbox. Replace with SSL Wireless / Twilio adapter in production. */
const sandboxSms: MessageAdapter = { provider: "sandbox-sms", send: async () => ({ ok: true }) };
/** Email driver logs to the outbox; plug SMTP/SES here. */
const logEmail: MessageAdapter = { provider: "outbox-email", send: async () => ({ ok: true }) };
/** WhatsApp Business adapter placeholder: queued until a provider is configured. */
const whatsappReady: MessageAdapter = { provider: "whatsapp-ready", send: async () => ({ ok: false, error: "WhatsApp provider not configured (queued)" }) };

export const smsDriverName = () => sandboxSms.provider;

async function deliver(channel: "sms" | "email" | "whatsapp", adapter: MessageAdapter, m: { to: string; subject?: string; body: string; template: string; tenantId?: number | null; deviceId?: string | null }) {
  const r = await adapter.send(m);
  await db()
    .insert(outboundMessages)
    .values({
      tenantId: m.tenantId ?? null,
      channel,
      recipient: m.to,
      subject: m.subject ?? null,
      body: m.body,
      template: m.template,
      provider: adapter.provider,
      deviceId: m.deviceId ?? null,
      status: r.ok ? "sent" : "queued",
      error: r.error ?? null,
    });
  return r.ok;
}
export const sendSms = (m: { to: string; body: string; template: string; tenantId?: number | null; deviceId?: string | null }) => deliver("sms", sandboxSms, m);
export const sendEmail = (m: { to: string; subject: string; body: string; template: string; tenantId?: number | null }) => deliver("email", logEmail, m);
export const sendWhatsApp = (m: { to: string; body: string; template: string; tenantId?: number | null }) => deliver("whatsapp", whatsappReady, m);

/* ───────── Outbound merchant webhooks (signed, retried) ───────── */
export const WEBHOOK_EVENTS = [
  "order.created",
  "order.status_changed",
  "payment.succeeded",
  "payment.failed",
  "product.created",
  "product.updated",
  "inventory.low_stock",
  "shipment.updated",
] as const;

export async function emitEvent(tenantId: number, storeId: number, type: string, data: Record<string, unknown>) {
  const endpoints = await db()
    .select()
    .from(webhookEndpoints)
    .where(and(eq(webhookEndpoints.tenantId, tenantId), eq(webhookEndpoints.storeId, storeId), eq(webhookEndpoints.status, "active")));
  for (const ep of endpoints) {
    if (!ep.eventsJson.includes(type) && !ep.eventsJson.includes("*")) continue;
    const payload = { id: `evt_${Date.now()}_${ep.id}`, type, createdAt: new Date().toISOString(), storeId, data };
    const [row] = await db()
      .insert(webhookDeliveries)
      .values({ tenantId, endpointId: ep.id, eventType: type, endpoint: ep.url, payloadHash: sha256(JSON.stringify(payload)), payloadJson: payload, status: "pending" })
      .$returningId();
    await enqueue("webhook.deliver", { deliveryId: row.id }, { tenantId, maxAttempts: 6 });
  }
}

function isPrivateIp(ip: string): boolean {
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split(".").map(Number);
    return a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127);
  }
  const l = ip.toLowerCase();
  return l === "::1" || l.startsWith("fc") || l.startsWith("fd") || l.startsWith("fe80") || l.startsWith("::ffff:127.") || l.startsWith("::ffff:10.");
}

/** SSRF guard for merchant-supplied URLs (PRD §13). */
export async function assertPublicUrl(raw: string) {
  const u = new URL(raw);
  if (u.protocol !== "https:") throw new Error("Webhook URL must use https");
  if (["localhost"].includes(u.hostname) || u.hostname.endsWith(".internal") || u.hostname.endsWith(".local")) throw new Error("Private hosts are not allowed");
  const addrs = net.isIP(u.hostname) ? [u.hostname] : (await dns.lookup(u.hostname, { all: true })).map(a => a.address);
  if (!addrs.length || addrs.some(isPrivateIp)) throw new Error("Webhook URL resolves to a private address");
}

registerJob("webhook.deliver", async payload => {
  const id = Number(payload.deliveryId);
  const [d] = await db().select().from(webhookDeliveries).where(eq(webhookDeliveries.id, id)).limit(1);
  if (!d || d.status === "delivered") return { skipped: true };
  const [ep] = await db().select().from(webhookEndpoints).where(eq(webhookEndpoints.id, d.endpointId)).limit(1);
  if (!ep || ep.status !== "active") {
    await db().update(webhookDeliveries).set({ status: "dead", lastError: "Endpoint disabled" }).where(eq(webhookDeliveries.id, id));
    return { skipped: true };
  }
  const body = JSON.stringify(d.payloadJson);
  const ts = Math.floor(Date.now() / 1000);
  const sig = hmacHex(decryptSecret(ep.secretEnc, "webhook"), `${ts}.${body}`);
  let status = 0;
  let error: string | null = null;
  try {
    await assertPublicUrl(ep.url);
    const res = await fetch(ep.url, {
      method: "POST",
      headers: { "content-type": "application/json", "x-atlas-event": d.eventType, "x-atlas-signature": `t=${ts},v1=${sig}`, "user-agent": "ATLaS-Webhooks/1.0" },
      body,
      redirect: "manual",
      signal: AbortSignal.timeout(5000),
    });
    status = res.status;
    if (res.status < 200 || res.status >= 300) error = `HTTP ${res.status}`;
  } catch (e) {
    error = (e as Error).message.slice(0, 250);
  }
  const attempts = d.attempts + 1;
  if (!error) {
    await db().update(webhookDeliveries).set({ status: "delivered", attempts, lastStatusCode: status, lastError: null }).where(eq(webhookDeliveries.id, id));
    return { delivered: true };
  }
  await db()
    .update(webhookDeliveries)
    .set({ status: attempts >= 6 ? "dead" : "failed", attempts, lastStatusCode: status || null, lastError: error })
    .where(eq(webhookDeliveries.id, id));
  throw new Error(error);
});

export async function markNotificationsRead(userId: number, ids: number[] | "all") {
  const cond = ids === "all" ? and(eq(notifications.userId, userId), isNull(notifications.readAt)) : and(eq(notifications.userId, userId), inArray(notifications.id, ids));
  await db().update(notifications).set({ readAt: new Date() }).where(cond);
}
