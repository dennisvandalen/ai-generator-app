CREATE TABLE `aiStyles` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`uuid` text NOT NULL,
	`shopId` text NOT NULL,
	`name` text NOT NULL,
	`promptTemplate` text NOT NULL,
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
CREATE UNIQUE INDEX `ai_styles_uuid_unique` ON `aiStyles` (`uuid`);--> statement-breakpoint
CREATE TABLE `generations` (
	`id` text PRIMARY KEY NOT NULL,
	`shopId` text NOT NULL,
	`productId` integer NOT NULL,
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
CREATE TABLE `productBaseOptions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`productBaseId` integer NOT NULL,
	`name` text NOT NULL,
	`sortOrder` integer DEFAULT 0,
	`createdAt` text NOT NULL,
	`updatedAt` text NOT NULL,
	FOREIGN KEY (`productBaseId`) REFERENCES `productBases`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `product_base_options_product_base_id_idx` ON `productBaseOptions` (`productBaseId`);--> statement-breakpoint
CREATE UNIQUE INDEX `product_base_options_product_base_id_name_unique` ON `productBaseOptions` (`productBaseId`,`name`);--> statement-breakpoint
CREATE TABLE `productBaseVariantMappings` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`productId` integer NOT NULL,
	`productBaseVariantId` integer NOT NULL,
	`shopifyVariantId` integer NOT NULL,
	`isActive` integer DEFAULT true,
	`createdAt` text NOT NULL,
	`updatedAt` text NOT NULL,
	FOREIGN KEY (`productId`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`productBaseVariantId`) REFERENCES `productBaseVariants`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `product_base_variant_mappings_unique` ON `productBaseVariantMappings` (`productId`,`productBaseVariantId`,`shopifyVariantId`);--> statement-breakpoint
CREATE INDEX `product_base_variant_mappings_product_id_idx` ON `productBaseVariantMappings` (`productId`);--> statement-breakpoint
CREATE INDEX `product_base_variant_mappings_product_base_variant_id_idx` ON `productBaseVariantMappings` (`productBaseVariantId`);--> statement-breakpoint
CREATE INDEX `product_base_variant_mappings_shopify_variant_id_idx` ON `productBaseVariantMappings` (`shopifyVariantId`);--> statement-breakpoint
CREATE TABLE `productBaseVariantOptionValues` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`productBaseVariantId` integer NOT NULL,
	`productBaseOptionId` integer NOT NULL,
	`value` text NOT NULL,
	`createdAt` text NOT NULL,
	`updatedAt` text NOT NULL,
	FOREIGN KEY (`productBaseVariantId`) REFERENCES `productBaseVariants`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`productBaseOptionId`) REFERENCES `productBaseOptions`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `product_base_variant_option_values_variant_id_idx` ON `productBaseVariantOptionValues` (`productBaseVariantId`);--> statement-breakpoint
CREATE INDEX `product_base_variant_option_values_option_id_idx` ON `productBaseVariantOptionValues` (`productBaseOptionId`);--> statement-breakpoint
CREATE UNIQUE INDEX `product_base_variant_option_values_variant_option_unique` ON `productBaseVariantOptionValues` (`productBaseVariantId`,`productBaseOptionId`);--> statement-breakpoint
CREATE TABLE `productBaseVariants` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`uuid` text NOT NULL,
	`productBaseId` integer NOT NULL,
	`name` text NOT NULL,
	`widthPx` integer NOT NULL,
	`heightPx` integer NOT NULL,
	`priceModifier` real DEFAULT 0,
	`isActive` integer DEFAULT true,
	`sortOrder` integer DEFAULT 0,
	`createdAt` text NOT NULL,
	`updatedAt` text NOT NULL,
	FOREIGN KEY (`productBaseId`) REFERENCES `productBases`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `product_base_variants_uuid_unique` ON `productBaseVariants` (`uuid`);--> statement-breakpoint
CREATE INDEX `product_base_variants_product_base_id_idx` ON `productBaseVariants` (`productBaseId`);--> statement-breakpoint
CREATE TABLE `productBases` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`uuid` text NOT NULL,
	`shopId` text NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`basePrice` real,
	`isActive` integer DEFAULT true,
	`sortOrder` integer DEFAULT 0,
	`createdAt` text NOT NULL,
	`updatedAt` text NOT NULL,
	FOREIGN KEY (`shopId`) REFERENCES `shops`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `product_bases_uuid_unique` ON `productBases` (`uuid`);--> statement-breakpoint
CREATE INDEX `product_bases_shop_id_idx` ON `productBases` (`shopId`);--> statement-breakpoint
CREATE TABLE `productProductBases` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`productId` integer NOT NULL,
	`productBaseId` integer NOT NULL,
	`isEnabled` integer DEFAULT true,
	`sortOrder` integer DEFAULT 0,
	`createdAt` text NOT NULL,
	`updatedAt` text NOT NULL,
	FOREIGN KEY (`productId`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`productBaseId`) REFERENCES `productBases`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `product_product_bases_unique` ON `productProductBases` (`productId`,`productBaseId`);--> statement-breakpoint
CREATE INDEX `product_product_bases_product_id_idx` ON `productProductBases` (`productId`);--> statement-breakpoint
CREATE INDEX `product_product_bases_product_base_id_idx` ON `productProductBases` (`productBaseId`);--> statement-breakpoint
CREATE TABLE `productStyles` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`productId` integer NOT NULL,
	`aiStyleId` integer NOT NULL,
	`sortOrder` integer DEFAULT 0,
	`isEnabled` integer DEFAULT true,
	`createdAt` text NOT NULL,
	`updatedAt` text NOT NULL,
	FOREIGN KEY (`productId`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`aiStyleId`) REFERENCES `aiStyles`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `product_styles_product_style_unique` ON `productStyles` (`productId`,`aiStyleId`);--> statement-breakpoint
CREATE INDEX `product_styles_product_id_idx` ON `productStyles` (`productId`);--> statement-breakpoint
CREATE INDEX `product_styles_ai_style_id_idx` ON `productStyles` (`aiStyleId`);--> statement-breakpoint
CREATE TABLE `products` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`uuid` text NOT NULL,
	`shopId` text NOT NULL,
	`shopifyProductId` integer NOT NULL,
	`title` text NOT NULL,
	`isEnabled` integer DEFAULT true,
	`createdAt` text NOT NULL,
	`updatedAt` text NOT NULL,
	FOREIGN KEY (`shopId`) REFERENCES `shops`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `products_shop_shopify_product_unique` ON `products` (`shopId`,`shopifyProductId`);--> statement-breakpoint
CREATE UNIQUE INDEX `products_uuid_unique` ON `products` (`uuid`);--> statement-breakpoint
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
