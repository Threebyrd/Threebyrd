ALTER TABLE `orders` ADD `discount_cents` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `orders` ADD `stripe_coupon_id` text;--> statement-breakpoint
ALTER TABLE `orders` ADD `stripe_promotion_code_id` text;--> statement-breakpoint
ALTER TABLE `orders` ADD `stripe_payment_status` text DEFAULT 'paid' NOT NULL;