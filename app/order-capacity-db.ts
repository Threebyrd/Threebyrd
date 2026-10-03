import type { OrderCapacityConfig } from "./order-capacity-config";
import {
  buildOrderSheetPayload,
  getConfiguredStripeMode,
  getRetryDelaySeconds,
  sendOrderToGoogleSheets,
  type ConfirmedOrderForSheet,
  type GoogleSheetsOrderSender,
} from "./order-sheet-sync.ts";

type PreparedStatement = {
  bind(...values: unknown[]): PreparedStatement;
  run<T = unknown>(): Promise<D1Result<T>>;
};

type D1Result<T> = {
  results?: T[];
  meta?: { changes?: number };
};

export type CapacityDatabase = {
  prepare(query: string): PreparedStatement;
  batch<T = unknown>(statements: PreparedStatement[]): Promise<D1Result<T>[]>;
};

export type CapacityReservation = {
  id: string;
  windowKey: string;
  clientKey?: string | null;
  mealCount: number;
  reservedAt: number;
  expiresAt: number;
};

export type ReservationAttemptResult =
  | { ok: true }
  | { ok: false; reason: "capacity_exhausted" | "active_reservation" };

export type ConfirmedOrderRecord = {
  stripeSessionId: string;
  stripePaymentIntentId: string | null;
  customerEmail: string | null;
  customerName: string | null;
  customerPhone: string | null;
  deliveryAddress: string;
  items: string;
  amountCents: number;
  subtotalCents: number | null;
  taxCents: number;
  currency: string;
  cutoffAt: string | null;
  createdAt: number;
  automaticTaxStatus?: string | null;
  taxBehavior?: string;
  productTaxCode?: string | null;
  discountCents?: number;
  stripeCouponId?: string | null;
  stripePromotionCodeId?: string | null;
  stripePaymentStatus?: string;
};

export type PendingOrderSheetExport = {
  order: ConfirmedOrderForSheet;
  attempts: number;
  claimToken: string;
};

const RESERVATION_TABLE = "order_capacity_reservations";
const ATTACHED_RESERVATION_WEBHOOK_GRACE_SECONDS = 10 * 60;

const releaseExpiredSql = `
  UPDATE ${RESERVATION_TABLE}
  SET status = 'released', released_at = ?
  WHERE status = 'reserved' AND (
    (stripe_session_id IS NULL AND expires_at <= ?)
    OR (stripe_session_id IS NOT NULL AND expires_at <= ?)
  )
`;

export async function cleanupExpiredOrderCapacityReservations(
  database: CapacityDatabase,
  now = Math.floor(Date.now() / 1000),
): Promise<void> {
  await database.prepare(releaseExpiredSql).bind(
    now,
    now,
    now - ATTACHED_RESERVATION_WEBHOOK_GRACE_SECONDS,
  ).run();
}

export async function getOrderCapacityAvailability(
  database: CapacityDatabase,
  config: OrderCapacityConfig,
  now = Math.floor(Date.now() / 1000),
): Promise<{ confirmedMeals: number; reservedMeals: number; remaining: number | null }> {
  const countSql = `
    SELECT
      COALESCE(SUM(CASE WHEN status = 'confirmed' THEN meal_count ELSE 0 END), 0) AS confirmed_meals,
      COALESCE(SUM(CASE WHEN status = 'reserved' AND expires_at > ? THEN meal_count ELSE 0 END), 0) AS reserved_meals
    FROM ${RESERVATION_TABLE}
    WHERE window_key = ?
      AND (status = 'confirmed' OR (status = 'reserved' AND expires_at > ?))
  `;

  const results = await database.batch([
    database.prepare(releaseExpiredSql).bind(
      now,
      now,
      now - ATTACHED_RESERVATION_WEBHOOK_GRACE_SECONDS,
    ),
    database.prepare(countSql).bind(now, config.windowKey, now),
  ]);
  const counts = (results[1]?.results?.[0] ?? {}) as { confirmed_meals?: unknown; reserved_meals?: unknown };
  const confirmedMeals = toCount(counts.confirmed_meals);
  const reservedMeals = toCount(counts.reserved_meals);

  return {
    confirmedMeals,
    reservedMeals,
    remaining: config.limit === null ? null : Math.max(0, config.limit - confirmedMeals - reservedMeals),
  };
}

