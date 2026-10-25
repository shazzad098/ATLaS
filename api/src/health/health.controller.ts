import { Controller, Get, ServiceUnavailableException } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { PrismaService } from "../database/prisma.service";
import { QueueService } from "../queue/queue.service";
import type { QueueHealth } from "../queue/queue.types";

export type HealthResponse = {
  status: "ok";
  service: "atlas-api";
  uptimeSeconds: number;
  timestamp: string;
};

export type DatabaseHealthResponse = {
  status: "ok";
  latencyMs: number;
};

/**
 * Liveness + readiness.
 *
 * `/api/health` stays dependency-free (load balancers must not restart the API
 * because Postgres blipped); `/api/health/db` is the readiness probe and reports
 * 503 when the database cannot be reached.
 */
@ApiTags("health")
@Controller("health")
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly queue: QueueService,
  ) {}

  @Get()
  @ApiOperation({ summary: "Liveness probe (no dependencies)" })
  check(): HealthResponse {
    return {
      status: "ok",
      service: "atlas-api",
      uptimeSeconds: Math.round(process.uptime()),
      timestamp: new Date().toISOString(),
    };
  }

  @Get("db")
  @ApiOperation({ summary: "Readiness probe (Postgres round-trip, 503 when down)" })
  async database(): Promise<DatabaseHealthResponse> {
    const startedAt = Date.now();
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return { status: "ok", latencyMs: Date.now() - startedAt };
    } catch (error) {
      throw new ServiceUnavailableException({
        status: "error",
        message: error instanceof Error ? error.message : "Database unreachable",
      });
    }
  }

  @Get("queue")
  @ApiOperation({
    summary: "Background queue health (BullMQ); 200 with `disabled` when Redis is off",
  })
  async queueHealth(): Promise<QueueHealth> {
    return this.queue.health();
  }
}
