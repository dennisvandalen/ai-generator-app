PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_products` (
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
INSERT INTO `__new_products`("id", "uuid", "shopId", "shopifyProductId", "title", "isEnabled", "createdAt", "updatedAt") SELECT "id", "uuid", "shopId", "shopifyProductId", "title", "isEnabled", "createdAt", "updatedAt" FROM `products`;--> statement-breakpoint
DROP TABLE `products`;--> statement-breakpoint
ALTER TABLE `__new_products` RENAME TO `products`;--> statement-breakpoint
CREATE UNIQUE INDEX `products_shop_shopify_product_unique` ON `products` (`shopId`,`shopifyProductId`);--> statement-breakpoint
CREATE UNIQUE INDEX `products_uuid_unique` ON `products` (`uuid`);--> statement-breakpoint
CREATE INDEX `products_shop_id_idx` ON `products` (`shopId`);--> statement-breakpoint
PRAGMA foreign_keys=ON;