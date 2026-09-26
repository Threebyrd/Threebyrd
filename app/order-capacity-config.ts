export type OrderCapacityConfig = {
  /** Stable identifier for the ordering window whose reservations are counted. */
  windowKey: string;
  /** Set to null to disable the cap for a future ordering window. */
  limit: number | null;
  /** Reservation lifetime in seconds. Stripe Checkout is aligned to this value. */
  reservationTtlSeconds: number;
};

/**
 * Capacity is intentionally configured in one place. Set limit to null to
 * disable enforcement while retaining the schema for a future cap.
 */
export const ORDER_CAPACITY_CONFIG: Readonly<OrderCapacityConfig> = {
  windowKey: "rolling",
  limit: null,
  reservationTtlSeconds: 30 * 60,
};

/**
 * A null limit disables capacity enforcement for every fulfillment window.
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
