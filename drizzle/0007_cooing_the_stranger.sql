ALTER TABLE `orders` ADD `subtotal_cents` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `orders` ADD `tax_cents` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `orders` ADD `automatic_tax_status` text;--> statement-breakpoint
ALTER TABLE `orders` ADD `tax_behavior` text DEFAULT 'exclusive' NOT NULL;--> statement-breakpoint
ALTER TABLE `orders` ADD `product_tax_code` text;--> statement-breakpoint
UPDATE `orders`
SET `subtotal_cents` = `amount_cents`,
    `tax_cents` = 0
WHERE `subtotal_cents` = 0;
