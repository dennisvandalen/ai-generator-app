DROP INDEX `product_bases_category_idx`;--> statement-breakpoint
ALTER TABLE `productBases` ADD `optionNames` text;--> statement-breakpoint
ALTER TABLE `productBases` DROP COLUMN `category`;--> statement-breakpoint
ALTER TABLE `productBaseVariants` ADD `optionValues` text;