import assert from "node:assert/strict";
import test from "node:test";
import { quoteOrder, getNextOrderCutoff } from "../app/order-config.ts";
import { businessDateKey, rescheduleCycle, validateCalendar } from "../app/subscriptions/calendar.ts";
import { fivePercentDiscount, quoteWeeklyPlan } from "../app/subscriptions/quote.ts";
import { applyPlanAction, changePlanCart, previewWeeklyPlan, recordWelcomeRedemption } from "../app/subscriptions/plan.ts";
import { PREVIEW_CALENDAR as calendar, PREVIEW_PLAN as plan } from "../app/subscriptions/preview-config.ts";

const now = new Date("2026-10-21T17:00:00Z");
const first = calendar[0];
const cart = (quantity, productId = "big-chicken", sauceId = "no-sauce") => [{ productId, quantity, sauceId }];
const preview = (overrides = {}, time = now, ledger = [], dates = calendar, availability = {}) => previewWeeklyPlan({ ...plan, ...overrides }, dates, ledger, time, availability);
const paidEvent = {
  verifiedCustomerId: plan.verifiedCustomerId, orderId: "order-one", cycleId: first.id,
  occurredAt: first.cutoffAt, paymentStatus: "paid", orderKind: "weekly", includedWelcomeBox: true,
};

for (const [count, tier, subtotal] of [[3, "3-4", 3000], [4, "3-4", 4000], [5, "5-9", 4500], [9, "5-9", 8100], [10, "10+", 8500], [11, "10+", 9350]]) {
  test(`weekly pricing uses paid quantity ${count} and tier ${tier}`, () => {
    const quote = quoteWeeklyPlan(cart(count), plan.welcomeSelection);
    assert.equal(quote.isValid, true);
    assert.equal(quote.pricingTier, tier);
    assert.equal(quote.subtotalBeforeDiscountCents, subtotal);
    assert.equal(quote.discountCents, Math.round(subtotal * 0.05));
    assert.equal(quote.subtotalBeforeTaxCents + quote.discountCents, subtotal);
    assert.equal(quote.fulfillmentMealCount, count + 1);
    assert.equal(quote.taxStatus, "not_calculated");
  });
}

test("discount rounds half cents once on the complete subtotal", () => {
  assert.equal(fivePercentDiscount(9350), 468);
  assert.equal(fivePercentDiscount(1), 0);
  assert.equal(fivePercentDiscount(10), 1);
  assert.equal(fivePercentDiscount(29), 1);
  for (const invalid of [-1, 1.5, NaN, Infinity, Number.MAX_SAFE_INTEGER]) assert.throws(() => fivePercentDiscount(invalid));
  const mixed = quoteWeeklyPlan([...cart(3), ...cart(8, "big-beef")], null);
  assert.equal(mixed.discountCents, 508); // 3×850 + 8×950 = 10150; 5% = 507.5.
});

test("paid weekly sauces retain full charges while only welcome sauce is included", () => {
  const original = quoteOrder(cart(5, "big-chicken", "bbq"));
  assert.equal(original.subtotalCents, 5000);
  const before = JSON.stringify(original);
  for (const sauce of ["no-sauce", "bbq", "franks-redhot"]) {
    const quote = quoteWeeklyPlan(cart(5, "big-chicken", sauce), { productId: "little-beef", sauceId: sauce });
    assert.equal(quote.subtotalBeforeTaxCents, sauce === "no-sauce" ? 4275 : 4775);
    assert.equal(quote.discountCents, 225);
    assert.equal(quote.sauceSubtotalCents, sauce === "no-sauce" ? 0 : 500);
    assert.equal(quote.welcomeLine.amountCents, 0);
    assert.ok(quote.paidLines.every((line) => line.sauceUnitAmountCents === (sauce === "no-sauce" ? 0 : 100)));
  }
  assert.equal(JSON.stringify(quoteOrder(cart(5, "big-chicken", "bbq"))), before);
});

