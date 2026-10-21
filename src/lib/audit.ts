import { prisma } from "@/lib/db";

/**
 * Audit trail (PRD §10.6, §13).
 *
 * Every privileged or financially relevant mutation writes a row: staff
 * changes, Super Admin impersonation, plan changes, refunds, domain verification.
 */

export type AuditInput = {
  action: string;
  tenantId?: string | null;
  actorId?: string | null;
  resourceType?: string;
  resourceId?: string;
  metadata?: Record<string, unknown>;
  ip?: string | null;
};

export async function recordAudit(input: AuditInput): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        action: input.action,
        tenantId: input.tenantId ?? null,
        actorId: input.actorId ?? null,
        resourceType: input.resourceType,
        resourceId: input.resourceId,
        metadataJson: (input.metadata ?? {}) as never,
        ip: input.ip ?? null,
      },
    });
  } catch (error) {
    // Audit failures must never break the user's action, but they must be loud.
    console.error("[audit] failed to record", input.action, error);
  }
}

export async function listAuditLogs(options: {
  tenantId?: string;
  action?: string;
  limit?: number;
}) {
  return prisma.auditLog.findMany({
    where: {
      ...(options.tenantId ? { tenantId: options.tenantId } : {}),
      ...(options.action ? { action: options.action } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: options.limit ?? 100,
    include: {
      actor: { select: { id: true, phone: true, name: true } },
      tenant: { select: { id: true, name: true } },
    },
  });
}

/**
 * Counters behind the Super Admin security centre (PRD §4.5).
 *
 * Kept here rather than in the page so the time window is computed once, on the
 * server, and the render stays free of clock reads.
 */
export async function securityOverview(hours = 24) {
  const since = new Date(Date.now() - hours * 60 * 60 * 1000);

  const [sessions, otp, topActions, impersonations, failedWebhooks] = await Promise.all([
    prisma.session.count({ where: { revokedAt: null, expiresAt: { gt: new Date() } } }),
    prisma.otpChallenge.findMany({
      where: { createdAt: { gte: since } },
      select: { attempts: true, consumedAt: true },
      take: 500,
    }),
    prisma.auditLog
      .groupBy({
        by: ["action"],
        where: { createdAt: { gte: since } },
        _count: { _all: true },
      })
      .then((rows) => rows.sort((a, b) => b._count._all - a._count._all).slice(0, 8)),
    prisma.auditLog.findMany({
      where: { action: { startsWith: "super_admin." } },
      orderBy: { createdAt: "desc" },
      take: 5,
      include: { actor: { select: { name: true, phone: true } } },
    }),
    prisma.paymentWebhookEvent.count({ where: { status: "FAILED" } }),
  ]);

  return {
    since,
    sessions,
    otpTotal: otp.length,
    lockedOtp: otp.filter((row) => row.attempts >= 5).length,
    consumedOtp: otp.filter((row) => row.consumedAt).length,
    topActions,
    impersonations,
    failedWebhooks,
  };
}

/** Super Admin impersonation is time-limited and fully recorded (PRD §4.5, §13). */
export async function recordImpersonation(input: {
  superAdminId: string;
  tenantId: string;
  reason: string;
  reference?: string;
  phase: "START" | "END";
}): Promise<void> {
  await recordAudit({
    action: `super_admin.impersonation.${input.phase.toLowerCase()}`,
    tenantId: input.tenantId,
    actorId: input.superAdminId,
    resourceType: "Tenant",
    resourceId: input.tenantId,
    metadata: { reason: input.reason, reference: input.reference },
  });
}
