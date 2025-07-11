ALTER TABLE `products` ADD `uuid` text NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX `products_uuid_unique` ON `products` (`uuid`);--> statement-breakpoint
ALTER TABLE `products` DROP COLUMN `handle`;--> statement-breakpoint
ALTER TABLE `sizes` ADD `uuid` text NOT NULL;--> statement-breakpoint
ALTER TABLE `sizes` ADD `shopifyVariantId` text;--> statement-breakpoint
CREATE UNIQUE INDEX `sizes_uuid_unique` ON `sizes` (`uuid`);--> statement-breakpoint
CREATE INDEX `sizes_shopify_variant_id_idx` ON `sizes` (`shopifyVariantId`);