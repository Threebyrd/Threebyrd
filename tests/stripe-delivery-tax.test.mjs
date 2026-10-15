import assert from "node:assert/strict";
import test from "node:test";
import {
  buildStripeCheckoutTaxLocationParams,
  buildStripeDeliveryCustomerParams,
} from "../app/stripe-tax-location.ts";

const ithacaDeliveryAddress = {
  line1: "123 State St",
  city: "Ithaca",
  state: "NY",
  postal_code: "14850",
  country: "US",
};

test("uses the server-validated Ithaca delivery address as Stripe's shipping tax location", () => {
  // The checkout billing address can be anywhere; it is not accepted by this
  // builder and therefore cannot replace the verified delivery destination.
  assert.deepEqual(buildStripeDeliveryCustomerParams(ithacaDeliveryAddress, "Test Recipient"), {
    shipping: {
      name: "Test Recipient",
      address: ithacaDeliveryAddress,
    },
  });

  assert.deepEqual(buildStripeCheckoutTaxLocationParams("cus_delivery_tax"), {
    customer: "cus_delivery_tax",
    customer_update: { address: "auto", name: "auto" },
    automatic_tax: { enabled: true },
    billing_address_collection: "required",
  });
});

test("keeps Checkout billing collection but never adds a second mutable shipping-address form", () => {
  const params = buildStripeCheckoutTaxLocationParams("cus_delivery_tax");
  assert.equal(params.billing_address_collection, "required");
  assert.equal(params.customer_update.shipping, undefined);
  assert.equal("shipping_address_collection" in params, false);
});

test("does not add a manual tax rate for destinations where there is no active registration", () => {
  const shipping = buildStripeDeliveryCustomerParams({
    ...ithacaDeliveryAddress,
    state: "PA",
    postal_code: "18840",
  }, "Test Recipient");
  assert.equal("tax_exempt" in shipping, false);
  assert.equal("tax" in shipping, false);
  assert.deepEqual(shipping.shipping?.address, {
    ...ithacaDeliveryAddress,
    state: "PA",
    postal_code: "18840",
  });
});
