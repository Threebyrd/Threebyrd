import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const orders = sqliteTable("orders", {
  id: text("id").primaryKey(),
  stripeSessionId: text("stripe_session_id").notNull().unique(),
  stripePaymentIntentId: text("stripe_payment_intent_id"),
  status: text("status").notNull().default("confirmed"),
  customerEmail: text("customer_email"),
  customerName: text("customer_name"),
  customerPhone: text("customer_phone"),
  deliveryAddress: text("delivery_address"),
  items: text("items").notNull(),
  amountCents: integer("amount_cents").notNull(),
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
