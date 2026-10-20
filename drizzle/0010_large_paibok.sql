CREATE TABLE `notification_consents` (
	`id` text PRIMARY KEY NOT NULL,
	`order_id` text NOT NULL,
	`stripe_session_id` text NOT NULL,
	`channel` text DEFAULT 'sms' NOT NULL,
	`purpose` text DEFAULT 'order_and_promotional' NOT NULL,
	`decision` text NOT NULL,
	`destination_normalized` text,
	`disclosure_version` text NOT NULL,
	`decided_at` integer NOT NULL,
	`source` text NOT NULL,
	`revoked_at` integer,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `notification_consents_session_channel_purpose_unique` ON `notification_consents` (`stripe_session_id`,`channel`,`purpose`);--> statement-breakpoint
CREATE INDEX `idx_notification_consents_destination` ON `notification_consents` (`destination_normalized`,`channel`,`purpose`);--> statement-breakpoint
CREATE TABLE `notification_outbox` (
	`id` text PRIMARY KEY NOT NULL,
	`order_id` text NOT NULL,
	`stripe_session_id` text NOT NULL,
	`channel` text DEFAULT 'sms' NOT NULL,
	`template_key` text NOT NULL,
	`destination_normalized` text NOT NULL,
	`scheduled_for` integer NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`attempts` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	`sent_at` integer
);
--> statement-breakpoint
CREATE UNIQUE INDEX `notification_outbox_session_template_unique` ON `notification_outbox` (`stripe_session_id`,`channel`,`template_key`);--> statement-breakpoint
CREATE INDEX `idx_notification_outbox_status_schedule` ON `notification_outbox` (`status`,`scheduled_for`);