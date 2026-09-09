import assert from "node:assert/strict";
import test from "node:test";
import {
  getNextFridayCutoffAfter,
  getSaturdayForCutoff,
  getCartPricingTier,
  ORDERS_OPEN,
  quoteOrder,
} from "../app/order-config.ts";

function quote(...items) {
  return quoteOrder(items.map(([productId, quantity]) => ({ productId, quantity })));
}

test("blocks one and two boxes, and allows a mixed three-box order", () => {
  assert.equal(ORDERS_OPEN, false);
  assert.equal(quote(["big-chicken", 1]).isValid, false);
  assert.match(quote(["big-chicken", 2]).errors[0], /Add 1 more box/);
  const mixed = quote(["big-chicken", 1], ["little-chicken", 1], ["big-beef", 1]);
  assert.equal(mixed.isValid, true);
  assert.equal(mixed.subtotalCents, 2900);
});

test("applies the cart-wide pricing tier at every boundary", () => {
  assert.equal(quote(["big-chicken", 4]).subtotalCents, 4000);
  assert.equal(quote(["big-chicken", 5]).subtotalCents, 4500);
  assert.equal(quote(["big-chicken", 9]).subtotalCents, 8100);
  assert.equal(quote(["big-chicken", 10]).subtotalCents, 8500);
  assert.equal(quote(["big-chicken", 19]).subtotalCents, 16150);
  assert.equal(quote(["big-chicken", 20]).subtotalCents, 16000);
  assert.equal(quote(["big-chicken", 21]).subtotalCents, 16800);
  assert.equal(quote(["little-chicken", 5]).subtotalCents, 3750);
  assert.equal(quote(["little-chicken", 10]).subtotalCents, 7000);
  assert.equal(quote(["little-chicken", 20]).subtotalCents, 13000);
  assert.equal(quote(["big-beef", 5]).subtotalCents, 5000);
  assert.equal(quote(["big-beef", 10]).subtotalCents, 9500);
  assert.equal(quote(["big-beef", 20]).subtotalCents, 18000);
  assert.equal(getCartPricingTier(2), undefined);
  assert.equal(getCartPricingTier(3), "3-4");
  assert.equal(getCartPricingTier(4), "3-4");
  assert.equal(getCartPricingTier(5), "5-9");
  assert.equal(getCartPricingTier(9), "5-9");
  assert.equal(getCartPricingTier(10), "10-19");
  assert.equal(getCartPricingTier(19), "10-19");
  assert.equal(getCartPricingTier(20), "20+");
  assert.equal(getCartPricingTier(21), "20+");
});

test("applies one tier to mixed-product carts", () => {
  const mixed = quote(["big-chicken", 3], ["big-beef", 2]);
  assert.equal(mixed.pricingTier, "5-9");
  assert.deepEqual(mixed.lines.map(({ productId, unitAmountCents, amountCents }) => ({ productId, unitAmountCents, amountCents })), [
    { productId: "big-chicken", unitAmountCents: 900, amountCents: 2700 },
    { productId: "big-beef", unitAmountCents: 1000, amountCents: 2000 },
  ]);
  assert.equal(mixed.subtotalCents, 4700);
});

test("rejects unavailable and malformed cart items", () => {
  const unavailable = quote(["little-beef", 3]);
  assert.equal(unavailable.isValid, false);
  assert.match(unavailable.errors[0], /coming soon/);

  assert.equal(quote(["not-a-product", 3]).isValid, false);
  assert.equal(quote(["big-chicken", 0]).isValid, false);
  assert.equal(quote(["big-chicken", -1]).isValid, false);
  assert.equal(quote(["big-chicken", 1.5]).isValid, false);
  assert.equal(quoteOrder([{ productId: "big-chicken", quantity: 3, price: 1 }, { productId: "big-beef", quantity: "2" }]).isValid, false);
  const manipulated = quoteOrder([{ productId: "big-chicken", quantity: 5, unitAmountCents: 1, subtotalCents: 1 }]);
  assert.equal(manipulated.subtotalCents, 4500);
});

test("keeps Friday 3 PM Eastern DST-safe", () => {

  const beforeDst = getNextFridayCutoffAfter(new Date("2026-03-06T21:00:00.000Z"));
  const afterDst = getNextFridayCutoffAfter(new Date("2026-03-13T21:00:00.000Z"));
  assert.equal(beforeDst.toISOString(), "2026-03-13T19:00:00.000Z");
  assert.equal(afterDst.toISOString(), "2026-03-20T19:00:00.000Z");
  assert.equal(getSaturdayForCutoff(new Date("2026-09-11T19:00:00.000Z")), "Saturday, September 12");
});
