CREATE TABLE `orders` (
	`id` text PRIMARY KEY NOT NULL,
	`stripe_session_id` text NOT NULL,
	`stripe_payment_intent_id` text,
	`status` text DEFAULT 'confirmed' NOT NULL,
	`customer_email` text,
	`customer_name` text,
	`customer_phone` text,
	`delivery_address` text,
	`items` text NOT NULL,
	`amount_cents` integer NOT NULL,
	`currency` text DEFAULT 'usd' NOT NULL,
	`cutoff_at` text,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `orders_stripe_session_id_unique` ON `orders` (`stripe_session_id`);