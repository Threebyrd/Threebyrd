import assert from "node:assert/strict";
import test from "node:test";
import {
  getNextFridayCutoffAfter,
  getSaturdayForCutoff,
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
  assert.equal(mixed.subtotalCents, 3000);
});

test("applies discounts independently per SKU", () => {
  assert.equal(quote(["big-chicken", 4]).subtotalCents, 4000);
  assert.equal(quote(["big-chicken", 5]).subtotalCents, 4500);
  assert.equal(quote(["big-chicken", 6]).subtotalCents, 5400);
  assert.equal(quote(["little-chicken", 4]).subtotalCents, 3200);
  assert.equal(quote(["little-chicken", 5]).subtotalCents, 3000);
  assert.equal(quote(["little-chicken", 6]).subtotalCents, 3600);
  assert.equal(quote(["big-beef", 4]).subtotalCents, 4800);
  assert.equal(quote(["big-beef", 5]).subtotalCents, 5000);
  assert.equal(quote(["big-beef", 6]).subtotalCents, 6000);
  assert.equal(quote(["big-chicken", 3], ["big-beef", 2]).subtotalCents, 5400);
});

test("does not allow Little Beef and keeps Friday 3 PM Eastern DST-safe", () => {
  const unavailable = quote(["little-beef", 3]);
  assert.equal(unavailable.isValid, false);
  assert.match(unavailable.errors[0], /coming soon/);

  const beforeDst = getNextFridayCutoffAfter(new Date("2026-03-06T21:00:00.000Z"));
  const afterDst = getNextFridayCutoffAfter(new Date("2026-03-13T21:00:00.000Z"));
  assert.equal(beforeDst.toISOString(), "2026-03-13T19:00:00.000Z");
  assert.equal(afterDst.toISOString(), "2026-03-20T19:00:00.000Z");
  assert.equal(getSaturdayForCutoff(new Date("2026-09-11T19:00:00.000Z")), "Saturday, September 12");
});
