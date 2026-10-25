import { Module } from "@nestjs/common";
import { AuthModule } from "./auth/auth.module";
import { DatabaseModule } from "./database/database.module";
import { HealthModule } from "./health/health.module";
import { QueueModule } from "./queue/queue.module";
import { StorageModule } from "./storage/storage.module";

/**
 * Root module. Feature modules (auth, catalog, orders, billing, …) are wired in
 * here one at a time as the API grows; the Next.js app stays the frontend and
 * keeps its server actions until each surface is migrated.
 */
@Module({
  imports: [DatabaseModule, QueueModule, HealthModule, AuthModule, StorageModule],
})
export class AppModule {}
