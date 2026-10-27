import "reflect-metadata";
import { Logger } from "@nestjs/common";
import { Worker, type Job } from "bullmq";
import IORedis from "ioredis";
import { assertApiRuntimeEnv, queueEnv } from "./config/env";
import { PrismaService } from "./database/prisma.service";
import { processQueueJob } from "./queue/processors";
import { QUEUE_NAME } from "./queue/queue.service";
import type { QueueJobData } from "./queue/queue.types";

/**
 * Standalone BullMQ worker.
 *
 * Run `node dist/worker.js` (and set `QUEUE_RUN_WORKER=false` on the HTTP
 * replicas) when the API scales horizontally, so each queued job is processed
 * by exactly one worker even though several web processes produce jobs.
 */
async function bootstrap(): Promise<void> {
  assertApiRuntimeEnv();

  if (!queueEnv.enabled) {
    console.warn("[worker] Background queue is disabled (REDIS_URL unset). Exiting.");
    return;
  }

  const logger = new Logger("Worker");
  const prisma = new PrismaService();
  await prisma.$connect();

  const connection = new IORedis(queueEnv.url, { maxRetriesPerRequest: null });
  connection.on("error", (error: Error) => logger.error(`Redis error: ${error.message}`));

  const worker = new Worker<QueueJobData>(
    QUEUE_NAME,
    (job: Job<QueueJobData>) => processQueueJob(prisma, job),
    {
      connection,
      prefix: queueEnv.prefix,
      concurrency: queueEnv.concurrency,
    },
  );
  worker.on("failed", (job, error) => logger.error(`Job ${job?.id ?? "?"} failed: ${error.message}`));
  worker.on("error", (error) => logger.error(`Worker error: ${error.message}`));

  logger.log(`Worker listening on "${QUEUE_NAME}" (concurrency=${queueEnv.concurrency})`);

  const shutdown = async (): Promise<void> => {
    logger.log("Shutting down worker…");
    await worker.close();
    await prisma.$disconnect();
    process.exit(0);
  };
  process.on("SIGTERM", () => void shutdown());
  process.on("SIGINT", () => void shutdown());
}

void bootstrap();
