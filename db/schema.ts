import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const orders = sqliteTable("orders", {
  id: text("id").primaryKey(),
  stripeSessionId: text("stripe_session_id").notNull().unique(),
  stripePaymentIntentId: text("stripe_payment_intent_id"),
  status: text("status").notNull().default("confirmed"),
  customerEmail: text("customer_email"),
  customerName: text("customer_name"),
  recipientName: text("recipient_name"),
  customerPhone: text("customer_phone"),
  deliveryAddress: text("delivery_address"),
  items: text("items").notNull(),
  subtotalCents: integer("subtotal_cents").notNull().default(0),
  discountCents: integer("discount_cents").notNull().default(0),
  taxCents: integer("tax_cents").notNull().default(0),
  amountCents: integer("amount_cents").notNull(),
  stripeCouponId: text("stripe_coupon_id"),
  stripePromotionCodeId: text("stripe_promotion_code_id"),
  stripePaymentStatus: text("stripe_payment_status").notNull().default("paid"),
  automaticTaxStatus: text("automatic_tax_status"),
  taxBehavior: text("tax_behavior").notNull().default("exclusive"),
  productTaxCode: text("product_tax_code"),
  currency: text("currency").notNull().default("usd"),
  cutoffAt: text("cutoff_at"),
  createdAt: integer("created_at").notNull(),
});

export const liveTestGate = sqliteTable("live_test_gate", {
  id: integer("id").primaryKey(),
  consumedAt: integer("consumed_at"),
});

export const orderCapacityReservations = sqliteTable("order_capacity_reservations", {
  id: text("id").primaryKey(),
  windowKey: text("window_key").notNull(),
  stripeSessionId: text("stripe_session_id"),
  status: text("status").notNull(),
  mealCount: integer("meal_count").notNull().default(0),
  clientKey: text("client_key"),
  reservedAt: integer("reserved_at").notNull(),
  expiresAt: integer("expires_at").notNull(),
  confirmedAt: integer("confirmed_at"),
  releasedAt: integer("released_at"),
}, (table) => [
  uniqueIndex("order_capacity_reservations_stripe_session_id_unique").on(table.stripeSessionId),
  index("idx_order_capacity_reservations_window_status_expiry").on(table.windowKey, table.status, table.expiresAt),
  index("idx_order_capacity_reservations_window_client_status").on(table.windowKey, table.clientKey, table.status, table.expiresAt),
]);

export const orderSheetExports = sqliteTable("order_sheet_exports", {
  orderId: text("order_id").primaryKey(),
  stripeSessionId: text("stripe_session_id").notNull().unique(),
  status: text("status").notNull().default("pending"),
  attempts: integer("attempts").notNull().default(0),
  nextAttemptAt: integer("next_attempt_at").notNull(),
  leaseUntil: integer("lease_until"),
  claimToken: text("claim_token"),
  lastError: text("last_error"),
  createdAt: integer("created_at").notNull(),
  syncedAt: integer("synced_at"),
}, (table) => [
  index("idx_order_sheet_exports_status_retry").on(table.status, table.nextAttemptAt, table.leaseUntil),
]);

export const notificationConsents = sqliteTable("notification_consents", {
  id: text("id").primaryKey(),
  orderId: text("order_id").notNull(),
  stripeSessionId: text("stripe_session_id").notNull(),
  channel: text("channel").notNull().default("sms"),
  purpose: text("purpose").notNull().default("order_and_promotional"),
  decision: text("decision").notNull(),
  destinationNormalized: text("destination_normalized"),
  disclosureVersion: text("disclosure_version").notNull(),
  decidedAt: integer("decided_at").notNull(),
  source: text("source").notNull(),
  revokedAt: integer("revoked_at"),
  createdAt: integer("created_at").notNull(),
}, (table) => [
  uniqueIndex("notification_consents_session_channel_purpose_unique").on(table.stripeSessionId, table.channel, table.purpose),
  index("idx_notification_consents_destination").on(table.destinationNormalized, table.channel, table.purpose),
]);

export const notificationOutbox = sqliteTable("notification_outbox", {
  id: text("id").primaryKey(),
  orderId: text("order_id").notNull(),
  stripeSessionId: text("stripe_session_id").notNull(),
  channel: text("channel").notNull().default("sms"),
  templateKey: text("template_key").notNull(),
  destinationNormalized: text("destination_normalized").notNull(),
  scheduledFor: integer("scheduled_for").notNull(),
  status: text("status").notNull().default("pending"),
  attempts: integer("attempts").notNull().default(0),
  createdAt: integer("created_at").notNull(),
  sentAt: integer("sent_at"),
}, (table) => [
  uniqueIndex("notification_outbox_session_template_unique").on(table.stripeSessionId, table.channel, table.templateKey),
  index("idx_notification_outbox_status_schedule").on(table.status, table.scheduledFor),
]);
