import type { OrderCapacityConfig } from "./order-capacity-config";

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
  mealCount: number;
  reservedAt: number;
  expiresAt: number;
};

export type ConfirmedOrderRecord = {
  stripeSessionId: string;
  stripePaymentIntentId: string | null;
  customerEmail: string | null;
  customerName: string | null;
  customerPhone: string | null;
  deliveryAddress: string;
  items: string;
  amountCents: number;
  currency: string;
  cutoffAt: string | null;
  createdAt: number;
};

const RESERVATION_TABLE = "order_capacity_reservations";

const releaseExpiredSql = `
  UPDATE ${RESERVATION_TABLE}
  SET status = 'released', released_at = ?
  WHERE status = 'reserved' AND expires_at <= ?
`;

export async function cleanupExpiredOrderCapacityReservations(
  database: CapacityDatabase,
  now = Math.floor(Date.now() / 1000),
): Promise<void> {
  await database.prepare(releaseExpiredSql).bind(now, now).run();
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
    database.prepare(releaseExpiredSql).bind(now, now),
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
): Promise<boolean> {
  if (config.limit === null) {
    return true;
  }

  if (!Number.isSafeInteger(reservation.mealCount) || reservation.mealCount <= 0) {
    return false;
  }

  const reserveSql = `
    INSERT INTO ${RESERVATION_TABLE}
      (id, window_key, status, meal_count, reserved_at, expires_at)
    SELECT ?, ?, 'reserved', ?, ?, ?
    WHERE (
      SELECT COALESCE(SUM(meal_count), 0)
      FROM ${RESERVATION_TABLE}
      WHERE window_key = ?
        AND (
          status = 'confirmed'
          OR (status = 'reserved' AND expires_at > ?)
        )
    ) + ? <= ?
  `;

  const results = await database.batch([
    database.prepare(releaseExpiredSql).bind(reservation.reservedAt, reservation.reservedAt),
    database.prepare(reserveSql).bind(
      reservation.id,
      reservation.windowKey,
      reservation.mealCount,
      reservation.reservedAt,
      reservation.expiresAt,
      reservation.windowKey,
      reservation.reservedAt,
      reservation.mealCount,
      config.limit,
    ),
  ]);

  return (results[1]?.meta?.changes ?? 0) === 1;
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
  options: { reservationId?: string | null; confirmedAt?: number } = {},
): Promise<boolean> {
  const reservationId = options.reservationId ?? null;
  const confirmedAt = options.confirmedAt ?? Math.floor(Date.now() / 1000);
  const confirmReservation = database.prepare(`
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
    confirmedAt,
    order.stripeSessionId,
    reservationId,
    reservationId,
    order.stripeSessionId,
  );
  const insertOrder = database.prepare(`
    INSERT INTO orders
      (id, stripe_session_id, stripe_payment_intent_id, status, customer_email, customer_name, customer_phone, delivery_address, items, amount_cents, currency, cutoff_at, created_at)
    SELECT ?, ?, ?, 'confirmed', ?, ?, ?, ?, ?, ?, ?, ?, ?
    WHERE ? IS NULL OR EXISTS (
      SELECT 1
      FROM ${RESERVATION_TABLE}
      WHERE status = 'confirmed'
        AND (
          stripe_session_id = ?
          OR (
            id = ?
            AND (stripe_session_id IS NULL OR stripe_session_id = ?)
          )
        )
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
    order.currency,
    order.cutoffAt,
    order.createdAt,
    reservationId,
    order.stripeSessionId,
    reservationId,
    order.stripeSessionId,
  );
  const existingOrder = database.prepare(`
    SELECT id FROM orders WHERE stripe_session_id = ? LIMIT 1
  `).bind(order.stripeSessionId);
  const results = await database.batch([confirmReservation, insertOrder, existingOrder]);

  return (results[2]?.results?.length ?? 0) > 0;
}

function toCount(value: unknown): number {
  const count = Number(value);
  return Number.isFinite(count) && count >= 0 ? Math.trunc(count) : 0;
}
