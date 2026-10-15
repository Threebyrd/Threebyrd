import type Stripe from "stripe";

export type StripeDiscountIdentifiers = {
  couponId: string | null;
  promotionCodeId: string | null;
};

/**
 * Checkout owns the promotion-code UI and validates the customer-facing code.
 * The application deliberately does not receive or store the code itself.
 */
export function buildStripeHostedPromotionCodeParams(): Pick<
  Stripe.Checkout.SessionCreateParams,
  "allow_promotion_codes"
> {
  return { allow_promotion_codes: true };
}

/**
 * Checkout provides Stripe object IDs, not the customer-entered promotion
 * code. Retain those non-sensitive IDs only when Stripe includes them.
 */
export function readStripeDiscountIdentifiers(
  discounts: ReadonlyArray<{ coupon?: unknown; promotion_code?: unknown }> | null | undefined,
): StripeDiscountIdentifiers {
  const discount = discounts?.[0];
  return {
    couponId: readStripeObjectId(discount?.coupon),
    promotionCodeId: readStripeObjectId(discount?.promotion_code),
  };
}

function readStripeObjectId(value: unknown): string | null {
  if (typeof value === "string" && value.length > 0) return value;
  if (typeof value === "object" && value !== null && "id" in value && typeof value.id === "string" && value.id.length > 0) {
    return value.id;
  }
  return null;
}
