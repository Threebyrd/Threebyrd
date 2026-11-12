import assert from "node:assert/strict";
import test from "node:test";
import { buildStripeHostedPromotionCodeParams, readStripeDiscountIdentifiers } from "../app/stripe-promotion-codes.ts";
import { buildOrderSheetPayload } from "../app/order-sheet-sync.ts";
import { buildStripeCheckoutTaxLocationParams } from "../app/stripe-tax-location.ts";

const discountedIthacaOrder = {
  id: "order-discounted",
  stripeSessionId: "cs_test_discounted",
  status: "confirmed",
  customerEmail: "test@example.com",
  customerName: "Test Customer",
  recipientName: "Test Customer",
  customerPhone: "+15555550123",
  deliveryAddress: JSON.stringify({ normalizedAddress: "123 State St, Ithaca, NY 14850, USA" }),
  items: JSON.stringify([{ productId: "big-chicken", quantity: 3 }]),
  subtotalCents: 3_000,
  discountCents: 300,
  taxCents: 216,
  amountCents: 2_916,
  stripePaymentStatus: "paid",
  taxBehavior: "exclusive",
  currency: "usd",
  cutoffAt: "2026-10-03T19:00:00.000Z",
  createdAt: Math.floor(Date.parse("2026-10-02T14:30:00.000Z") / 1000),
  smsConsentDecision: null,
};

test("enables only Stripe Checkout's hosted promotion-code entry", () => {
  assert.deepEqual(buildStripeHostedPromotionCodeParams(), { allow_promotion_codes: true });
  assert.equal("discounts" in buildStripeHostedPromotionCodeParams(), false);
});

test("keeps the server-validated delivery address as the Stripe tax source when promotion codes are enabled", () => {
  const checkoutParams = {
    ...buildStripeCheckoutTaxLocationParams("cus_delivery"),
    ...buildStripeHostedPromotionCodeParams(),
  };
  assert.equal(checkoutParams.allow_promotion_codes, true);
  assert.equal(checkoutParams.billing_address_collection, "required");
  assert.equal(checkoutParams.customer_update.shipping, undefined);
  assert.equal("shipping_address_collection" in checkoutParams, false);
});

test("records Stripe's non-sensitive discount object identifiers without retaining a customer-entered code", () => {
  assert.deepEqual(readStripeDiscountIdentifiers([{
    coupon: { id: "coupon_test_123" },
    promotion_code: "promo_test_123",
  }]), {
    couponId: "coupon_test_123",
    promotionCodeId: "promo_test_123",
  });
  assert.deepEqual(readStripeDiscountIdentifiers(null), { couponId: null, promotionCodeId: null });
});

test("exports Stripe-reconciled discounted subtotal, tax, and final total", () => {
  assert.deepEqual(buildOrderSheetPayload(discountedIthacaOrder, "test"), {
    stripeMode: "test",
    orderDateTime: "2026-10-02 10:30 AM",
    orderId: "order-discounted",
    customerName: "Test Customer",
    recipientName: "Test Customer",
    phone: "+15555550123",
    email: "test@example.com",
    deliveryAddress: "123 State St, Ithaca, NY 14850, USA",
    bigChickenQty: 3,
    littleChickenQty: 0,
    bigBeefQty: 0,
    littleBeefQty: 0,
    chickenCupQty: 0,
    beefCupQty: 0,
    totalMeals: 3,
    mealSubtotal: 30,
    discount: 3,
    salesTax: 2.16,
    totalPaid: 29.16,
    deliveryDate: "2026-10-04",
    stripeSessionId: "cs_test_discounted",
    mealBreakdown: "Big Chicken — No Sauce ×3",
    paymentStatus: "paid",
    orderStatus: "New",
    notes: "Stripe Tax: $2.16",
    smsConsent: "",
  });
});

test("rejects malformed discounted totals before an order can be exported", () => {
  assert.throws(() => buildOrderSheetPayload({ ...discountedIthacaOrder, amountCents: 3_216 }, "test"), /failed Google Sheets export validation/);
  assert.throws(() => buildOrderSheetPayload({ ...discountedIthacaOrder, discountCents: 3_001 }, "test"), /failed Google Sheets export validation/);
});

function withWeeklyMinimumPromotion(run) {
  const previous = process.env.WEEKLY_MINIMUM_PROMOTION;
  process.env.WEEKLY_MINIMUM_PROMOTION = "true";
  try {
    return run();
  } finally {
    if (previous === undefined) delete process.env.WEEKLY_MINIMUM_PROMOTION;
    else process.env.WEEKLY_MINIMUM_PROMOTION = previous;
  }
}

test("exports one box during the weekly minimum promotion", () => {
  withWeeklyMinimumPromotion(() => {
    const payload = buildOrderSheetPayload({
      ...discountedIthacaOrder,
      id: "order-one-box",
      stripeSessionId: "cs_test_one_box",
      items: JSON.stringify([{ productId: "big-chicken", quantity: 1 }]),
      subtotalCents: 1_000,
      discountCents: 0,
      taxCents: 80,
      amountCents: 1_080,
      totalMeals: undefined,
    }, "test");
    assert.equal(payload.totalMeals, 1);
    assert.equal(payload.bigChickenQty, 1);
  });
});

test("exports two cups during the weekly minimum promotion", () => {
  withWeeklyMinimumPromotion(() => {
    const payload = buildOrderSheetPayload({
      ...discountedIthacaOrder,
      id: "order-two-cups",
      stripeSessionId: "cs_test_two_cups",
      items: JSON.stringify([{ productId: "chicken-cup", quantity: 2 }]),
      subtotalCents: 1_400,
      discountCents: 0,
      taxCents: 112,
      amountCents: 1_512,
    }, "test");
    assert.equal(payload.totalMeals, 2);
    assert.equal(payload.chickenCupQty, 2);
  });
});

test("still rejects one cup because the promotion minimum is one box or two cups", () => {
  withWeeklyMinimumPromotion(() => {
    assert.throws(() => buildOrderSheetPayload({
      ...discountedIthacaOrder,
      id: "order-one-cup",
      stripeSessionId: "cs_test_one_cup",
      items: JSON.stringify([{ productId: "chicken-cup", quantity: 1 }]),
      subtotalCents: 700,
      discountCents: 0,
      taxCents: 56,
      amountCents: 756,
    }, "test"), /failed Google Sheets export validation/);
  });
});
