import { Global, Module } from "@nestjs/common";
import { QueueService } from "./queue.service";

/**
 * Global so any feature module can enqueue background work without importing
 * the queue plumbing. The worker starts with the API (single-node MVP).
 */
@Global()
@Module({
  providers: [QueueService],
  exports: [QueueService],
})
export class QueueModule {}
