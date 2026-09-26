import assert from "node:assert/strict";
import test from "node:test";
import {
  CART_PRICING_TIERS,
  formatCompactMoney,
  getNextPricingTier,
  getNextOrderCutoff,
  getOrderCapacityWindowKey,
  getNextSaturdayCutoffAfter,
  getSaturdayForCutoff,
  getCartPricingTier,
  getProduct,
  ORDERS_OPEN,
  priceRangeFor,
  quoteOrder,
} from "../app/order-config.ts";

function quote(...items) {
  return quoteOrder(items.map(([productId, quantity]) => ({ productId, quantity })));
}

test("blocks one and two boxes, and allows a mixed three-box order", () => {
  assert.equal(ORDERS_OPEN, true);
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
  assert.equal(quote(["big-chicken", 20]).subtotalCents, 17000);
  assert.equal(quote(["big-chicken", 21]).subtotalCents, 17850);
  assert.equal(quote(["little-chicken", 5]).subtotalCents, 3500);
  assert.equal(quote(["little-chicken", 10]).subtotalCents, 7000);
  assert.equal(quote(["little-chicken", 20]).subtotalCents, 14000);
  assert.equal(quote(["big-beef", 5]).subtotalCents, 5000);
  assert.equal(quote(["big-beef", 10]).subtotalCents, 9500);
  assert.equal(quote(["big-beef", 20]).subtotalCents, 19000);
  assert.equal(quote(["little-beef", 3]).subtotalCents, 2700);
  assert.equal(quote(["little-beef", 5]).subtotalCents, 4000);
  assert.equal(quote(["little-beef", 10]).subtotalCents, 8000);
  assert.equal(quote(["little-beef", 20]).subtotalCents, 16000);
  assert.equal(getCartPricingTier(2), undefined);
  assert.equal(getCartPricingTier(3), "3-4");
  assert.equal(getCartPricingTier(4), "3-4");
  assert.equal(getCartPricingTier(5), "5-9");
  assert.equal(getCartPricingTier(9), "5-9");
  assert.equal(getCartPricingTier(10), "10+");
  assert.equal(getCartPricingTier(19), "10+");
  assert.equal(getCartPricingTier(20), "10+");
  assert.equal(getCartPricingTier(21), "10+");
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

test("keeps the canonical matrix and all four purchasable product details", () => {
  assert.deepEqual(CART_PRICING_TIERS["3-4"].prices, {
    "big-chicken": 1000,
    "little-chicken": 800,
    "big-beef": 1100,
    "little-beef": 900,
  });
  assert.deepEqual(CART_PRICING_TIERS["5-9"].prices, {
    "big-chicken": 900,
    "little-chicken": 700,
    "big-beef": 1000,
    "little-beef": 800,
  });
  assert.deepEqual(CART_PRICING_TIERS["10+"].prices, {
    "big-chicken": 850,
    "little-chicken": 700,
    "big-beef": 950,
    "little-beef": 800,
  });

  const littleBeef = getProduct("little-beef");
  assert.equal(littleBeef?.purchasable, true);
  assert.deepEqual({
    calories: littleBeef?.calories,
    proteinGrams: littleBeef?.proteinGrams,
    carbs: littleBeef?.carbs,
    fat: littleBeef?.fat,
  }, { calories: "785", proteinGrams: "46g", carbs: "83g", fat: "41g" });
  assert.deepEqual({
    calories: getProduct("big-beef")?.calories,
    proteinGrams: getProduct("big-beef")?.proteinGrams,
    carbs: getProduct("big-beef")?.carbs,
    fat: getProduct("big-beef")?.fat,
  }, { calories: "1115", proteinGrams: "70g", carbs: "114g", fat: "41g" });
  assert.equal(quote(["little-beef", 3]).isValid, true);
  assert.equal(quote(["little-beef", 3]).subtotalCents, 2700);
  assert.deepEqual(priceRangeFor(getProduct("little-chicken")), { highestCents: 800, lowestCents: 700 });
  assert.deepEqual(priceRangeFor(littleBeef), { highestCents: 900, lowestCents: 800 });
  assert.equal(formatCompactMoney(900), "$9");
  assert.equal(formatCompactMoney(700), "$7");
});

test("derives next-tier messaging from the canonical tier definitions", () => {
  assert.deepEqual(getNextPricingTier(0), { tier: "3-4", mealsUntil: 3 });
  assert.deepEqual(getNextPricingTier(3), { tier: "5-9", mealsUntil: 2 });
  assert.deepEqual(getNextPricingTier(7), { tier: "10+", mealsUntil: 3 });
  assert.deepEqual(getNextPricingTier(9), { tier: "10+", mealsUntil: 1 });
  assert.equal(getNextPricingTier(10), undefined);
  assert.equal(getNextPricingTier(20), undefined);
});

test("rejects invalid and malformed cart items", () => {

  assert.equal(quote(["not-a-product", 3]).isValid, false);
  assert.equal(quote(["big-chicken", 0]).isValid, false);
  assert.equal(quote(["big-chicken", -1]).isValid, false);
  assert.equal(quote(["big-chicken", 1.5]).isValid, false);
  assert.equal(quoteOrder([{ productId: "big-chicken", quantity: 3, price: 1 }, { productId: "big-beef", quantity: "2" }]).isValid, false);
  const manipulated = quoteOrder([{ productId: "big-chicken", quantity: 5, unitAmountCents: 1, subtotalCents: 1 }]);
  assert.equal(manipulated.subtotalCents, 4500);
});

test("keeps Saturday 3 PM Eastern DST-safe", () => {

  const beforeDst = getNextSaturdayCutoffAfter(new Date("2026-03-07T20:00:00.000Z"));
  const afterDst = getNextSaturdayCutoffAfter(new Date("2026-03-14T20:00:00.000Z"));
  assert.equal(beforeDst.toISOString(), "2026-03-14T19:00:00.000Z");
  assert.equal(afterDst.toISOString(), "2026-03-21T19:00:00.000Z");
  assert.equal(getSaturdayForCutoff(new Date("2026-09-12T19:00:00.000Z")), "Sunday, September 13");
});

test("uses the one-time Saturday cutoff and resumes Saturday scheduling afterward", () => {
  const previous = process.env.THREEBYRD_CUTOFF_OVERRIDE;
  process.env.THREEBYRD_CUTOFF_OVERRIDE = "2026-09-26T15:00:00";
  try {
    const fridayAfternoon = getNextOrderCutoff(new Date("2026-09-25T18:59:00.000Z"));
    const justBeforeCutoff = getNextOrderCutoff(new Date("2026-09-26T18:59:59.000Z"));
    const atCutoff = getNextOrderCutoff(new Date("2026-09-26T19:00:00.000Z"));
    const justAfterCutoff = getNextOrderCutoff(new Date("2026-09-26T19:00:01.000Z"));
    const sunday = getNextOrderCutoff(new Date("2026-09-27T16:00:00.000Z"));
    const nextFriday = getNextOrderCutoff(new Date("2026-10-02T18:59:59.000Z"));
    const nextCutoff = getNextOrderCutoff(new Date("2026-10-03T19:00:00.000Z"));

    assert.equal(fridayAfternoon.toISOString(), "2026-09-26T19:00:00.000Z");
    assert.equal(justBeforeCutoff.toISOString(), "2026-09-26T19:00:00.000Z");
    assert.equal(atCutoff.toISOString(), "2026-10-03T19:00:00.000Z");
    assert.equal(justAfterCutoff.toISOString(), "2026-10-03T19:00:00.000Z");
    assert.equal(sunday.toISOString(), "2026-10-03T19:00:00.000Z");
    assert.equal(nextFriday.toISOString(), "2026-10-03T19:00:00.000Z");
    assert.equal(nextCutoff.toISOString(), "2026-10-10T19:00:00.000Z");

    assert.equal(getOrderCapacityWindowKey(justBeforeCutoff), "2026-09-26");
    assert.equal(getOrderCapacityWindowKey(atCutoff), "2026-10-03");
    assert.equal(getSaturdayForCutoff(justBeforeCutoff), "Sunday, September 27");
    assert.equal(getSaturdayForCutoff(atCutoff), "Sunday, October 4");
    assert.equal(getSaturdayForCutoff(nextCutoff), "Sunday, October 11");
  } finally {
    if (previous === undefined) delete process.env.THREEBYRD_CUTOFF_OVERRIDE;
    else process.env.THREEBYRD_CUTOFF_OVERRIDE = previous;
  }
});