test("a free box neither qualifies for a tier nor satisfies the paid minimum", () => {
  const tooSmall = quoteWeeklyPlan(cart(2), plan.welcomeSelection);
  assert.equal(tooSmall.fulfillmentMealCount, 3);
  assert.equal(tooSmall.isValid, false);
  const four = quoteWeeklyPlan(cart(4), plan.welcomeSelection);
  assert.equal(four.fulfillmentMealCount, 5);
  assert.equal(four.pricingTier, "3-4");
  const nine = quoteWeeklyPlan(cart(9), plan.welcomeSelection);
  assert.equal(nine.fulfillmentMealCount, 10);
  assert.equal(nine.pricingTier, "5-9");
});

test("untrusted price, discount, and entitlement fields do not alter the quote", () => {
  const quote = quoteWeeklyPlan([{ ...cart(3)[0], unitAmountCents: 1, discountPercent: 100, freeMealCount: 20 }], null);
  assert.equal(quote.subtotalBeforeDiscountCents, 3000);
  assert.equal(quote.discountCents, 150);
  assert.equal(quote.freeMealCount, 0);
});

test("catalog, quantities, and welcome selections are revalidated", () => {
  for (const invalid of [cart(3, "unknown"), cart(3, "big-chicken", "unknown"), cart(-1), cart(3.5), cart(100)]) assert.equal(quoteWeeklyPlan(invalid, null).isValid, false);
  assert.equal(quoteWeeklyPlan(cart(3), { productId: "unknown", sauceId: "bbq" }).isValid, false);
  assert.equal(quoteWeeklyPlan(cart(3), { productId: "little-beef", sauceId: "unknown" }).isValid, false);
  const unavailable = preview({}, now, [], calendar, { unavailableProductIds: ["little-beef"] });
  assert.equal(unavailable.next.status, "blocked");
  assert.equal(unavailable.next.quote.welcomeLine, null);
  assert.match(unavailable.next.reason, /replacement/);
  assert.equal(preview({}, now, [], calendar, { unavailableSauceIds: ["bbq"] }).next.status, "blocked");
  assert.equal(preview({ welcomeSelection: null }).next.status, "blocked");
});

test("one-week and permanent edits preserve intent without modifying the original plan", () => {
  const one = changePlanCart(plan, calendar, first.id, cart(4, "big-beef", "franks-redhot"), "this_delivery", now, []);
  const result = previewWeeklyPlan(one, calendar, [], now);
  assert.equal(result.next.quote.paidLines[0].name, "Big Beef");
  assert.equal(result.cycles[1].quote.paidLines[0].name, "Big Chicken");
  const permanent = changePlanCart(one, calendar, first.id, cart(6, "little-chicken"), "this_and_future", now, []);
  const later = previewWeeklyPlan(permanent, calendar, [], now);
  assert.equal(later.next.quote.paidMealCount, 6);
  assert.equal(later.cycles[1].quote.paidMealCount, 6);
  assert.equal(Object.keys(permanent.overrides).length, 0);
  assert.equal(Object.keys(plan.overrides).length, 0);
  assert.equal(plan.defaultCart[0].quantity, 5);
  assert.throws(() => changePlanCart(plan, calendar, calendar[1].id, cart(3), "this_and_future", now, []), /next editable/);
});

test("edits and skips at cutoff or on committed cycles are rejected", () => {
  const exact = new Date(first.cutoffAt);
  assert.throws(() => changePlanCart(plan, calendar, first.id, cart(3), "this_delivery", exact, []), /cannot be edited/);
  assert.throws(() => changePlanCart(plan, calendar, first.id, cart(3), "this_delivery", now, [first.id]), /cannot be edited/);
  assert.throws(() => applyPlanAction(plan, calendar, { type: "skip", cycleId: first.id }, exact, []), /committed/);
  assert.throws(() => applyPlanAction(plan, calendar, { type: "skip", cycleId: first.id }, now, [first.id]), /committed/);
  assert.throws(() => changePlanCart(plan, calendar, first.id, cart(2), "this_delivery", now, []), /minimum/);
});

