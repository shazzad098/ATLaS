import { Injectable, Logger, type OnModuleDestroy } from "@nestjs/common";
import { Queue, Worker, type Job } from "bullmq";
import IORedis from "ioredis";
import { queueEnv } from "../config/env";
import { PrismaService } from "../database/prisma.service";
import type { Prisma } from "../generated/prisma/client";
import type { QueueHealth, QueueJobData } from "./queue.types";

export const QUEUE_NAME = "atlas-events";

/**
 * Background job runtime (BullMQ + Redis).
 *
 * The queue carries side effects that must not block an HTTP response or be
 * lost when a request dies — audit rows today, notifications/webhooks/billing
 * sweeps as those modules move to the API.
 *
 * Design notes:
 * - `maxRetriesPerRequest: null` is required by BullMQ for blocking commands.
 * - The worker runs in-process for the single-node MVP. Split it into its own
 *   entry point (`node dist/worker.js`) before scaling the API horizontally.
 * - Redis being unavailable must never break login: `enqueueAudit` swallows and
 *   logs the failure, and `/api/health/queue` reports `error`.
 */
@Injectable()
export class QueueService implements OnModuleDestroy {
  private readonly logger = new Logger(QueueService.name);
  private connection: IORedis | null = null;
  private workerConnection: IORedis | null = null;
  private queue: Queue<QueueJobData> | null = null;
  private worker: Worker<QueueJobData> | null = null;

  constructor(private readonly prisma: PrismaService) {
    if (!queueEnv.enabled) {
      this.logger.warn(
        "Background queue disabled (REDIS_URL unset or QUEUE_ENABLED=false). Audit jobs are skipped.",
      );
      return;
    }

    this.connection = new IORedis(queueEnv.url, {
      maxRetriesPerRequest: null,
      enableReadyCheck: true,
    });
    this.connection.on("error", (error: Error) => {
      this.logger.error(`Redis connection error: ${error.message}`);
    });

    this.queue = new Queue<QueueJobData>(QUEUE_NAME, {
      connection: this.connection,
      prefix: queueEnv.prefix,
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: "exponential", delay: 1_000 },
        removeOnComplete: { age: 3_600, count: 1_000 },
        removeOnFail: { age: 86_400, count: 5_000 },
      },
    });

    // Blocking commands need their own connection; `duplicate()` inherits options.
    this.workerConnection = this.connection.duplicate();
    this.worker = new Worker<QueueJobData>(QUEUE_NAME, (job) => this.process(job), {
      connection: this.workerConnection,
      prefix: queueEnv.prefix,
      concurrency: queueEnv.concurrency,
    });
    this.worker.on("failed", (job, error) => {
      this.logger.error(`Job ${job?.id ?? "unknown"} (${job?.name ?? "?"}) failed: ${error.message}`);
    });
    this.worker.on("error", (error) => {
      this.logger.error(`Queue worker error: ${error.message}`);
    });

    this.logger.log(
      `Queue "${QUEUE_NAME}" ready (prefix=${queueEnv.prefix}, concurrency=${queueEnv.concurrency})`,
    );
  }

  /**
   * Fire-and-forget audit event. Never throws: a Redis outage must not turn a
   * successful login into a 500.
   */
  async enqueueAudit(input: Omit<QueueJobData, "type">): Promise<void> {
    if (!this.queue) return;
    try {
      await this.queue.add("audit.record", { type: "audit.record", ...input });
    } catch (error) {
      this.logger.error(
        `Could not enqueue audit job "${input.action}": ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  async health(): Promise<QueueHealth> {
    if (!this.queue) return { status: "disabled" };
    try {
      const counts = await this.queue.getJobCounts("waiting", "active", "delayed", "failed");
      return {
        status: "ok",
        waiting: counts.waiting ?? 0,
        active: counts.active ?? 0,
        delayed: counts.delayed ?? 0,
        failed: counts.failed ?? 0,
      };
    } catch {
      return { status: "error" };
    }
  }

  async onModuleDestroy(): Promise<void> {
    // close() waits for in-flight jobs, so no audit row is lost on deploy.
    await this.worker?.close();
    await this.queue?.close();
    this.workerConnection?.disconnect();
    this.connection?.disconnect();
  }

  private async process(job: Job<QueueJobData>): Promise<void> {
    switch (job.data.type) {
      case "audit.record": {
        const data = job.data;
        await this.prisma.auditLog.create({
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
      default: {
        // Unknown job types are dead letters, not silent successes.
        throw new Error(`Unsupported job payload: ${JSON.stringify(job.data)}`);
      }
    }
  }
}
