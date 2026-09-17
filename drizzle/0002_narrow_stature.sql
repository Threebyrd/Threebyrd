CREATE TABLE `order_capacity_reservations` (
	`id` text PRIMARY KEY NOT NULL,
	`window_key` text NOT NULL,
	`stripe_session_id` text,
	`status` text NOT NULL,
	`reserved_at` integer NOT NULL,
	`expires_at` integer NOT NULL,
	`confirmed_at` integer,
	`released_at` integer
);
--> statement-breakpoint
CREATE UNIQUE INDEX `order_capacity_reservations_stripe_session_id_unique` ON `order_capacity_reservations` (`stripe_session_id`);--> statement-breakpoint
CREATE INDEX `idx_order_capacity_reservations_window_status_expiry` ON `order_capacity_reservations` (`window_key`,`status`,`expires_at`);