test("signup before, at, and after cutoff uses the correct open cycle", () => {
  const ms = Date.parse(first.cutoffAt);
  assert.equal(preview({}, new Date(ms - 1)).next.cycle.id, first.id);
  assert.equal(preview({ enrolledAt: first.cutoffAt }, new Date(ms)).next.cycle.id, calendar[1].id);
  assert.equal(preview({ enrolledAt: new Date(ms + 1).toISOString() }, new Date(ms + 1)).next.cycle.id, calendar[1].id);
  assert.equal(preview({}, new Date(ms)).cycles[0].status, "cutoff_passed");
});

test("closure has no quote or charge proposal and resumes at the next open cycle", () => {
  const result = preview({}, new Date("2026-11-23T17:00:00Z"));
  assert.equal(result.cycles[4].status, "closed");
  assert.equal(result.cycles[4].quote, null);
  assert.equal(result.next.cycle.id, calendar[5].id);
  assert.equal(result.next.quote.freeMealCount, 1);
});

test("skip and unskip do not redeem a welcome box", () => {
  const skipped = applyPlanAction(plan, calendar, { type: "skip", cycleId: first.id }, now, []);
  const result = previewWeeklyPlan(skipped, calendar, [], now);
  assert.equal(result.cycles[0].status, "skipped");
  assert.equal(result.cycles[0].quote, null);
  assert.equal(result.next.cycle.id, calendar[1].id);
  assert.equal(result.next.quote.freeMealCount, 1);
  assert.equal(result.cycles[2].quote.freeMealCount, 0);
  const unskipped = applyPlanAction(skipped, calendar, { type: "unskip", cycleId: first.id }, now, []);
  assert.equal(previewWeeklyPlan(unskipped, calendar, [], now).next.cycle.id, first.id);
});

test("indefinite pause, closed return cycle, resume, and cancellation are explicit", () => {
  const paused = applyPlanAction(plan, calendar, { type: "pause", resumeCycleId: null }, now, []);
  assert.equal(previewWeeklyPlan(paused, calendar, [], now).next, null);
  const timed = applyPlanAction(plan, calendar, { type: "pause", resumeCycleId: calendar[4].id }, now, []);
  assert.equal(previewWeeklyPlan(timed, calendar, [], now).next.cycle.id, calendar[5].id);
  const resumed = applyPlanAction(paused, calendar, { type: "resume" }, now, []);
  assert.equal(previewWeeklyPlan(resumed, calendar, [], now).next.cycle.id, first.id);
  const canceled = applyPlanAction(resumed, calendar, { type: "cancel" }, now, []);
  assert.equal(previewWeeklyPlan(canceled, calendar, [], now).next, null);
  assert.throws(() => applyPlanAction(canceled, calendar, { type: "resume" }, now, []), /new enrollment/);
  assert.throws(() => applyPlanAction(plan, calendar, { type: "pause", resumeCycleId: "unpublished" }, now, []), /published/);
});

test("rescheduling Saturday to Sunday preserves skips, overrides, and sequence", () => {
  const moved = rescheduleCycle(calendar, first.id, { deliveryDate: "2026-11-01", cutoffAt: first.cutoffAt, chargeAt: first.chargeAt }, []);
  assert.equal(moved[0].id, first.id);
  assert.equal(moved[0].sequence, first.sequence);
  const skipped = preview({ skippedCycleIds: [first.id] }, now, [], moved);
  assert.equal(skipped.cycles[0].status, "skipped");
  const override = preview({ overrides: { [first.id]: cart(4, "big-beef") } }, now, [], moved);
  assert.equal(override.next.quote.paidLines[0].name, "Big Beef");
  assert.equal(override.next.cycle.deliveryDate, "2026-11-01");
  assert.equal(calendar[0].deliveryDate, "2026-10-31");
  assert.throws(() => rescheduleCycle(calendar, first.id, { deliveryDate: "2026-11-01", cutoffAt: first.cutoffAt, chargeAt: first.chargeAt }, [first.id]), /support/);
});

