CREATE TABLE `account_deletion_requests` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`reason` text,
	`status` enum('requested','cancelled','completed') NOT NULL DEFAULT 'requested',
	`scheduledFor` timestamp NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `account_deletion_requests_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `analytics_events` (
	`id` int AUTO_INCREMENT NOT NULL,
	`event` varchar(40) NOT NULL,
	`tenantId` int,
	`storeId` int,
	`userId` int,
	`propertiesJson` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `analytics_events_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `announcements` (
	`id` int AUTO_INCREMENT NOT NULL,
	`title` varchar(160) NOT NULL,
	`body` text NOT NULL,
	`audience` enum('all','free','paid') NOT NULL DEFAULT 'all',
	`level` enum('info','warning','success') NOT NULL DEFAULT 'info',
	`status` enum('draft','published','archived') NOT NULL DEFAULT 'published',
	`startsAt` timestamp,
	`endsAt` timestamp,
	`createdBy` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `announcements_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `api_keys` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tenantId` int NOT NULL,
	`storeId` int NOT NULL,
	`name` varchar(80) NOT NULL,
	`prefix` varchar(24) NOT NULL,
	`keyHash` varchar(64) NOT NULL,
	`scopesJson` json NOT NULL,
	`lastUsedAt` timestamp,
	`revokedAt` timestamp,
	`createdBy` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `api_keys_id` PRIMARY KEY(`id`),
	CONSTRAINT `api_keys_prefix_unique` UNIQUE(`prefix`)
);
--> statement-breakpoint
CREATE TABLE `assets` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tenantId` int,
	`storeId` int,
	`objectKey` varchar(512) NOT NULL,
	`url` varchar(600) NOT NULL,
	`mimeType` varchar(100) NOT NULL,
	`sizeBytes` bigint NOT NULL,
	`checksum` varchar(64),
	`kind` enum('product_image','logo','theme_asset','export','other') NOT NULL DEFAULT 'other',
	`metadataJson` json,
	`deletedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `assets_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `audit_logs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tenantId` int,
	`actorId` int,
	`actorType` varchar(20) NOT NULL,
	`impersonationId` int,
	`action` varchar(80) NOT NULL,
	`resourceType` varchar(40),
	`resourceId` varchar(40),
	`metadataJson` json,
	`ip` varchar(64),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `audit_logs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `cart_items` (
	`id` int AUTO_INCREMENT NOT NULL,
	`cartId` int NOT NULL,
	`variantId` int NOT NULL,
	`quantity` int NOT NULL,
	`unitPriceSnapshot` decimal(14,2) NOT NULL,
	CONSTRAINT `cart_items_id` PRIMARY KEY(`id`),
	CONSTRAINT `cart_items_uq` UNIQUE(`cartId`,`variantId`)
);
--> statement-breakpoint
CREATE TABLE `carts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`storeId` int NOT NULL,
	`customerId` int,
	`sessionKey` varchar(64) NOT NULL,
	`status` enum('active','converted','abandoned') NOT NULL DEFAULT 'active',
	`expiresAt` timestamp NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `carts_id` PRIMARY KEY(`id`),
	CONSTRAINT `carts_session_uq` UNIQUE(`storeId`,`sessionKey`)
);
--> statement-breakpoint
CREATE TABLE `categories` (
	`id` int AUTO_INCREMENT NOT NULL,
	`storeId` int NOT NULL,
	`parentId` int,
	`name` varchar(120) NOT NULL,
	`nameBn` varchar(120),
	`slug` varchar(120) NOT NULL,
	`imageUrl` varchar(512),
	`sortOrder` int NOT NULL DEFAULT 0,
	`status` enum('active','hidden') NOT NULL DEFAULT 'active',
	CONSTRAINT `categories_id` PRIMARY KEY(`id`),
	CONSTRAINT `categories_uq` UNIQUE(`storeId`,`slug`)
);
--> statement-breakpoint
CREATE TABLE `content_pages` (
	`id` int AUTO_INCREMENT NOT NULL,
	`storeId` int NOT NULL,
	`slug` varchar(80) NOT NULL,
	`title` varchar(160) NOT NULL,
	`bodyJson` json NOT NULL,
	`type` enum('policy','page') NOT NULL DEFAULT 'page',
	`status` enum('draft','published') NOT NULL DEFAULT 'published',
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `content_pages_id` PRIMARY KEY(`id`),
	CONSTRAINT `content_pages_uq` UNIQUE(`storeId`,`slug`)
);
--> statement-breakpoint
CREATE TABLE `coupon_redemptions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`couponId` int NOT NULL,
	`orderId` int NOT NULL,
	`customerPhone` varchar(20) NOT NULL,
	`amount` decimal(14,2) NOT NULL,
	`voided` boolean NOT NULL DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `coupon_redemptions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `coupons` (
	`id` int AUTO_INCREMENT NOT NULL,
	`storeId` int NOT NULL,
	`code` varchar(40) NOT NULL,
	`type` enum('percentage','fixed') NOT NULL,
	`value` decimal(14,2) NOT NULL,
	`minOrder` decimal(14,2),
	`maxDiscount` decimal(14,2),
	`usageLimit` int,
	`usedCount` int NOT NULL DEFAULT 0,
	`perCustomerLimit` int,
	`firstOrderOnly` boolean NOT NULL DEFAULT false,
	`categoryIdsJson` json,
	`startsAt` timestamp,
	`endsAt` timestamp,
	`status` enum('active','inactive') NOT NULL DEFAULT 'active',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `coupons_id` PRIMARY KEY(`id`),
	CONSTRAINT `coupons_store_code_uq` UNIQUE(`storeId`,`code`)
);
--> statement-breakpoint
CREATE TABLE `courier_connections` (
	`id` int AUTO_INCREMENT NOT NULL,
	`storeId` int NOT NULL,
	`tenantId` int NOT NULL,
	`provider` enum('pathao','steadfast','redx','paperfly','manual') NOT NULL,
	`isThirdParty` boolean NOT NULL,
	`publicConfigJson` json,
	`encryptedCredentials` text,
	`status` enum('connected','disconnected','error') NOT NULL DEFAULT 'connected',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `courier_connections_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `customers` (
	`id` int AUTO_INCREMENT NOT NULL,
	`storeId` int NOT NULL,
	`name` varchar(160) NOT NULL,
	`phone` varchar(20) NOT NULL,
	`email` varchar(320),
	`addressJson` json,
	`consentJson` json,
	`status` enum('active','blacklisted') NOT NULL DEFAULT 'active',
	`blacklistReason` varchar(255),
	`tagsJson` json,
	`notes` text,
	`totalOrders` int NOT NULL DEFAULT 0,
	`totalSpent` decimal(14,2) NOT NULL DEFAULT '0.00',
	`lastOrderAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `customers_id` PRIMARY KEY(`id`),
	CONSTRAINT `customers_store_phone_uq` UNIQUE(`storeId`,`phone`)
);
--> statement-breakpoint
CREATE TABLE `daily_store_metrics` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tenantId` int NOT NULL,
	`storeId` int NOT NULL,
	`date` date NOT NULL,
	`orders` int NOT NULL DEFAULT 0,
	`eligibleOrders` int NOT NULL DEFAULT 0,
	`cancelledOrders` int NOT NULL DEFAULT 0,
	`revenue` decimal(14,2) NOT NULL DEFAULT '0.00',
	`onlineRevenue` decimal(14,2) NOT NULL DEFAULT '0.00',
	`codRevenue` decimal(14,2) NOT NULL DEFAULT '0.00',
	`itemsSold` int NOT NULL DEFAULT 0,
	`newCustomers` int NOT NULL DEFAULT 0,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `daily_store_metrics_id` PRIMARY KEY(`id`),
	CONSTRAINT `dsm_uq` UNIQUE(`storeId`,`date`)
);
--> statement-breakpoint
CREATE TABLE `delivery_zones` (
	`id` int AUTO_INCREMENT NOT NULL,
	`storeId` int NOT NULL,
	`name` varchar(80) NOT NULL,
	`nameBn` varchar(80),
	`districtsJson` json NOT NULL,
	`charge` decimal(14,2) NOT NULL,
	`freeAbove` decimal(14,2),
	`etaText` varchar(60),
	`sortOrder` int NOT NULL DEFAULT 0,
	`status` enum('active','inactive') NOT NULL DEFAULT 'active',
	CONSTRAINT `delivery_zones_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `domains` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tenantId` int NOT NULL,
	`storeId` int NOT NULL,
	`host` varchar(253) NOT NULL,
	`type` enum('subdomain','custom') NOT NULL,
	`verificationToken` varchar(64),
	`verificationStatus` enum('pending','verified','active','failed','suspended') NOT NULL DEFAULT 'pending',
	`tlsStatus` enum('none','pending','issued','failed') NOT NULL DEFAULT 'none',
	`isPrimary` boolean NOT NULL DEFAULT false,
	`lastCheckedAt` timestamp,
	`lastError` varchar(255),
	`verifiedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `domains_id` PRIMARY KEY(`id`),
	CONSTRAINT `domains_host_unique` UNIQUE(`host`)
);
--> statement-breakpoint
CREATE TABLE `fee_ledger` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tenantId` int NOT NULL,
	`storeId` int NOT NULL,
	`orderId` int,
	`orderNo` varchar(24),
	`feeType` enum('order_overage','courier_payment_charge','reversal') NOT NULL,
	`reversesId` int,
	`baseAmount` decimal(14,2) NOT NULL,
	`rate` decimal(7,4) NOT NULL,
	`feeAmount` decimal(14,2) NOT NULL,
	`status` enum('pending','invoiced','paid','void') NOT NULL DEFAULT 'pending',
	`voidReason` varchar(255),
	`invoiceId` int,
	`periodStart` date NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `fee_ledger_id` PRIMARY KEY(`id`),
	CONSTRAINT `fee_order_type_uq` UNIQUE(`orderId`,`feeType`,`reversesId`)
);
--> statement-breakpoint
CREATE TABLE `impersonation_sessions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`adminUserId` int NOT NULL,
	`tenantId` int NOT NULL,
	`reason` varchar(255) NOT NULL,
	`ticketRef` varchar(80) NOT NULL,
	`startedAt` timestamp NOT NULL DEFAULT (now()),
	`expiresAt` timestamp NOT NULL,
	`endedAt` timestamp,
	CONSTRAINT `impersonation_sessions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `inventory_movements` (
	`id` int AUTO_INCREMENT NOT NULL,
	`storeId` int NOT NULL,
	`variantId` int NOT NULL,
	`type` enum('initial','adjustment','sale','reserve','release','cancel_restock','return','import') NOT NULL,
	`quantityDelta` int NOT NULL,
	`affects` enum('stock','reserved') NOT NULL DEFAULT 'stock',
	`balanceAfter` int,
	`reason` varchar(255),
	`referenceType` varchar(40),
	`referenceId` varchar(40),
	`actorId` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `inventory_movements_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `invoice_lines` (
	`id` int AUTO_INCREMENT NOT NULL,
	`invoiceId` int NOT NULL,
	`type` enum('subscription','order_overage','courier_payment_charge','reversal','adjustment') NOT NULL,
	`description` varchar(255) NOT NULL,
	`orderId` int,
	`orderNo` varchar(24),
	`feeLedgerId` int,
	`baseAmount` decimal(14,2),
	`rate` decimal(7,4),
	`amount` decimal(14,2) NOT NULL,
	CONSTRAINT `invoice_lines_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `invoices` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tenantId` int NOT NULL,
	`subscriptionId` int,
	`number` varchar(32) NOT NULL,
	`kind` enum('subscription','renewal','usage','upgrade') NOT NULL,
	`planId` int,
	`billingCycle` enum('monthly','yearly'),
	`periodStart` timestamp,
	`periodEnd` timestamp,
	`subtotal` decimal(14,2) NOT NULL,
	`discount` decimal(14,2) NOT NULL DEFAULT '0.00',
	`tax` decimal(14,2) NOT NULL DEFAULT '0.00',
	`total` decimal(14,2) NOT NULL,
	`status` enum('draft','open','paid','void','uncollectible') NOT NULL DEFAULT 'open',
	`dueAt` timestamp NOT NULL,
	`paidAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `invoices_id` PRIMARY KEY(`id`),
	CONSTRAINT `invoices_number_unique` UNIQUE(`number`)
);
--> statement-breakpoint
CREATE TABLE `jobs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`type` varchar(40) NOT NULL,
	`tenantId` int,
	`payloadJson` json NOT NULL,
	`status` enum('queued','running','succeeded','failed','dead') NOT NULL DEFAULT 'queued',
	`attempts` int NOT NULL DEFAULT 0,
	`maxAttempts` int NOT NULL DEFAULT 5,
	`runAt` timestamp NOT NULL DEFAULT (now()),
	`lockedAt` timestamp,
	`lastError` text,
	`resultJson` json,
	`dedupeKey` varchar(160),
	`createdBy` int,
	`finishedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `jobs_id` PRIMARY KEY(`id`),
	CONSTRAINT `jobs_dedupeKey_unique` UNIQUE(`dedupeKey`)
);
--> statement-breakpoint
CREATE TABLE `login_events` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int,
	`identifier` varchar(320),
	`method` enum('password','otp','refresh','two_factor','logout','otp_request') NOT NULL,
	`success` boolean NOT NULL,
	`reason` varchar(128),
	`suspicious` boolean NOT NULL DEFAULT false,
	`ip` varchar(64),
	`userAgent` varchar(512),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `login_events_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `memberships` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tenantId` int NOT NULL,
	`userId` int,
	`roleId` int NOT NULL,
	`status` enum('invited','active','revoked') NOT NULL DEFAULT 'active',
	`inviteEmail` varchar(320),
	`inviteTokenHash` varchar(64),
	`invitedBy` int,
	`invitedAt` timestamp,
	`acceptedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `memberships_id` PRIMARY KEY(`id`),
	CONSTRAINT `memberships_tenant_user_uq` UNIQUE(`tenantId`,`userId`)
);
--> statement-breakpoint
CREATE TABLE `notifications` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`tenantId` int,
	`type` varchar(60) NOT NULL,
	`title` varchar(200) NOT NULL,
	`body` text,
	`link` varchar(255),
	`payloadJson` json,
	`dedupeKey` varchar(160),
	`readAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `notifications_id` PRIMARY KEY(`id`),
	CONSTRAINT `notifications_dedupeKey_unique` UNIQUE(`dedupeKey`)
);
--> statement-breakpoint
CREATE TABLE `order_events` (
	`id` int AUTO_INCREMENT NOT NULL,
	`orderId` int NOT NULL,
	`eventType` enum('status_change','note','payment','shipment','refund','created') NOT NULL,
	`fromStatus` varchar(24),
	`toStatus` varchar(24),
	`actorType` enum('customer','merchant','system','admin','gateway','courier','api') NOT NULL,
	`actorId` int,
	`note` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `order_events_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `order_items` (
	`id` int AUTO_INCREMENT NOT NULL,
	`orderId` int NOT NULL,
	`productId` int NOT NULL,
	`variantId` int NOT NULL,
	`nameSnapshot` varchar(200) NOT NULL,
	`skuSnapshot` varchar(80),
	`variantSnapshot` varchar(200),
	`imageSnapshot` varchar(512),
	`quantity` int NOT NULL,
	`unitPrice` decimal(14,2) NOT NULL,
	`discountTotal` decimal(14,2) NOT NULL DEFAULT '0.00',
	`lineTotal` decimal(14,2) NOT NULL,
	`refundedQty` int NOT NULL DEFAULT 0,
	CONSTRAINT `order_items_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `orders` (
	`id` int AUTO_INCREMENT NOT NULL,
	`storeId` int NOT NULL,
	`tenantId` int NOT NULL,
	`orderNo` varchar(24) NOT NULL,
	`customerId` int,
	`status` enum('PENDING_PAYMENT','PAID','CONFIRMED','PROCESSING','SHIPPED','DELIVERED','CANCELLED','REFUNDED','RETURN_REQUESTED','RETURNED') NOT NULL DEFAULT 'PENDING_PAYMENT',
	`paymentStatus` enum('unpaid','pending','paid','failed','refunded','partially_refunded','cod_pending','cod_collected') NOT NULL DEFAULT 'unpaid',
	`fulfillmentStatus` enum('unfulfilled','packed','shipped','delivered','returned','cancelled') NOT NULL DEFAULT 'unfulfilled',
	`paymentMethod` varchar(20) NOT NULL,
	`subtotal` decimal(14,2) NOT NULL,
	`discountTotal` decimal(14,2) NOT NULL DEFAULT '0.00',
	`shippingTotal` decimal(14,2) NOT NULL DEFAULT '0.00',
	`taxTotal` decimal(14,2) NOT NULL DEFAULT '0.00',
	`grandTotal` decimal(14,2) NOT NULL,
	`refundedTotal` decimal(14,2) NOT NULL DEFAULT '0.00',
	`currency` varchar(3) NOT NULL DEFAULT 'BDT',
	`couponCode` varchar(40),
	`customerSnapshotJson` json NOT NULL,
	`addressSnapshotJson` json NOT NULL,
	`deliverySnapshotJson` json,
	`taxSnapshotJson` json,
	`customerNote` text,
	`idempotencyKey` varchar(80),
	`accessToken` varchar(48) NOT NULL,
	`stockCommitted` boolean NOT NULL DEFAULT false,
	`feeEligibleAt` timestamp,
	`source` enum('storefront','admin','api') NOT NULL DEFAULT 'storefront',
	`locale` varchar(5) NOT NULL DEFAULT 'bn',
	`cancelledAt` timestamp,
	`deliveredAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `orders_id` PRIMARY KEY(`id`),
	CONSTRAINT `orders_store_no_uq` UNIQUE(`storeId`,`orderNo`),
	CONSTRAINT `orders_idem_uq` UNIQUE(`storeId`,`idempotencyKey`)
);
--> statement-breakpoint
CREATE TABLE `otp_codes` (
	`id` int AUTO_INCREMENT NOT NULL,
	`phone` varchar(20) NOT NULL,
	`purpose` enum('verify_phone','login','password_reset','customer_lookup') NOT NULL,
	`codeHash` varchar(64) NOT NULL,
	`attempts` int NOT NULL DEFAULT 0,
	`expiresAt` timestamp NOT NULL,
	`consumedAt` timestamp,
	`ip` varchar(64),
	`deviceId` varchar(64),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `otp_codes_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `outbound_messages` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tenantId` int,
	`channel` enum('sms','email','whatsapp') NOT NULL,
	`recipient` varchar(320) NOT NULL,
	`subject` varchar(200),
	`body` text NOT NULL,
	`template` varchar(60) NOT NULL,
	`provider` varchar(40) NOT NULL,
	`deviceId` varchar(64),
	`status` enum('queued','sent','failed') NOT NULL DEFAULT 'sent',
	`error` varchar(255),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `outbound_messages_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `payment_methods` (
	`id` int AUTO_INCREMENT NOT NULL,
	`storeId` int NOT NULL,
	`provider` enum('bkash','nagad','sslcommerz','cod') NOT NULL,
	`mode` enum('sandbox','live') NOT NULL DEFAULT 'sandbox',
	`publicConfigJson` json,
	`encryptedSecretRef` text,
	`status` enum('active','inactive') NOT NULL DEFAULT 'active',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `payment_methods_id` PRIMARY KEY(`id`),
	CONSTRAINT `payment_methods_uq` UNIQUE(`storeId`,`provider`)
);
--> statement-breakpoint
CREATE TABLE `payment_webhook_events` (
	`id` int AUTO_INCREMENT NOT NULL,
	`provider` varchar(20) NOT NULL,
	`eventKey` varchar(120) NOT NULL,
	`signatureValid` boolean NOT NULL,
	`payloadHash` varchar(64) NOT NULL,
	`payloadJson` json,
	`paymentReference` varchar(40),
	`status` enum('received','processed','duplicate','rejected','failed','ignored') NOT NULL DEFAULT 'received',
	`error` varchar(255),
	`processedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `payment_webhook_events_id` PRIMARY KEY(`id`),
	CONSTRAINT `pwe_provider_event_uq` UNIQUE(`provider`,`eventKey`)
);
--> statement-breakpoint
CREATE TABLE `payments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`scope` enum('order','platform_invoice') NOT NULL,
	`tenantId` int NOT NULL,
	`storeId` int,
	`orderId` int,
	`invoiceId` int,
	`provider` enum('bkash','nagad','sslcommerz','cod') NOT NULL,
	`reference` varchar(40) NOT NULL,
	`providerTxnId` varchar(80),
	`amount` decimal(14,2) NOT NULL,
	`feeAmount` decimal(14,2) NOT NULL DEFAULT '0.00',
	`status` enum('initiated','pending','succeeded','failed','expired','refunded','cancelled') NOT NULL DEFAULT 'initiated',
	`failureReason` varchar(255),
	`idempotencyKey` varchar(80),
	`rawReference` json,
	`settlementStatus` enum('unsettled','settled','not_applicable') NOT NULL DEFAULT 'unsettled',
	`settledAt` timestamp,
	`expiresAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `payments_id` PRIMARY KEY(`id`),
	CONSTRAINT `payments_reference_unique` UNIQUE(`reference`),
	CONSTRAINT `payments_idem_uq` UNIQUE(`idempotencyKey`)
);
--> statement-breakpoint
CREATE TABLE `plans` (
	`id` int AUTO_INCREMENT NOT NULL,
	`code` varchar(20) NOT NULL,
	`name` varchar(60) NOT NULL,
	`tagline` varchar(160),
	`priceMonthly` decimal(14,2) NOT NULL,
	`priceYearly` decimal(14,2) NOT NULL,
	`limitsJson` json NOT NULL,
	`featuresJson` json NOT NULL,
	`status` enum('active','hidden') NOT NULL DEFAULT 'active',
	`sortOrder` int NOT NULL DEFAULT 0,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `plans_id` PRIMARY KEY(`id`),
	CONSTRAINT `plans_code_unique` UNIQUE(`code`)
);
--> statement-breakpoint
CREATE TABLE `platform_settings` (
	`key` varchar(80) NOT NULL,
	`valueJson` json NOT NULL,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `platform_settings_key` PRIMARY KEY(`key`)
);
--> statement-breakpoint
CREATE TABLE `product_images` (
	`id` int AUTO_INCREMENT NOT NULL,
	`productId` int NOT NULL,
	`assetId` int,
	`url` varchar(512) NOT NULL,
	`sortOrder` int NOT NULL DEFAULT 0,
	`altText` varchar(200),
	CONSTRAINT `product_images_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `product_variants` (
	`id` int AUTO_INCREMENT NOT NULL,
	`productId` int NOT NULL,
	`storeId` int NOT NULL,
	`sku` varchar(80),
	`optionValuesJson` json,
	`price` decimal(14,2) NOT NULL,
	`comparePrice` decimal(14,2),
	`stockQty` int NOT NULL DEFAULT 0,
	`reservedQty` int NOT NULL DEFAULT 0,
	`isDefault` boolean NOT NULL DEFAULT false,
	`status` enum('active','inactive') NOT NULL DEFAULT 'active',
	CONSTRAINT `product_variants_id` PRIMARY KEY(`id`),
	CONSTRAINT `variants_store_sku_uq` UNIQUE(`storeId`,`sku`)
);
--> statement-breakpoint
CREATE TABLE `products` (
	`id` int AUTO_INCREMENT NOT NULL,
	`storeId` int NOT NULL,
	`categoryId` int,
	`name` varchar(200) NOT NULL,
	`nameBn` varchar(200),
	`slug` varchar(200) NOT NULL,
	`descriptionJson` json,
	`status` enum('draft','active','archived') NOT NULL DEFAULT 'active',
	`tagsJson` json,
	`seoJson` json,
	`optionNamesJson` json,
	`lowStockThreshold` int NOT NULL DEFAULT 5,
	`featured` boolean NOT NULL DEFAULT false,
	`deletedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `products_id` PRIMARY KEY(`id`),
	CONSTRAINT `products_store_slug_uq` UNIQUE(`storeId`,`slug`)
);
--> statement-breakpoint
CREATE TABLE `rate_limit_events` (
	`id` int AUTO_INCREMENT NOT NULL,
	`scope` varchar(40) NOT NULL,
	`key` varchar(160) NOT NULL,
	`ip` varchar(64),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `rate_limit_events_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `refund_requests` (
	`id` int AUTO_INCREMENT NOT NULL,
	`orderId` int NOT NULL,
	`storeId` int NOT NULL,
	`tenantId` int NOT NULL,
	`amount` decimal(14,2) NOT NULL,
	`isFull` boolean NOT NULL,
	`itemsJson` json,
	`reason` text,
	`method` varchar(20) NOT NULL,
	`status` enum('requested','processed','rejected','failed') NOT NULL DEFAULT 'requested',
	`providerRefundId` varchar(80),
	`requestedBy` int,
	`reviewedBy` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`processedAt` timestamp,
	CONSTRAINT `refund_requests_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `returns` (
	`id` int AUTO_INCREMENT NOT NULL,
	`orderId` int NOT NULL,
	`storeId` int NOT NULL,
	`status` enum('requested','approved','rejected','received') NOT NULL DEFAULT 'requested',
	`reason` text,
	`requestedAt` timestamp NOT NULL DEFAULT (now()),
	`resolvedAt` timestamp,
	CONSTRAINT `returns_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `roles` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tenantId` int,
	`code` varchar(40) NOT NULL,
	`name` varchar(80) NOT NULL,
	`permissionsJson` json NOT NULL,
	`isSystem` boolean NOT NULL DEFAULT false,
	CONSTRAINT `roles_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `sandbox_gateway_transactions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`provider` varchar(20) NOT NULL,
	`reference` varchar(40) NOT NULL,
	`providerTxnId` varchar(80) NOT NULL,
	`amount` decimal(14,2) NOT NULL,
	`status` enum('pending','succeeded','failed','cancelled','refunded') NOT NULL DEFAULT 'pending',
	`callbackUrl` varchar(512),
	`merchantName` varchar(160),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `sandbox_gateway_transactions_id` PRIMARY KEY(`id`),
	CONSTRAINT `sandbox_gateway_transactions_reference_unique` UNIQUE(`reference`)
);
--> statement-breakpoint
CREATE TABLE `sessions` (
	`id` varchar(32) NOT NULL,
	`userId` int NOT NULL,
	`familyId` varchar(32) NOT NULL,
	`refreshTokenHash` varchar(64) NOT NULL,
	`prevRefreshHash` varchar(64),
	`rotatedAt` timestamp,
	`expiresAt` timestamp NOT NULL,
	`revokedAt` timestamp,
	`revokeReason` varchar(64),
	`twoFactorPassed` boolean NOT NULL DEFAULT false,
	`ip` varchar(64),
	`userAgent` varchar(512),
	`lastUsedAt` timestamp NOT NULL DEFAULT (now()),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `sessions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `shipments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`orderId` int NOT NULL,
	`storeId` int NOT NULL,
	`provider` enum('pathao','steadfast','redx','paperfly','manual') NOT NULL,
	`consignmentId` varchar(80),
	`trackingCode` varchar(80),
	`status` enum('created','picked_up','in_transit','delivered','returned','cancelled') NOT NULL DEFAULT 'created',
	`codAmount` decimal(14,2) NOT NULL DEFAULT '0.00',
	`charge` decimal(14,2) NOT NULL DEFAULT '0.00',
	`eventsJson` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `shipments_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `store_settings` (
	`storeId` int NOT NULL,
	`locale` varchar(5) NOT NULL DEFAULT 'bn',
	`addressJson` json,
	`contactJson` json,
	`seoJson` json,
	`checkoutJson` json,
	`taxJson` json,
	`notificationsJson` json,
	`onboardingJson` json,
	`scheduledExport` varchar(20),
	CONSTRAINT `store_settings_storeId` PRIMARY KEY(`storeId`)
);
--> statement-breakpoint
CREATE TABLE `store_themes` (
	`id` int AUTO_INCREMENT NOT NULL,
	`storeId` int NOT NULL,
	`themeVersionId` int NOT NULL,
	`draftConfigJson` json NOT NULL,
	`publishedConfigJson` json,
	`isSelected` boolean NOT NULL DEFAULT false,
	`lockedUntil` timestamp,
	`publishedAt` timestamp,
	`draftUpdatedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `store_themes_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `stores` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tenantId` int NOT NULL,
	`name` varchar(160) NOT NULL,
	`slug` varchar(63) NOT NULL,
	`description` text,
	`category` varchar(60),
	`logoAssetId` int,
	`logoUrl` varchar(512),
	`brandColorsJson` json,
	`status` enum('draft','published','maintenance','suspended') NOT NULL DEFAULT 'draft',
	`orderSeq` int NOT NULL DEFAULT 1000,
	`publishedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `stores_id` PRIMARY KEY(`id`),
	CONSTRAINT `stores_slug_unique` UNIQUE(`slug`)
);
--> statement-breakpoint
CREATE TABLE `subscriptions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tenantId` int NOT NULL,
	`planId` int NOT NULL,
	`trialPlanId` int,
	`pendingPlanId` int,
	`pendingCycle` enum('monthly','yearly'),
	`billingCycle` enum('monthly','yearly') NOT NULL DEFAULT 'monthly',
	`status` enum('TRIALING','ACTIVE','PAST_DUE','GRACE_PERIOD','READ_ONLY','SUSPENDED','CANCELLED') NOT NULL,
	`isCurrent` boolean NOT NULL DEFAULT true,
	`trialEnd` timestamp,
	`currentPeriodStart` timestamp NOT NULL,
	`currentPeriodEnd` timestamp NOT NULL,
	`cancelAtPeriodEnd` boolean NOT NULL DEFAULT false,
	`autoRenew` boolean NOT NULL DEFAULT true,
	`savedMethodJson` json,
	`pastDueSince` timestamp,
	`retryCount` int NOT NULL DEFAULT 0,
	`nextRetryAt` timestamp,
	`cancelledAt` timestamp,
	`remindersSentJson` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `subscriptions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `support_tickets` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tenantId` int,
	`requesterId` int,
	`requesterName` varchar(160),
	`requesterEmail` varchar(320),
	`requesterPhone` varchar(20),
	`category` varchar(40) NOT NULL DEFAULT 'general',
	`priority` enum('low','normal','high','urgent') NOT NULL DEFAULT 'normal',
	`status` enum('open','pending','resolved','closed') NOT NULL DEFAULT 'open',
	`subject` varchar(200) NOT NULL,
	`body` text NOT NULL,
	`assignedTo` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `support_tickets_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `tenants` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(160) NOT NULL,
	`ownerUserId` int NOT NULL,
	`status` enum('active','suspended','closed') NOT NULL DEFAULT 'active',
	`verificationStatus` enum('unverified','pending','verified','rejected') NOT NULL DEFAULT 'unverified',
	`timezone` varchar(40) NOT NULL DEFAULT 'Asia/Dhaka',
	`currency` varchar(3) NOT NULL DEFAULT 'BDT',
	`suspendedReason` varchar(255),
	`lastActivityAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `tenants_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `theme_versions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`themeId` int NOT NULL,
	`version` varchar(20) NOT NULL,
	`configSchemaJson` json NOT NULL,
	`defaultConfigJson` json NOT NULL,
	`compatiblePlansJson` json NOT NULL,
	`assetManifestJson` json NOT NULL,
	`status` enum('draft','published','deprecated') NOT NULL DEFAULT 'draft',
	`changelog` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `theme_versions_id` PRIMARY KEY(`id`),
	CONSTRAINT `theme_versions_uq` UNIQUE(`themeId`,`version`)
);
--> statement-breakpoint
CREATE TABLE `themes` (
	`id` int AUTO_INCREMENT NOT NULL,
	`code` varchar(40) NOT NULL,
	`name` varchar(80) NOT NULL,
	`description` text,
	`industry` varchar(60),
	`styleTagsJson` json,
	`tier` enum('starter','curated','standard','pro_exclusive') NOT NULL,
	`previewImageUrl` varchar(512),
	`status` enum('draft','active','deprecated') NOT NULL DEFAULT 'active',
	`sortOrder` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `themes_id` PRIMARY KEY(`id`),
	CONSTRAINT `themes_code_unique` UNIQUE(`code`)
);
--> statement-breakpoint
CREATE TABLE `ticket_messages` (
	`id` int AUTO_INCREMENT NOT NULL,
	`ticketId` int NOT NULL,
	`authorId` int,
	`authorType` enum('merchant','staff','guest') NOT NULL,
	`body` text NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `ticket_messages_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `usage_counters` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tenantId` int NOT NULL,
	`metric` varchar(40) NOT NULL,
	`periodStart` date NOT NULL,
	`periodEnd` date NOT NULL,
	`quantity` bigint NOT NULL DEFAULT 0,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `usage_counters_id` PRIMARY KEY(`id`),
	CONSTRAINT `usage_uq` UNIQUE(`tenantId`,`metric`,`periodStart`)
);
--> statement-breakpoint
CREATE TABLE `webhook_deliveries` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tenantId` int NOT NULL,
	`endpointId` int NOT NULL,
	`eventType` varchar(60) NOT NULL,
	`endpoint` varchar(512) NOT NULL,
	`payloadHash` varchar(64) NOT NULL,
	`payloadJson` json NOT NULL,
	`status` enum('pending','delivered','failed','dead') NOT NULL DEFAULT 'pending',
	`attempts` int NOT NULL DEFAULT 0,
	`lastStatusCode` int,
	`lastError` varchar(255),
	`nextRetryAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `webhook_deliveries_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `webhook_endpoints` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tenantId` int NOT NULL,
	`storeId` int NOT NULL,
	`url` varchar(512) NOT NULL,
	`eventsJson` json NOT NULL,
	`secretEnc` text NOT NULL,
	`status` enum('active','disabled') NOT NULL DEFAULT 'active',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `webhook_endpoints_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `users` MODIFY COLUMN `openId` varchar(64);--> statement-breakpoint
ALTER TABLE `users` ADD `phone` varchar(20);--> statement-breakpoint
ALTER TABLE `users` ADD `passwordHash` varchar(100);--> statement-breakpoint
ALTER TABLE `users` ADD `status` enum('active','suspended','pending_deletion','deleted') DEFAULT 'active' NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `platformRole` enum('none','super_admin','support','finance','template_manager') DEFAULT 'none' NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `phoneVerifiedAt` timestamp;--> statement-breakpoint
ALTER TABLE `users` ADD `emailVerifiedAt` timestamp;--> statement-breakpoint
ALTER TABLE `users` ADD `twoFactorEnabled` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `twoFactorSecretEnc` text;--> statement-breakpoint
ALTER TABLE `users` ADD `locale` varchar(5) DEFAULT 'en' NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD CONSTRAINT `users_email_unique` UNIQUE(`email`);--> statement-breakpoint
ALTER TABLE `users` ADD CONSTRAINT `users_phone_unique` UNIQUE(`phone`);--> statement-breakpoint
CREATE INDEX `analytics_event_idx` ON `analytics_events` (`event`,`createdAt`);--> statement-breakpoint
CREATE INDEX `analytics_tenant_idx` ON `analytics_events` (`tenantId`);--> statement-breakpoint
CREATE INDEX `assets_tenant_idx` ON `assets` (`tenantId`);--> statement-breakpoint
CREATE INDEX `audit_tenant_idx` ON `audit_logs` (`tenantId`,`createdAt`);--> statement-breakpoint
CREATE INDEX `audit_created_idx` ON `audit_logs` (`createdAt`);--> statement-breakpoint
CREATE INDEX `coupon_red_coupon_idx` ON `coupon_redemptions` (`couponId`);--> statement-breakpoint
CREATE INDEX `domains_store_idx` ON `domains` (`storeId`);--> statement-breakpoint
CREATE INDEX `fee_tenant_idx` ON `fee_ledger` (`tenantId`,`status`);--> statement-breakpoint
CREATE INDEX `inv_mov_store_idx` ON `inventory_movements` (`storeId`,`createdAt`);--> statement-breakpoint
CREATE INDEX `inv_mov_variant_idx` ON `inventory_movements` (`variantId`);--> statement-breakpoint
CREATE INDEX `invoice_lines_invoice_idx` ON `invoice_lines` (`invoiceId`);--> statement-breakpoint
CREATE INDEX `invoices_tenant_idx` ON `invoices` (`tenantId`,`createdAt`);--> statement-breakpoint
CREATE INDEX `jobs_status_run_idx` ON `jobs` (`status`,`runAt`);--> statement-breakpoint
CREATE INDEX `jobs_tenant_idx` ON `jobs` (`tenantId`);--> statement-breakpoint
CREATE INDEX `login_events_created_idx` ON `login_events` (`createdAt`);--> statement-breakpoint
CREATE INDEX `login_events_user_idx` ON `login_events` (`userId`);--> statement-breakpoint
CREATE INDEX `memberships_user_idx` ON `memberships` (`userId`);--> statement-breakpoint
CREATE INDEX `notifications_user_idx` ON `notifications` (`userId`,`createdAt`);--> statement-breakpoint
CREATE INDEX `order_events_order_idx` ON `order_events` (`orderId`);--> statement-breakpoint
CREATE INDEX `order_items_order_idx` ON `order_items` (`orderId`);--> statement-breakpoint
CREATE INDEX `orders_store_status_idx` ON `orders` (`storeId`,`status`,`createdAt`);--> statement-breakpoint
CREATE INDEX `orders_tenant_created_idx` ON `orders` (`tenantId`,`createdAt`);--> statement-breakpoint
CREATE INDEX `otp_phone_idx` ON `otp_codes` (`phone`,`purpose`);--> statement-breakpoint
CREATE INDEX `outbound_recipient_idx` ON `outbound_messages` (`recipient`,`createdAt`);--> statement-breakpoint
CREATE INDEX `outbound_device_idx` ON `outbound_messages` (`deviceId`);--> statement-breakpoint
CREATE INDEX `pwe_created_idx` ON `payment_webhook_events` (`createdAt`);--> statement-breakpoint
CREATE INDEX `payments_order_idx` ON `payments` (`orderId`);--> statement-breakpoint
CREATE INDEX `payments_tenant_idx` ON `payments` (`tenantId`,`createdAt`);--> statement-breakpoint
CREATE INDEX `product_images_product_idx` ON `product_images` (`productId`);--> statement-breakpoint
CREATE INDEX `variants_product_idx` ON `product_variants` (`productId`);--> statement-breakpoint
CREATE INDEX `products_store_status_idx` ON `products` (`storeId`,`status`);--> statement-breakpoint
CREATE INDEX `rl_created_idx` ON `rate_limit_events` (`createdAt`);--> statement-breakpoint
CREATE INDEX `refunds_store_idx` ON `refund_requests` (`storeId`);--> statement-breakpoint
CREATE INDEX `sessions_user_idx` ON `sessions` (`userId`);--> statement-breakpoint
CREATE INDEX `shipments_order_idx` ON `shipments` (`orderId`);--> statement-breakpoint
CREATE INDEX `shipments_tracking_idx` ON `shipments` (`trackingCode`);--> statement-breakpoint
CREATE INDEX `store_themes_store_idx` ON `store_themes` (`storeId`);--> statement-breakpoint
CREATE INDEX `stores_tenant_idx` ON `stores` (`tenantId`);--> statement-breakpoint
CREATE INDEX `subs_tenant_idx` ON `subscriptions` (`tenantId`,`isCurrent`);--> statement-breakpoint
CREATE INDEX `subs_status_idx` ON `subscriptions` (`status`);--> statement-breakpoint
CREATE INDEX `tickets_tenant_idx` ON `support_tickets` (`tenantId`);--> statement-breakpoint
CREATE INDEX `wh_deliveries_tenant_idx` ON `webhook_deliveries` (`tenantId`,`createdAt`);