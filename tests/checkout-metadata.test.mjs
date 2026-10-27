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
    smsReminderDecision: "yes",
    smsReminderDecisionAt: new Date("2026-09-25T12:00:00.000Z"),
  });

  assert.deepEqual(metadata, {
    order_id: "reservation-test-id",
    little_chicken_qty: "0",
    big_chicken_qty: "3",
    little_beef_qty: "0",
    big_beef_qty: "2",
    chicken_cup_qty: "0",
    beef_cup_qty: "0",
    total_meals: "5",
    delivery_address: "123 State St, Ithaca, NY 14850, USA",
    delivery_date: "2026-09-27",
    cart: "[{\"productId\":\"big-chicken\",\"quantity\":3},{\"productId\":\"big-beef\",\"quantity\":2}]",
    totalBoxes: "5",
    subtotalCents: "4700",
    pricingTier: "5-9",
    cutoffAt: "2026-09-26T19:00:00.000Z",
    smsReminderDecision: "yes",
    smsReminderDisclosureVersion: "separate-sms-v2",
    smsMarketingDecision: "no",
    smsReminderDecisionAt: "2026-09-25T12:00:00.000Z",
    smsReminderSource: "checkout",
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

test("metadata preserves per-meal sauce groups while keeping product quantities complete", () => {
  const quote = quoteOrder([
    { productId: "big-chicken", quantity: 1, sauceId: "no-sauce" },
    { productId: "big-chicken", quantity: 1, sauceId: "bbq" },
    { productId: "little-beef", quantity: 1, sauceId: "franks-redhot" },
  ]);
  const metadata = buildCheckoutMetadata({
    quote,
    reservationId: "reservation-sauce-test",
    deliveryAddress: "123 State St, Ithaca, NY 14850, USA",
    cutoff: new Date("2026-09-26T19:00:00.000Z"),
  });

  assert.equal(metadata.total_meals, "3");
  assert.equal(metadata.big_chicken_qty, "2");
  assert.equal(metadata.little_beef_qty, "1");
  assert.deepEqual(JSON.parse(metadata.cart), [
    { productId: "big-chicken", quantity: 1 },
    { productId: "big-chicken", quantity: 1, sauceId: "bbq" },
    { productId: "little-beef", quantity: 1, sauceId: "franks-redhot" },
  ]);
  assert.equal(metadata.subtotalCents, "3100");
});


test("order and marketing choices stay independent in payment metadata", () => {
  for (const order of ["yes", "no"]) for (const marketing of ["yes", "no"]) {
    const metadata = buildCheckoutMetadata({ quote: quoteOrder([{ productId: "big-chicken", quantity: 3 }]), reservationId: "test", deliveryAddress: "Test address", cutoff: new Date("2026-10-24T19:00:00Z"), smsReminderDecision: order, smsMarketingDecision: marketing, smsReminderDecisionAt: new Date("2026-10-21T17:00:00Z") });
    assert.equal(metadata.smsReminderDecision, order);
    assert.equal(metadata.smsMarketingDecision, marketing);
    assert.equal(metadata.smsReminderDisclosureVersion, "separate-sms-v2");
  }
});
