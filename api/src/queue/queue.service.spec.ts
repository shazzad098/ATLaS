import type { PrismaService } from "../database/prisma.service";
import { QueueService } from "./queue.service";

describe("QueueService with the queue disabled", () => {
  const savedUrl = process.env.REDIS_URL;
  const savedEnabled = process.env.QUEUE_ENABLED;

  beforeAll(() => {
    delete process.env.REDIS_URL;
    process.env.QUEUE_ENABLED = "true";
  });

  afterAll(() => {
    if (savedUrl === undefined) delete process.env.REDIS_URL;
    else process.env.REDIS_URL = savedUrl;
    if (savedEnabled === undefined) delete process.env.QUEUE_ENABLED;
    else process.env.QUEUE_ENABLED = savedEnabled;
  });

  it("reports disabled instead of crashing when Redis is not configured", async () => {
    const service = new QueueService({} as PrismaService);

    await expect(service.health()).resolves.toEqual({ status: "disabled" });
    // No queue -> audit jobs are dropped, and the caller never sees an error.
    await expect(service.enqueueAudit({ action: "auth.login" })).resolves.toBeUndefined();

    await service.onModuleDestroy();
  });
});
