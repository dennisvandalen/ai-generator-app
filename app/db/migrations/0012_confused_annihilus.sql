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
ALTER TABLE `productBaseVariants` DROP COLUMN `optionValues`;--> statement-breakpoint
ALTER TABLE `productBases` DROP COLUMN `optionNames`;