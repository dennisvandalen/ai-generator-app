PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_generations` (
	`id` text PRIMARY KEY NOT NULL,
	`shopId` text NOT NULL,
	`productId` integer NOT NULL,
	`sizeId` integer,
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
INSERT INTO `__new_generations`("id", "shopId", "productId", "sizeId", "aiStyleId", "orderId", "customerId", "inputImageUrl", "previewImageUrl", "finalImageUrl", "generationType", "status", "aiPromptUsed", "errorMessage", "processingTimeMs", "aiModelUsed", "generationParams", "upscaleStatus", "upscaleFactor", "originalWidth", "originalHeight", "finalWidth", "finalHeight", "upscaleStartedAt", "upscaleCompletedAt", "createdAt", "updatedAt") SELECT "id", "shopId", "productId", "sizeId", "aiStyleId", "orderId", "customerId", "inputImageUrl", "previewImageUrl", "finalImageUrl", "generationType", "status", "aiPromptUsed", "errorMessage", "processingTimeMs", "aiModelUsed", "generationParams", "upscaleStatus", "upscaleFactor", "originalWidth", "originalHeight", "finalWidth", "finalHeight", "upscaleStartedAt", "upscaleCompletedAt", "createdAt", "updatedAt" FROM `generations`;--> statement-breakpoint
DROP TABLE `generations`;--> statement-breakpoint
ALTER TABLE `__new_generations` RENAME TO `generations`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX `generations_shop_id_idx` ON `generations` (`shopId`);--> statement-breakpoint
CREATE INDEX `generations_status_idx` ON `generations` (`status`);--> statement-breakpoint
CREATE INDEX `generations_type_idx` ON `generations` (`generationType`);--> statement-breakpoint
CREATE INDEX `generations_upscale_status_idx` ON `generations` (`upscaleStatus`);--> statement-breakpoint
CREATE INDEX `generations_created_at_idx` ON `generations` (`createdAt`);