export async function reserveOrderCapacity(
  database: CapacityDatabase,
  config: OrderCapacityConfig,
  reservation: CapacityReservation,
): Promise<ReservationAttemptResult> {
  if (config.limit === null) {
    return { ok: true };
  }

  if (!Number.isSafeInteger(reservation.mealCount) || reservation.mealCount <= 0) {
    return { ok: false, reason: "capacity_exhausted" };
  }

  const reserveSql = `
    INSERT INTO ${RESERVATION_TABLE}
      (id, window_key, status, meal_count, client_key, reserved_at, expires_at)
    SELECT ?, ?, 'reserved', ?, ?, ?, ?
    WHERE (
      SELECT COALESCE(SUM(meal_count), 0)
      FROM ${RESERVATION_TABLE}
      WHERE window_key = ?
        AND (
          status = 'confirmed'
          OR (status = 'reserved' AND expires_at > ?)
        )
    ) + ? <= ?
      AND (
        ? IS NULL OR NOT EXISTS (
          SELECT 1
          FROM ${RESERVATION_TABLE}
          WHERE window_key = ?
            AND client_key = ?
            AND status = 'reserved'
            AND expires_at > ?
        )
      )
  `;

  const results = await database.batch([
    database.prepare(releaseExpiredSql).bind(
      reservation.reservedAt,
      reservation.reservedAt,
      reservation.reservedAt - ATTACHED_RESERVATION_WEBHOOK_GRACE_SECONDS,
    ),
    database.prepare(reserveSql).bind(
      reservation.id,
      reservation.windowKey,
      reservation.mealCount,
      reservation.clientKey ?? null,
      reservation.reservedAt,
      reservation.expiresAt,
      reservation.windowKey,
      reservation.reservedAt,
      reservation.mealCount,
      config.limit,
      reservation.clientKey ?? null,
      reservation.windowKey,
      reservation.clientKey ?? null,
      reservation.reservedAt,
    ),
  ]);

  if ((results[1]?.meta?.changes ?? 0) === 1) {
    return { ok: true };
  }

  if (reservation.clientKey) {
    const activeClientReservation = await database.prepare(`
      SELECT 1 AS active
      FROM ${RESERVATION_TABLE}
      WHERE window_key = ?
        AND client_key = ?
        AND status = 'reserved'
        AND expires_at > ?
      LIMIT 1
    `).bind(reservation.windowKey, reservation.clientKey, reservation.reservedAt).run<{ active?: number }>();
    if ((activeClientReservation.results?.length ?? 0) > 0) {
      return { ok: false, reason: "active_reservation" };
    }
  }

  return { ok: false, reason: "capacity_exhausted" };
}

export async function attachOrderCapacityReservation(
  database: CapacityDatabase,
  reservationId: string,
  stripeSessionId: string,
): Promise<boolean> {
  const result = await database.prepare(`
    UPDATE ${RESERVATION_TABLE}
    SET stripe_session_id = ?
    WHERE id = ? AND status = 'reserved' AND stripe_session_id IS NULL
  `).bind(stripeSessionId, reservationId).run();

  return (result.meta?.changes ?? 0) === 1;
}

export async function releaseOrderCapacityReservation(
  database: CapacityDatabase,
  options: { reservationId?: string | null; stripeSessionId?: string | null },
  now = Math.floor(Date.now() / 1000),
): Promise<void> {
  await database.prepare(`
    UPDATE ${RESERVATION_TABLE}
    SET status = 'released', released_at = ?
    WHERE status = 'reserved'
      AND (
        (? IS NOT NULL AND id = ?)
        OR (? IS NOT NULL AND stripe_session_id = ?)
      )
  `).bind(
    now,
    options.reservationId ?? null,
    options.reservationId ?? null,
    options.stripeSessionId ?? null,
    options.stripeSessionId ?? null,
  ).run();

}

export async function confirmOrderCapacityReservation(
  database: CapacityDatabase,
  options: { reservationId?: string | null; stripeSessionId: string },
  now = Math.floor(Date.now() / 1000),
): Promise<boolean> {
  const result = await database.prepare(`
    UPDATE ${RESERVATION_TABLE}
    SET status = 'confirmed', confirmed_at = ?, released_at = NULL
    WHERE status IN ('reserved', 'confirmed')
      AND (
        stripe_session_id = ?
        OR (
          ? IS NOT NULL
          AND id = ?
          AND (stripe_session_id IS NULL OR stripe_session_id = ?)
        )
      )
  `).bind(
    now,
    options.stripeSessionId,
    options.reservationId ?? null,
    options.reservationId ?? null,
    options.stripeSessionId,
  ).run();

  return (result.meta?.changes ?? 0) >= 1;
}

