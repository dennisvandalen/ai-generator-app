CREATE TABLE `session` (
	`id` text PRIMARY KEY NOT NULL,
	`shop` text NOT NULL,
	`state` text NOT NULL,
	`isOnline` integer DEFAULT false NOT NULL,
	`scope` text,
	`expires` text,
	`accessToken` text,
	`userId` blob
);
--> statement-breakpoint
CREATE TABLE `shops` (
	`id` text PRIMARY KEY NOT NULL,
	`accessToken` text NOT NULL,
	`scope` text,
	`shopName` text,
	`email` text,
	`planName` text DEFAULT 'basic',
	`createdAt` text NOT NULL,
	`updatedAt` text NOT NULL,
	`isActive` integer DEFAULT true
);
