import { normalizeDeliveryAddress } from "./delivery.ts";

/**
 * This value was created by the server after Google validated the address
 * before Checkout. Stripe-hosted address fields are intentionally not used as
 * a second, mutable source of fulfillment truth.
 */
export function getValidatedDeliveryAddressFromMetadata(
  metadata: Record<string, string> | null | undefined,
): string | null {
  const value = metadata?.delivery_address?.trim();
  if (!value || normalizeDeliveryAddress(value) !== value) return null;
  return value;
}
