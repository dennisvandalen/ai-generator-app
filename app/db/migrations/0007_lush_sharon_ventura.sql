CREATE TABLE `productBaseVariants` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`uuid` text NOT NULL,
	`productBaseId` integer NOT NULL,
	`name` text NOT NULL,
	`variantType` text NOT NULL,
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
CREATE INDEX `product_base_variants_type_idx` ON `productBaseVariants` (`variantType`);--> statement-breakpoint
CREATE TABLE `productBases` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`uuid` text NOT NULL,
	`shopId` text NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`category` text,
	`basePrice` real,
	`aspectRatio` text,
	`isActive` integer DEFAULT true,
	`sortOrder` integer DEFAULT 0,
	`createdAt` text NOT NULL,
	`updatedAt` text NOT NULL,
	FOREIGN KEY (`shopId`) REFERENCES `shops`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `product_bases_uuid_unique` ON `productBases` (`uuid`);--> statement-breakpoint
CREATE INDEX `product_bases_shop_id_idx` ON `productBases` (`shopId`);--> statement-breakpoint
CREATE INDEX `product_bases_category_idx` ON `productBases` (`category`);--> statement-breakpoint
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
CREATE INDEX `product_product_bases_product_base_id_idx` ON `productProductBases` (`productBaseId`);