export async function recordConfirmedOrder(
  database: CapacityDatabase,
  order: ConfirmedOrderRecord,
  options: { reservationId?: string | null; confirmedAt?: number; expectedWindowKey?: string | null; expectedMealCount?: number | null } = {},
): Promise<boolean> {
  const reservationId = options.reservationId ?? null;
  const confirmedAt = options.confirmedAt ?? Math.floor(Date.now() / 1000);
  const expectedWindowKey = options.expectedWindowKey ?? null;
  const expectedMealCount = options.expectedMealCount ?? null;
  const reservationMealCount = expectedMealCount ?? 0;
  const automaticTaxStatus = order.automaticTaxStatus ?? null;
  const taxBehavior = order.taxBehavior ?? "exclusive";
  const productTaxCode = order.productTaxCode ?? null;
  const discountCents = order.discountCents ?? 0;
  const stripeCouponId = order.stripeCouponId ?? null;
  const stripePromotionCodeId = order.stripePromotionCodeId ?? null;
  const stripePaymentStatus = order.stripePaymentStatus ?? "paid";
  if (reservationId && (!expectedWindowKey || typeof expectedMealCount !== "number" || !Number.isSafeInteger(reservationMealCount) || reservationMealCount <= 0)) {
    return false;
  }

  const reservationMatch = `
    (
      (? IS NULL AND stripe_session_id = ?)
      OR (
        ? IS NOT NULL
        AND id = ?
        AND window_key = ?
        AND meal_count = ?
        AND (stripe_session_id IS NULL OR stripe_session_id = ?)
      )
    )
  `;
  const confirmReservation = database.prepare(`
    UPDATE ${RESERVATION_TABLE}
    SET status = 'confirmed', confirmed_at = ?, released_at = NULL
    WHERE status IN ('reserved', 'confirmed')
      AND ${reservationMatch}
  `).bind(
    confirmedAt,
    reservationId,
    order.stripeSessionId,
    reservationId,
    reservationId,
    expectedWindowKey,
    reservationMealCount,
    order.stripeSessionId,
  );
  const insertOrder = database.prepare(`
    INSERT INTO orders
      (id, stripe_session_id, stripe_payment_intent_id, status, customer_email, customer_name, customer_phone, delivery_address, items, amount_cents, subtotal_cents, tax_cents, currency, cutoff_at, created_at, automatic_tax_status, tax_behavior, product_tax_code, discount_cents, stripe_coupon_id, stripe_promotion_code_id, stripe_payment_status)
    SELECT ?, ?, ?, 'confirmed', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
    WHERE ? IS NULL OR EXISTS (
      SELECT 1
      FROM ${RESERVATION_TABLE}
      WHERE status = 'confirmed'
        AND ${reservationMatch}
    )
    ON CONFLICT(stripe_session_id) DO NOTHING
  `).bind(
    order.stripeSessionId,
    order.stripeSessionId,
    order.stripePaymentIntentId,
    order.customerEmail,
    order.customerName,
    order.customerPhone,
    order.deliveryAddress,
    order.items,
    order.amountCents,
    order.subtotalCents,
    order.taxCents,
    order.currency,
    order.cutoffAt,
    order.createdAt,
    automaticTaxStatus,
    taxBehavior,
    productTaxCode,
    discountCents,
    stripeCouponId,
    stripePromotionCodeId,
    stripePaymentStatus,
    reservationId,
    reservationId,
    order.stripeSessionId,
    reservationId,
    reservationId,
    expectedWindowKey,
    reservationMealCount,
    order.stripeSessionId,
  );
  const enqueueSheetExport = database.prepare(`
    INSERT INTO order_sheet_exports
      (order_id, stripe_session_id, status, attempts, next_attempt_at, created_at)
    SELECT ?, ?, 'pending', 0, ?, ?
    WHERE EXISTS (
      SELECT 1 FROM orders WHERE stripe_session_id = ?
    )
    ON CONFLICT(stripe_session_id) DO NOTHING
  `).bind(
    order.stripeSessionId,
    order.stripeSessionId,
    confirmedAt,
    confirmedAt,
    order.stripeSessionId,
  );
  const existingOrder = database.prepare(`
    SELECT id FROM orders WHERE stripe_session_id = ? LIMIT 1
  `).bind(order.stripeSessionId);
  const results = await database.batch([confirmReservation, insertOrder, enqueueSheetExport, existingOrder]);

  return (results[3]?.results?.length ?? 0) > 0;
}

