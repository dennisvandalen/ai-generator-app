ALTER TABLE `productBaseVariants` ADD `price` real DEFAULT 0;--> statement-breakpoint
ALTER TABLE `productBaseVariants` ADD `compareAtPrice` real DEFAULT 0;--> statement-breakpoint
ALTER TABLE `productBaseVariants` DROP COLUMN `priceModifier`;--> statement-breakpoint
ALTER TABLE `productBases` DROP COLUMN `basePrice`;