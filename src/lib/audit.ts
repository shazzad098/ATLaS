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
