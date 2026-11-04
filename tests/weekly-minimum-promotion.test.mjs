import assert from "node:assert/strict";
import test from "node:test";
import { quoteOrder } from "../app/order-config.ts";

const promotionEnabled = process.env.NEXT_PUBLIC_WEEKLY_MINIMUM_PROMOTION === "true";
const promotionTest = promotionEnabled ? test : test.skip;

promotionTest("temporary promotion accepts one box at 3–4 pricing", () => {
  const quote = quoteOrder([{ productId: "big-chicken", quantity: 1, sauceId: "no-sauce" }]);
  assert.equal(quote.isValid, true);
  assert.equal(quote.pricingTier, "3-4");
  assert.equal(quote.subtotalCents, 1000);
});

promotionTest("temporary promotion accepts exactly two cups at 3–4 pricing", () => {
  const quote = quoteOrder([{ productId: "chicken-cup", quantity: 2, sauceId: "no-sauce" }]);
  assert.equal(quote.isValid, true);
  assert.equal(quote.pricingTier, "3-4");
  assert.equal(quote.subtotalCents, 1400);
});

promotionTest("temporary promotion rejects one cup", () => {
  const quote = quoteOrder([{ productId: "chicken-cup", quantity: 1, sauceId: "no-sauce" }]);
  assert.equal(quote.isValid, false);
  assert.match(quote.errors.join(" "), /1 box or at least 2 cups/);
});

promotionTest("Teriyaki adds one dollar per meal and is preserved in the breakdown line", () => {
  const quote = quoteOrder([{ productId: "big-chicken", quantity: 3, sauceId: "teriyaki" }]);
  assert.equal(quote.isValid, true);
  assert.equal(quote.lines[0].sauceName, "Teriyaki");
  assert.equal(quote.lines[0].sauceUnitAmountCents, 100);
  assert.equal(quote.subtotalCents, 3300);
});