test("DST preserves 3 PM New York deadlines, with explicit UTC shifts", () => {
  assert.equal(new Date(calendar[0].cutoffAt).toISOString(), "2026-10-30T19:00:00.000Z");
  assert.equal(new Date(calendar[1].cutoffAt).toISOString(), "2026-11-06T20:00:00.000Z");
  const spring = [
    { ...first, id: "spring-before", sequence: 1, deliveryDate: "2027-03-06", cutoffAt: "2027-03-05T15:00:00-05:00", chargeAt: "2027-03-05T15:00:00-05:00" },
    { ...first, id: "spring-after", sequence: 2, deliveryDate: "2027-03-14", cutoffAt: "2027-03-12T15:00:00-04:00", chargeAt: "2027-03-12T15:00:00-04:00" },
  ];
  assert.equal(validateCalendar(spring).length, 2);
  assert.equal(new Date(spring[0].cutoffAt).getUTCHours(), 20);
  assert.equal(new Date(spring[1].cutoffAt).getUTCHours(), 19);
  assert.equal(businessDateKey(new Date("2026-11-01T02:00:00Z")), "2026-10-31");
  // Normal one-time cutoffs agree with the sample's Friday 3 PM deadline.
  assert.equal(getNextOrderCutoff(new Date("2026-10-29T17:00:00Z")).getTime(), Date.parse(first.cutoffAt));
});

test("invalid and ambiguous calendars fail closed", () => {
  for (const changed of [
    { deliveryDate: "2026-10-32" }, { deliveryDate: "2026-11-02" },
    { cutoffAt: "2026-10-30T15:00:00" }, { chargeAt: "2026-10-30T19:01:00Z" },
    { cutoffAt: "2026-10-31T15:00:00-04:00", chargeAt: "2026-10-31T15:00:00-04:00" },
  ]) assert.throws(() => validateCalendar([{ ...first, ...changed }]));
  assert.throws(() => validateCalendar([first, first]), /unique/);
  assert.throws(() => validateCalendar([first, { ...calendar[1], cutoffAt: "2026-10-29T15:00:00-04:00", chargeAt: "2026-10-29T15:00:00-04:00" }]), /chronology/);
  assert.throws(() => preview({ skippedCycleIds: ["unknown"] }), /Unknown/);
});

test("no eligible published cycle produces no invented date or quote", () => {
  const empty = preview({}, now, [], []);
  assert.equal(empty.next, null);
  assert.match(empty.message, /cannot yet be scheduled/);
  const exhausted = preview({}, new Date("2026-12-04T20:00:00Z"));
  assert.equal(exhausted.next, null);
});

test("welcome redemption survives retries, failures, refunds, rejoining, and Stripe IDs", () => {
  const ledger = [];
  assert.equal(recordWelcomeRedemption(ledger, { ...paidEvent, paymentStatus: "failed" }), ledger);
  assert.equal(recordWelcomeRedemption(ledger, { ...paidEvent, orderKind: "one_time" }), ledger);
  assert.equal(recordWelcomeRedemption(ledger, { ...paidEvent, includedWelcomeBox: false }), ledger);
  assert.equal(preview({}, now, ledger).next.quote.freeMealCount, 1);
  const paid = recordWelcomeRedemption(ledger, paidEvent);
  assert.equal(paid.length, 1);
  assert.equal(recordWelcomeRedemption(paid, paidEvent), paid);
  assert.equal(recordWelcomeRedemption(paid, { ...paidEvent, paymentStatus: "refunded" }), paid);
  const rejoined = preview({ id: "new-plan-after-cancel" }, now, paid);
  assert.equal(rejoined.welcomeEligible, false);
  assert.equal(rejoined.next.quote.freeMealCount, 0);
  const differentCustomer = preview({ verifiedCustomerId: "different-verified-customer" }, now, paid);
  assert.equal(differentCustomer.next.quote.freeMealCount, 1);
  assert.equal(ledger.length, 0);
});

