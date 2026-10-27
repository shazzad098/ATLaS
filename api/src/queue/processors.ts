import type { Job } from "bullmq";
import type { Prisma } from "../generated/prisma/client";
import type { PrismaService } from "../database/prisma.service";
import type { QueueJobData } from "./queue.types";

/**
 * Job handlers, shared by the in-process worker and the standalone worker
 * process (`dist/worker.js`). Keeping them pure functions means the HTTP server
 * and the worker cannot drift apart.
 */
export async function processQueueJob(prisma: PrismaService, job: Job<QueueJobData>): Promise<void> {
  switch (job.data.type) {
    case "audit.record": {
      const data = job.data;
      await prisma.auditLog.create({
        data: {
          action: data.action,
          actorId: data.actorId ?? null,
          tenantId: data.tenantId ?? null,
          resourceType: data.resourceType,
          resourceId: data.resourceId,
          metadataJson: (data.metadata ?? {}) as Prisma.InputJsonValue,
          ip: data.ip ?? null,
        },
      });
      return;
    }
    default:
      // Unknown job types are dead letters, not silent successes.
      throw new Error(`Unsupported job payload: ${JSON.stringify(job.data)}`);
  }
}
