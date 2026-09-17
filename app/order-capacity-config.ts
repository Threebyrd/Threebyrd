export type OrderCapacityConfig = {
  /** Stable identifier for the ordering window whose reservations are counted. */
  windowKey: string;
  /** Set to null to disable the cap for a future ordering window. */
  limit: number | null;
  /** Reservation lifetime in seconds. Stripe Checkout is aligned to this value. */
  reservationTtlSeconds: number;
};

/**
 * Capacity is intentionally configured in one place. To prepare a future drop,
 * change windowKey and set limit to 50, 75, 100, or null for no cap.
 */
export const ORDER_CAPACITY_CONFIG: Readonly<OrderCapacityConfig> = {
  windowKey: "2026-09-18",
  limit: 50,
  reservationTtlSeconds: 30 * 60,
};

/**
 * A stale window configuration fails closed to an uncapped state after its
 * Friday cutoff. Operators must move windowKey forward before enabling a new
 * weekly cap; a limit of null remains the explicit no-cap option.
 */
export function getOrderCapacityConfig(activeWindowKey: string): OrderCapacityConfig {
  return activeWindowKey === ORDER_CAPACITY_CONFIG.windowKey
    ? { ...ORDER_CAPACITY_CONFIG }
    : { ...ORDER_CAPACITY_CONFIG, limit: null };
}
