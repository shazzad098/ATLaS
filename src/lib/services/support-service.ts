import { prisma } from "@/lib/db";
import { z } from "zod";
import { recordAudit } from "@/lib/audit";
import { AppError, NotFoundError } from "@/lib/errors";
import { notify } from "@/lib/notifications";
import { assertStoreAccess } from "@/lib/tenant";
import type { ActorContext } from "@/lib/rbac";

/**
 * Merchant-side support tickets (PRD §4.4 "Support tickets from merchant side").
 *
 * The Super Admin console already reads and triages every ticket; this service
 * is the merchant half: open a ticket, follow the answer, close it again. Tenant
 * scoping is enforced here, not by the page.
 */

export const ticketInputSchema = z.object({
  subject: z.string().trim().min(4, "বিষয় অন্তত ৪ অক্ষরের হতে হবে।").max(160),
  body: z.string().trim().min(10, "বিবরণ অন্তত ১০ অক্ষরের হতে হবে।").max(5000),
  priority: z.enum(["LOW", "NORMAL", "HIGH", "URGENT"]).default("NORMAL"),
});

export type TicketInput = z.infer<typeof ticketInputSchema>;

const STATUS_LABELS: Record<string, string> = {
  OPEN: "খোলা",
  PENDING: "অপেক্ষমাণ",
  RESOLVED: "সমাধান হয়েছে",
  CLOSED: "বন্ধ",
};

export function ticketStatusLabel(status: string): string {
  return STATUS_LABELS[status] ?? status;
}

export async function createTicket(
  actor: ActorContext,
  storeId: string,
  raw: unknown,
): Promise<{ id: string }> {
  await assertStoreAccess(actor, storeId);

  const parsed = ticketInputSchema.safeParse(raw);
  if (!parsed.success) {
    throw new AppError(
      "VALIDATION_FAILED",
      parsed.error.issues[0]?.message ?? "টিকেটের তথ্য সঠিক নয়।",
      422,
      { issues: parsed.error.issues.map((issue) => issue.message) },
    );
  }

  const store = await prisma.store.findUnique({
    where: { id: storeId },
    select: { name: true, tenantId: true },
  });
  if (!store) throw new NotFoundError("Store");

  const ticket = await prisma.supportTicket.create({
    data: {
      tenantId: store.tenantId,
      requesterId: actor.userId,
      subject: parsed.data.subject,
      body: `[${store.name}] ${parsed.data.body}`,
      priority: parsed.data.priority,
      status: "OPEN",
    },
    select: { id: true },
  });

  await recordAudit({
    action: "support.ticket_created",
    tenantId: store.tenantId,
    actorId: actor.userId,
    resourceType: "SupportTicket",
    resourceId: ticket.id,
    metadata: { subject: parsed.data.subject, priority: parsed.data.priority },
  });

  await notify({
    userId: actor.userId,
    type: "support.ticket_created",
    title: "সাপোর্ট টিকেট তৈরি হয়েছে",
    body: `“${parsed.data.subject}” — টিম যত দ্রুত সম্ভব উত্তর দেবে।`,
    payload: { ticketId: ticket.id },
  });

  return ticket;
}

/** Tickets the caller's tenant owns, newest first. */
export async function listTenantTickets(tenantId: string, options: { status?: string } = {}) {
  return prisma.supportTicket.findMany({
    where: {
      tenantId,
      ...(options.status ? { status: options.status as never } : {}),
    },
    orderBy: [{ createdAt: "desc" }],
    take: 100,
  });
}

export async function ticketCounts(tenantId: string) {
  const rows = await prisma.supportTicket.groupBy({
    by: ["status"],
    where: { tenantId },
    _count: { _all: true },
  });
  const map = new Map(rows.map((row) => [row.status, row._count._all]));
  return {
    open: (map.get("OPEN") ?? 0) + (map.get("PENDING") ?? 0),
    resolved: map.get("RESOLVED") ?? 0,
    closed: map.get("CLOSED") ?? 0,
    total: rows.reduce((sum, row) => sum + row._count._all, 0),
  };
}

/** A merchant may close their own ticket; triage stays with the platform team. */
export async function closeTicket(actor: ActorContext, ticketId: string): Promise<void> {
  const ticket = await prisma.supportTicket.findFirst({
    where: { id: ticketId, tenantId: actor.tenantId },
  });
  if (!ticket) throw new NotFoundError("Support ticket");

  await prisma.supportTicket.update({ where: { id: ticketId }, data: { status: "CLOSED" } });

  await recordAudit({
    action: "support.ticket_closed",
    tenantId: actor.tenantId,
    actorId: actor.userId,
    resourceType: "SupportTicket",
    resourceId: ticketId,
  });
}

/**
 * Public contact form (marketing `/contact`). There is no tenant yet, so the
 * tenant id stays null and the platform team triages it from the same inbox.
 */
export async function createPublicTicket(input: {
  name: string;
  email: string;
  subject: string;
  body: string;
}): Promise<{ id: string }> {
  const parsed = ticketInputSchema.safeParse({
    subject: input.subject || `Contact form — ${input.name}`,
    body: `${input.body}\n\n— ${input.name} (${input.email})`,
    priority: "NORMAL",
  });
  if (!parsed.success) {
    throw new AppError(
      "VALIDATION_FAILED",
      parsed.error.issues[0]?.message ?? "তথ্য সঠিক নয়।",
      422,
      { issues: parsed.error.issues.map((issue) => issue.message) },
    );
  }

  return prisma.supportTicket.create({
    data: {
      subject: parsed.data.subject,
      body: parsed.data.body,
      priority: "NORMAL",
      status: "OPEN",
    },
    select: { id: true },
  });
}