test("preview is pure and an unsuccessful first week moves welcome eligibility forward", () => {
  const before = JSON.stringify({ plan, calendar });
  const firstPreview = preview();
  assert.equal(firstPreview.next.quote.freeMealCount, 1);
  assert.equal(firstPreview.cycles[1].quote.freeMealCount, 0);
  const afterFailedPayment = preview({}, new Date(Date.parse(first.cutoffAt) + 1), []);
  assert.equal(afterFailedPayment.next.cycle.id, calendar[1].id);
  assert.equal(afterFailedPayment.next.quote.freeMealCount, 1);
  assert.equal(JSON.stringify({ plan, calendar }), before);
});


test("usual-order edits can start after a skip or at a timed pause's return", () => {
  const skipped = { ...plan, skippedCycleIds: [first.id] };
  const edited = changePlanCart(skipped, calendar, calendar[1].id, cart(4, "big-beef"), "this_and_future", now, []);
  assert.equal(previewWeeklyPlan(edited, calendar, [], now).next.quote.paidLines[0].name, "Big Beef");
  const paused = { ...plan, status: "paused", resumeCycleId: calendar[4].id };
  const returnEdit = changePlanCart(paused, calendar, calendar[5].id, cart(4, "big-beef"), "this_and_future", now, []);
  assert.equal(previewWeeklyPlan(returnEdit, calendar, [], now).next.cycle.id, calendar[5].id);
  assert.equal(previewWeeklyPlan(returnEdit, calendar, [], now).next.quote.paidLines[0].name, "Big Beef");
  assert.throws(() => changePlanCart(paused, calendar, first.id, cart(3), "this_delivery", now, []), /scheduled return/);
});

test('weekly menu automatically separates one selected welcome box from paid quantities and tiers',async()=>{
 const {splitWelcomeCart}=await import('../app/subscriptions/welcome-cart.ts');
 const selections=[...Array.from({length:3},(_,i)=>({id:`big-${i}`,productId:'big-chicken',sauceId:'no-sauce'})),{id:'gift',productId:'little-beef',sauceId:'bbq'}];
 const split=splitWelcomeCart(selections,true,"gift");
 const quote=quoteWeeklyPlan(split.paid.map(s=>({...s,quantity:1})),split.gift);
 assert.equal(quote.paidMealCount,3);assert.equal(quote.freeMealCount,1);assert.equal(quote.fulfillmentMealCount,4);
 assert.equal(quote.subtotalBeforeTaxCents,2850);assert.equal(quote.welcomeLine.amountCents,0);
 assert.equal(quoteOrder(selections.map(s=>({...s,quantity:1}))).subtotalCents,4000);
 const returning=splitWelcomeCart(selections,false);assert.equal(returning.gift,null);assert.equal(returning.paid.length,4);
 const extra=splitWelcomeCart([...selections,{id:'extra',productId:'little-chicken',sauceId:'no-sauce'}],true);
 assert.equal(extra.paid.length,4);assert.equal(extra.gift.id,'big-0');
 const changed=splitWelcomeCart([...selections,{id:'restored-gift',productId:'little-chicken',sauceId:'no-sauce'}],true,'restored-gift');assert.equal(changed.gift.id,'restored-gift');
 const minimum=splitWelcomeCart(selections.slice(1),true);assert.equal(quoteWeeklyPlan(minimum.paid.map(s=>({...s,quantity:1})),minimum.gift).isValid,false);
});
