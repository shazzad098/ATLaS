import { Module } from "@nestjs/common";
import { AuthModule } from "./auth/auth.module";
import { CatalogModule } from "./catalog/catalog.module";
import { DatabaseModule } from "./database/database.module";
import { HealthModule } from "./health/health.module";
import { EmailModule } from "./notifications/email/email.module";
import { OrdersModule } from "./orders/orders.module";
import { QueueModule } from "./queue/queue.module";
import { StorageModule } from "./storage/storage.module";

/**
 * Root module. Feature modules (auth, catalog, orders, billing, …) are wired in
 * here one at a time as the API grows; the Next.js app stays the frontend and
 * keeps its server actions until each surface is migrated.
 */
@Module({
  imports: [
    DatabaseModule,
    QueueModule,
    HealthModule,
    AuthModule,
    StorageModule,
    CatalogModule,
    OrdersModule,
    EmailModule,
  ],
})
export class AppModule {}
