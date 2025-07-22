PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_productBaseVariantMappings` (
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
INSERT INTO `__new_productBaseVariantMappings`("id", "productId", "productBaseVariantId", "shopifyVariantId", "isActive", "createdAt", "updatedAt") SELECT "id", "productId", "productBaseVariantId", "shopifyVariantId", "isActive", "createdAt", "updatedAt" FROM `productBaseVariantMappings`;--> statement-breakpoint
DROP TABLE `productBaseVariantMappings`;--> statement-breakpoint
ALTER TABLE `__new_productBaseVariantMappings` RENAME TO `productBaseVariantMappings`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE UNIQUE INDEX `product_base_variant_mappings_unique` ON `productBaseVariantMappings` (`productId`,`productBaseVariantId`,`shopifyVariantId`);--> statement-breakpoint
CREATE INDEX `product_base_variant_mappings_product_id_idx` ON `productBaseVariantMappings` (`productId`);--> statement-breakpoint
CREATE INDEX `product_base_variant_mappings_product_base_variant_id_idx` ON `productBaseVariantMappings` (`productBaseVariantId`);--> statement-breakpoint
CREATE INDEX `product_base_variant_mappings_shopify_variant_id_idx` ON `productBaseVariantMappings` (`shopifyVariantId`);