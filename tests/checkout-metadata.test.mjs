import assert from "node:assert/strict";
import test from "node:test";
import { buildCheckoutMetadata, quoteOrder } from "../app/order-config.ts";

test("creates deterministic mixed-cart Stripe metadata from the server quote", () => {
  const quote = quoteOrder([
    { productId: "big-chicken", quantity: 3 },
    { productId: "big-beef", quantity: 2 },
  ]);
  const metadata = buildCheckoutMetadata({
    quote,
    reservationId: "reservation-test-id",
    deliveryAddress: "123 State St, Ithaca, NY 14850, USA",
    cutoff: new Date("2026-09-26T19:00:00.000Z"),
  });

  assert.deepEqual(metadata, {
    order_id: "reservation-test-id",
    little_chicken_qty: "0",
    big_chicken_qty: "3",
    little_beef_qty: "0",
    big_beef_qty: "2",
    total_meals: "5",
    delivery_address: "123 State St, Ithaca, NY 14850, USA",
    delivery_date: "2026-09-27",
    cart: "[{\"productId\":\"big-chicken\",\"quantity\":3},{\"productId\":\"big-beef\",\"quantity\":2}]",
    totalBoxes: "5",
    subtotalCents: "4700",
    pricingTier: "5-9",
    cutoffAt: "2026-09-26T19:00:00.000Z",
  });
});

test("metadata ignores client-supplied prices and keeps absent SKU quantities explicit", () => {
  const quote = quoteOrder([{ productId: "little-chicken", quantity: 3 }]);
  const metadata = buildCheckoutMetadata({
    quote,
    reservationId: "reservation-test-id",
    deliveryAddress: "123 State St, Ithaca, NY 14850, USA",
    cutoff: new Date("2026-09-26T19:00:00.000Z"),
  });

  assert.equal(metadata.subtotalCents, "2400");
  assert.equal(metadata.little_chicken_qty, "3");
  assert.equal(metadata.big_chicken_qty, "0");
  assert.equal(metadata.big_beef_qty, "0");
  assert.equal(metadata.little_beef_qty, "0");
});
