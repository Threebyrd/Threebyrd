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
  reservedAt: integer("reserved_at").notNull(),
  expiresAt: integer("expires_at").notNull(),
  confirmedAt: integer("confirmed_at"),
  releasedAt: integer("released_at"),
}, (table) => [
  uniqueIndex("order_capacity_reservations_stripe_session_id_unique").on(table.stripeSessionId),
  index("idx_order_capacity_reservations_window_status_expiry").on(table.windowKey, table.status, table.expiresAt),
]);
