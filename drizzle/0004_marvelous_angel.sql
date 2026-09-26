CREATE TABLE `order_sheet_exports` (
	`order_id` text PRIMARY KEY NOT NULL,
	`stripe_session_id` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`attempts` integer DEFAULT 0 NOT NULL,
	`next_attempt_at` integer NOT NULL,
	`lease_until` integer,
	`last_error` text,
	`created_at` integer NOT NULL,
	`synced_at` integer
);
--> statement-breakpoint
CREATE UNIQUE INDEX `order_sheet_exports_stripe_session_id_unique` ON `order_sheet_exports` (`stripe_session_id`);--> statement-breakpoint
CREATE INDEX `idx_order_sheet_exports_status_retry` ON `order_sheet_exports` (`status`,`next_attempt_at`,`lease_until`);