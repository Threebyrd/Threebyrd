export type OrderCapacityConfig = {
  /** Stable identifier for the ordering window whose reservations are counted. */
  windowKey: string;
  /** Set to null to disable the cap for a future ordering window. */
  limit: number | null;
  /** Reservation lifetime in seconds. Stripe Checkout is aligned to this value. */
  reservationTtlSeconds: number;
};

/**
 * Capacity is intentionally configured in one place. The rolling marker keeps
 * the same meal cap for each weekly delivery window; set limit to null for no
 * cap, or replace windowKey with a specific YYYY-MM-DD to pin a one-off cap.
 */
export const ORDER_CAPACITY_CONFIG: Readonly<OrderCapacityConfig> = {
  windowKey: "rolling",
  limit: 50,
  reservationTtlSeconds: 30 * 60,
};

/**
 * A rolling configuration gives each calculated cutoff its own isolated D1
 * bucket. A specific date remains available for one-off windows, and a null
 * limit remains the explicit no-cap option.
 */
export function getOrderCapacityConfig(activeWindowKey: string): OrderCapacityConfig {
  const isRolling = ORDER_CAPACITY_CONFIG.windowKey === "rolling";
  const isConfiguredWindow = isRolling || activeWindowKey === ORDER_CAPACITY_CONFIG.windowKey;
  return {
    ...ORDER_CAPACITY_CONFIG,
    windowKey: activeWindowKey,
    limit: isConfiguredWindow ? ORDER_CAPACITY_CONFIG.limit : null,
  };
}