export async function processPendingOrderSheetExports(
  database: CapacityDatabase,
  now = Math.floor(Date.now() / 1000),
  limit = 10,
  send: GoogleSheetsOrderSender = sendOrderToGoogleSheets,
): Promise<void> {
  const pending = await claimPendingOrderSheetExports(database, now, limit);

  for (const item of pending) {
    let result: Awaited<ReturnType<typeof sendOrderToGoogleSheets>>;
    try {
      result = await send(buildOrderSheetPayload(item.order, getConfiguredStripeMode()));
    } catch {
      result = { ok: false, reason: "endpoint_rejected" };
    }

    if (result.ok && typeof result.duplicate === "boolean") {
      if (result.diagnostics) {
        console.log("Google Sheets export destination verified", result.diagnostics);
      }
      await markOrderSheetExportSynced(database, item.order.id, item.claimToken, now);
    } else {
      const reason = result.ok ? "endpoint_rejected" : result.reason;
      console.error("Google Sheets order export failed", reason);
      await markOrderSheetExportPending(database, item.order.id, item.claimToken, item.attempts, reason, now);
    }
  }
}

async function claimPendingOrderSheetExports(
  database: CapacityDatabase,
  now: number,
  limit: number,
): Promise<PendingOrderSheetExport[]> {
  const result = await database.prepare(`
    SELECT
      o.id,
      o.stripe_session_id,
      o.status,
      o.customer_email,
      o.customer_name,
      o.customer_phone,
      o.delivery_address,
      o.items,
      o.amount_cents,
      o.subtotal_cents,
      o.tax_cents,
      o.currency,
      o.cutoff_at,
      o.created_at,
      e.attempts
    FROM order_sheet_exports e
    INNER JOIN orders o ON o.id = e.order_id
    WHERE (
      (e.status = 'pending' AND e.next_attempt_at <= ?)
      OR (e.status = 'processing' AND e.lease_until <= ?)
    )
    ORDER BY e.created_at ASC
    LIMIT ?
  `).bind(now, now, Math.max(1, Math.min(50, Math.trunc(limit)))).run<{
    id: string;
    stripe_session_id: string;
    status: string;
    customer_email: string | null;
    customer_name: string | null;
    customer_phone: string | null;
    delivery_address: string | null;
    items: string;
    amount_cents: number;
    subtotal_cents: number | null;
    tax_cents: number;
    currency: string;
    cutoff_at: string | null;
    created_at: number;
    attempts: number;
  }>();

  const claimed: PendingOrderSheetExport[] = [];
  for (const row of result.results ?? []) {
    const claimToken = crypto.randomUUID();
    const claimedResult = await database.prepare(`
      UPDATE order_sheet_exports
      SET status = 'processing', attempts = attempts + 1, lease_until = ?, claim_token = ?, last_error = NULL
      WHERE order_id = ?
        AND (
          (status = 'pending' AND next_attempt_at <= ?)
          OR (status = 'processing' AND lease_until <= ?)
        )
    `).bind(now + 5 * 60, claimToken, row.id, now, now).run();

    if ((claimedResult.meta?.changes ?? 0) !== 1) {
      continue;
    }

    claimed.push({
      attempts: Number(row.attempts) + 1,
      claimToken,
      order: {
        id: row.id,
        stripeSessionId: row.stripe_session_id,
        status: row.status,
        customerEmail: row.customer_email,
        customerName: row.customer_name,
        customerPhone: row.customer_phone,
        deliveryAddress: row.delivery_address,
        items: row.items,
        amountCents: Number(row.amount_cents),
        subtotalCents: row.subtotal_cents == null ? null : Number(row.subtotal_cents),
        taxCents: row.tax_cents == null ? null : Number(row.tax_cents),
        currency: row.currency,
        cutoffAt: row.cutoff_at,
        createdAt: Number(row.created_at),
      },
    });
  }

  return claimed;
}

async function markOrderSheetExportSynced(database: CapacityDatabase, orderId: string, claimToken: string, now: number): Promise<void> {
  await database.prepare(`
    UPDATE order_sheet_exports
    SET status = 'synced', synced_at = ?, lease_until = NULL, claim_token = NULL, last_error = NULL
    WHERE order_id = ? AND status = 'processing' AND claim_token = ?
  `).bind(now, orderId, claimToken).run();
}

async function markOrderSheetExportPending(
  database: CapacityDatabase,
  orderId: string,
  claimToken: string,
  attempts: number,
  reason: string,
  now: number,
): Promise<void> {
  await database.prepare(`
    UPDATE order_sheet_exports
    SET status = 'pending', next_attempt_at = ?, lease_until = NULL, claim_token = NULL, last_error = ?
    WHERE order_id = ? AND status = 'processing' AND claim_token = ?
  `).bind(
    now + getRetryDelaySeconds(attempts),
    reason.slice(0, 80),
    orderId,
    claimToken,
  ).run();
}

function toCount(value: unknown): number {
  const count = Number(value);
  return Number.isFinite(count) && count >= 0 ? Math.trunc(count) : 0;
}
