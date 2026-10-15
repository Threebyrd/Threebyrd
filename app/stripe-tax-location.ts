import type Stripe from "stripe";

/**
 * Stripe requires a recipient name when a Customer has a shipping address.
 * This name is the server-validated fulfillment name collected by ThreeByrd;
 * it is intentionally separate from Checkout's billing/cardholder name.
 */
export type StripeTaxDeliveryAddress = {
  line1: string;
  city: string;
  state: string;
  postal_code: string;
  country: "US";
};

/**
 * Put the verified fulfillment destination on the new Stripe Customer before
 * creating the Checkout Session. Stripe Checkout gives a saved shipping
 * address priority over a billing address for automatic-tax calculations.
 */
export function buildStripeDeliveryCustomerParams(
  deliveryAddress: StripeTaxDeliveryAddress,
  recipientName: string,
): Stripe.CustomerCreateParams {
  return {
    shipping: {
      name: recipientName,
      address: deliveryAddress,
    },
  };
}

/**
 * Keep billing collection for payment details while preventing Checkout from
 * collecting a second, mutable shipping address. The Customer passed to the
 * Session already contains the server-validated delivery destination above.
 */
export function buildStripeCheckoutTaxLocationParams(customerId: string): Pick<
  Stripe.Checkout.SessionCreateParams,
  "customer" | "customer_update" | "automatic_tax" | "billing_address_collection"
> {
  return {
    customer: customerId,
    customer_update: { address: "auto", name: "auto" },
    automatic_tax: { enabled: true },
    billing_address_collection: "required",
  };
}
