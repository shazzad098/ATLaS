import { and, desc, eq, gte, inArray, isNull, lte, or, sql } from "drizzle-orm";
import { db } from "../db";
import { announcements, supportTickets, ticketMessages, users } from "../../drizzle/schema";
import { fail } from "../lib/core";
import { audit, notifyUsers, sendEmail } from "./ops";
import { requirePerm, type TenantScope } from "./tenancy";

const SLA_BY_SUPPORT = { community: "low", standard: "normal", priority: "high", priority_onboarding: "urgent" } as const;

async function platformStaffIds() {
  const rows = await db().select({ id: users.id }).from(users).where(inArray(users.platformRole, ["super_admin", "support"]));
  return rows.map(r => r.id);
}

export async function createTicket(input: {
  tenantId?: number | null;
  requesterId?: number | null;
  requesterName?: string;
  requesterEmail?: string;
  requesterPhone?: string;
  category: string;
  priority?: "low" | "normal" | "high" | "urgent";
  subject: string;
  body: string;
}) {
  if (input.subject.trim().length < 4) fail("VALIDATION", "Subject is too short");
  if (input.body.trim().length < 10) fail("VALIDATION", "Please describe the issue in a bit more detail");
  const [row] = await db()
    .insert(supportTickets)
    .values({
      tenantId: input.tenantId ?? null,
      requesterId: input.requesterId ?? null,
      requesterName: input.requesterName ?? null,
      requesterEmail: input.requesterEmail ?? null,
      requesterPhone: input.requesterPhone ?? null,
      category: input.category,
      priority: input.priority ?? "normal",
      subject: input.subject.trim(),
      body: input.body.trim(),
    })
    .$returningId();
  await notifyUsers(await platformStaffIds(), { type: "support.ticket_created", title: `New ticket #${row.id}: ${input.subject.trim()}`, body: input.category, link: `/admin/support?ticket=${row.id}` });
  if (input.requesterEmail) await sendEmail({ to: input.requesterEmail, subject: `[ATLaS #${row.id}] We received your request`, body: `Thanks for reaching out. Ticket #${row.id} — "${input.subject}". Our team will reply soon.`, template: "ticket_created", tenantId: input.tenantId });
  return row.id;
}

export async function merchantCreateTicket(scope: TenantScope, user: { id: number; name: string | null; email: string | null; phone: string | null }, input: { category: string; subject: string; body: string }) {
  requirePerm(scope, "support.use");
  return createTicket({
    tenantId: scope.tenantId,
    requesterId: user.id,
    requesterName: user.name ?? undefined,
    requesterEmail: user.email ?? undefined,
    requesterPhone: user.phone ?? undefined,
    category: input.category,
    priority: SLA_BY_SUPPORT[scope.ent.limits.support],
    subject: input.subject,
    body: input.body,
  });
}

export async function listTickets(filter: { tenantId?: number; status?: string; limit: number }) {
  return db()
    .select()
    .from(supportTickets)
    .where(and(filter.tenantId ? eq(supportTickets.tenantId, filter.tenantId) : undefined, filter.status ? eq(supportTickets.status, filter.status as "open") : undefined))
    .orderBy(sql`field(${supportTickets.priority}, 'urgent','high','normal','low')`, desc(supportTickets.id))
    .limit(filter.limit);
}

export async function ticketDetail(id: number, tenantId?: number) {
  const [t] = await db()
    .select()
    .from(supportTickets)
    .where(and(eq(supportTickets.id, id), tenantId ? eq(supportTickets.tenantId, tenantId) : undefined))
    .limit(1);
  if (!t) fail("NOT_FOUND", "Ticket not found");
  const messages = await db().select().from(ticketMessages).where(eq(ticketMessages.ticketId, id)).orderBy(ticketMessages.id);
  return { ticket: t, messages };
}

export async function replyTicket(id: number, author: { id: number; type: "merchant" | "staff" }, body: string, tenantId?: number) {
  const { ticket } = await ticketDetail(id, tenantId);
  if (!body.trim()) fail("VALIDATION", "Reply can't be empty");
  await db().insert(ticketMessages).values({ ticketId: id, authorId: author.id, authorType: author.type, body: body.trim() });
  await db()
    .update(supportTickets)
    .set({ status: author.type === "staff" ? "pending" : "open" })
    .where(eq(supportTickets.id, id));
  if (author.type === "staff") {
    if (ticket.requesterId) await notifyUsers([ticket.requesterId], { tenantId: ticket.tenantId, type: "support.reply", title: `Support replied on #${id}`, body: body.slice(0, 140), link: `/app/support?ticket=${id}` });
    if (ticket.requesterEmail) await sendEmail({ to: ticket.requesterEmail, subject: `[ATLaS #${id}] ${ticket.subject}`, body, template: "ticket_reply", tenantId: ticket.tenantId });
  } else await notifyUsers(await platformStaffIds(), { type: "support.reply", title: `Merchant replied on #${id}`, body: body.slice(0, 140), link: `/admin/support?ticket=${id}` });
}

export async function updateTicket(id: number, patch: { status?: "open" | "pending" | "resolved" | "closed"; priority?: "low" | "normal" | "high" | "urgent"; assignedTo?: number | null }, actorId: number) {
  await db().update(supportTickets).set(patch).where(eq(supportTickets.id, id));
  await audit({ actorId, actorType: "admin", action: "support.ticket_updated", resourceType: "ticket", resourceId: id, metadata: patch });
}

/* ───────── Announcements ───────── */
export async function activeAnnouncements(planCode: string) {
  const now = new Date();
  return db()
    .select()
    .from(announcements)
    .where(
      and(
        eq(announcements.status, "published"),
        or(isNull(announcements.startsAt), lte(announcements.startsAt, now)),
        or(isNull(announcements.endsAt), gte(announcements.endsAt, now)),
        inArray(announcements.audience, planCode === "free" ? ["all", "free"] : ["all", "paid"])
      )
    )
    .orderBy(desc(announcements.id))
    .limit(5);
}

export async function listAnnouncements() {
  return db().select().from(announcements).orderBy(desc(announcements.id)).limit(100);
}

export async function upsertAnnouncement(input: { id?: number; title: string; body: string; audience: "all" | "free" | "paid"; level: "info" | "warning" | "success"; status: "draft" | "published" | "archived"; startsAt?: Date | null; endsAt?: Date | null }, actorId: number) {
  const values = { title: input.title, body: input.body, audience: input.audience, level: input.level, status: input.status, startsAt: input.startsAt ?? null, endsAt: input.endsAt ?? null };
  if (input.id) {
    await db().update(announcements).set(values).where(eq(announcements.id, input.id));
    return input.id;
  }
  const [row] = await db().insert(announcements).values({ ...values, createdBy: actorId }).$returningId();
  await audit({ actorId, actorType: "admin", action: "announcement.created", resourceType: "announcement", resourceId: row.id });
  return row.id;
}
