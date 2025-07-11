CREATE TABLE `aiStyles` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`shopId` text NOT NULL,
	`name` text NOT NULL,
	`promptTemplate` text NOT NULL,
	`negativePrompt` text,
	`exampleImageUrl` text,
	`isActive` integer DEFAULT true,
	`sortOrder` integer DEFAULT 0,
	`usageCount` integer DEFAULT 0,
	`createdAt` text NOT NULL,
	`updatedAt` text NOT NULL,
	FOREIGN KEY (`shopId`) REFERENCES `shops`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `ai_styles_shop_id_idx` ON `aiStyles` (`shopId`);--> statement-breakpoint
CREATE TABLE `generations` (
	`id` text PRIMARY KEY NOT NULL,
	`shopId` text NOT NULL,
	`productId` integer NOT NULL,
	`sizeId` integer NOT NULL,
	`aiStyleId` integer NOT NULL,
	`orderId` text,
	`customerId` text,
	`inputImageUrl` text NOT NULL,
	`previewImageUrl` text,
	`finalImageUrl` text,
	`generationType` text NOT NULL,
	`status` text DEFAULT 'pending',
	`aiPromptUsed` text NOT NULL,
	`errorMessage` text,
	`processingTimeMs` integer,
	`aiModelUsed` text,
	`generationParams` text,
	`upscaleStatus` text DEFAULT 'not_needed',
	`upscaleFactor` real,
	`originalWidth` integer,
	`originalHeight` integer,
	`finalWidth` integer,
	`finalHeight` integer,
	`upscaleStartedAt` text,
	`upscaleCompletedAt` text,
	`createdAt` text NOT NULL,
	`updatedAt` text NOT NULL,
	FOREIGN KEY (`shopId`) REFERENCES `shops`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`productId`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`sizeId`) REFERENCES `sizes`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`aiStyleId`) REFERENCES `aiStyles`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `generations_shop_id_idx` ON `generations` (`shopId`);--> statement-breakpoint
CREATE INDEX `generations_status_idx` ON `generations` (`status`);--> statement-breakpoint
CREATE INDEX `generations_type_idx` ON `generations` (`generationType`);--> statement-breakpoint
CREATE INDEX `generations_upscale_status_idx` ON `generations` (`upscaleStatus`);--> statement-breakpoint
CREATE INDEX `generations_created_at_idx` ON `generations` (`createdAt`);--> statement-breakpoint
CREATE TABLE `orders` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`shopId` text NOT NULL,
	`shopifyOrderId` text NOT NULL,
	`customerId` text,
	`orderNumber` text,
	`totalPrice` real,
	`status` text,
	`createdAt` text NOT NULL,
	`updatedAt` text NOT NULL,
	FOREIGN KEY (`shopId`) REFERENCES `shops`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `orders_shop_shopify_order_unique` ON `orders` (`shopId`,`shopifyOrderId`);--> statement-breakpoint
CREATE TABLE `products` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`shopId` text NOT NULL,
	`shopifyProductId` text NOT NULL,
	`title` text NOT NULL,
	`handle` text NOT NULL,
	`isEnabled` integer DEFAULT true,
	`createdAt` text NOT NULL,
	`updatedAt` text NOT NULL,
	FOREIGN KEY (`shopId`) REFERENCES `shops`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `products_shop_shopify_product_unique` ON `products` (`shopId`,`shopifyProductId`);--> statement-breakpoint
CREATE INDEX `products_shop_id_idx` ON `products` (`shopId`);--> statement-breakpoint
CREATE TABLE `quotas` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`shopId` text NOT NULL,
	`monthlyGenerationLimit` integer DEFAULT 500,
	`storageQuotaMb` integer DEFAULT 1000,
	`maxConcurrentGenerations` integer DEFAULT 3,
	`currentGenerations` integer DEFAULT 0,
	`currentStorageMb` real DEFAULT 0,
	`lastResetDate` text NOT NULL,
	`totalGenerations` integer DEFAULT 0,
	`createdAt` text NOT NULL,
	`updatedAt` text NOT NULL,
	FOREIGN KEY (`shopId`) REFERENCES `shops`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `quotas_shop_unique` ON `quotas` (`shopId`);--> statement-breakpoint
CREATE TABLE `sizes` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`productId` integer NOT NULL,
	`name` text NOT NULL,
	`widthPx` integer NOT NULL,
	`heightPx` integer NOT NULL,
	`isActive` integer DEFAULT true,
	`sortOrder` integer DEFAULT 0,
	`createdAt` text NOT NULL,
	`updatedAt` text NOT NULL,
	FOREIGN KEY (`productId`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `sizes_product_id_idx` ON `sizes` (`productId`);--> statement-breakpoint
CREATE TABLE `watermarks` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`shopId` text NOT NULL,
	`imageUrl` text NOT NULL,
	`opacity` real DEFAULT 0.3,
	`position` text DEFAULT 'bottom-right',
	`sizePercentage` real DEFAULT 10,
	`isActive` integer DEFAULT true,
	`createdAt` text NOT NULL,
	`updatedAt` text NOT NULL,
	FOREIGN KEY (`shopId`) REFERENCES `shops`(`id`) ON UPDATE no action ON DELETE cascade
);
