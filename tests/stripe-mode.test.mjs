import assert from "node:assert/strict";
import test from "node:test";
import {
  getStripe,
  getStripeConfigurationError,
  getStripeMode,
  getStripeTaxConfig,
  isReconciledAutomaticTax,
  getSiteOrigin,
  isStripeEventForMode,
  isStripeKeyForMode,
} from "../app/stripe.ts";

const originalEnvironment = {
  STRIPE_MODE: process.env.STRIPE_MODE,
  STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY,
  NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
  STRIPE_PRODUCT_TAX_CODE: process.env.STRIPE_PRODUCT_TAX_CODE,
  STRIPE_TAX_BEHAVIOR: process.env.STRIPE_TAX_BEHAVIOR,
};

const stripeFixture = (family, mode, suffix) => [family, mode, suffix].join("_");

function withStripeEnvironment(values, callback) {
  if (values.STRIPE_MODE === undefined) delete process.env.STRIPE_MODE;
  else process.env.STRIPE_MODE = values.STRIPE_MODE;

  if (values.STRIPE_SECRET_KEY === undefined) delete process.env.STRIPE_SECRET_KEY;
  else process.env.STRIPE_SECRET_KEY = values.STRIPE_SECRET_KEY;

  if (values.STRIPE_PRODUCT_TAX_CODE === undefined) delete process.env.STRIPE_PRODUCT_TAX_CODE;
  else process.env.STRIPE_PRODUCT_TAX_CODE = values.STRIPE_PRODUCT_TAX_CODE;

  if (values.STRIPE_TAX_BEHAVIOR === undefined) delete process.env.STRIPE_TAX_BEHAVIOR;
  else process.env.STRIPE_TAX_BEHAVIOR = values.STRIPE_TAX_BEHAVIOR;

  try {
    callback();
  } finally {
    if (originalEnvironment.STRIPE_MODE === undefined) delete process.env.STRIPE_MODE;
    else process.env.STRIPE_MODE = originalEnvironment.STRIPE_MODE;
    if (originalEnvironment.STRIPE_SECRET_KEY === undefined) delete process.env.STRIPE_SECRET_KEY;
    else process.env.STRIPE_SECRET_KEY = originalEnvironment.STRIPE_SECRET_KEY;
    if (originalEnvironment.NEXT_PUBLIC_SITE_URL === undefined) delete process.env.NEXT_PUBLIC_SITE_URL;
    else process.env.NEXT_PUBLIC_SITE_URL = originalEnvironment.NEXT_PUBLIC_SITE_URL;
    if (originalEnvironment.STRIPE_PRODUCT_TAX_CODE === undefined) delete process.env.STRIPE_PRODUCT_TAX_CODE;
    else process.env.STRIPE_PRODUCT_TAX_CODE = originalEnvironment.STRIPE_PRODUCT_TAX_CODE;
    if (originalEnvironment.STRIPE_TAX_BEHAVIOR === undefined) delete process.env.STRIPE_TAX_BEHAVIOR;
    else process.env.STRIPE_TAX_BEHAVIOR = originalEnvironment.STRIPE_TAX_BEHAVIOR;
  }
}

test("accepts a test key only in test mode", () => {
  withStripeEnvironment({ STRIPE_MODE: "test", STRIPE_SECRET_KEY: stripeFixture("sk", "test", "example") }, () => {
    assert.equal(getStripeMode(), "test");
    assert.equal(getStripeConfigurationError(), null);
    assert.ok(getStripe());
  });
});

test("uses the Stripe Tax dashboard category by default and permits an explicit override", () => {
  withStripeEnvironment({ STRIPE_PRODUCT_TAX_CODE: "txcd_40060003", STRIPE_TAX_BEHAVIOR: "exclusive" }, () => {
    assert.deepEqual(getStripeTaxConfig(), { productTaxCode: "txcd_40060003", taxBehavior: "exclusive" });
  });

  withStripeEnvironment({ STRIPE_PRODUCT_TAX_CODE: undefined, STRIPE_TAX_BEHAVIOR: "exclusive" }, () => {
    assert.deepEqual(getStripeTaxConfig(), { productTaxCode: null, taxBehavior: "exclusive" });
  });

  withStripeEnvironment({ STRIPE_PRODUCT_TAX_CODE: "not-a-tax-code", STRIPE_TAX_BEHAVIOR: "exclusive" }, () => {
    assert.equal(getStripeTaxConfig(), null);
  });

  withStripeEnvironment({ STRIPE_PRODUCT_TAX_CODE: "txcd_40060003", STRIPE_TAX_BEHAVIOR: "unknown" }, () => {
    assert.equal(getStripeTaxConfig(), null);
  });
});

test("reconciles taxable and non-taxable automatic-tax totals without a promotion", () => {
  assert.equal(isReconciledAutomaticTax({
    enabled: true, status: "complete", subtotalCents: 4_700, discountCents: 0, taxCents: 376, totalCents: 5_076,
  }, 4_700, "exclusive"), true);
  assert.equal(isReconciledAutomaticTax({
    enabled: true, status: "complete", subtotalCents: 4_700, discountCents: 0, taxCents: 0, totalCents: 4_700,
  }, 4_700, "exclusive"), true);
});

test("reconciles Stripe's discounted subtotal, tax, and final total", () => {
  assert.equal(isReconciledAutomaticTax({
    enabled: true, status: "complete", subtotalCents: 4_700, discountCents: 470, taxCents: 338, totalCents: 4_568,
  }, 4_700, "exclusive"), true);
  assert.equal(isReconciledAutomaticTax({
    enabled: true, status: "complete", subtotalCents: 4_700, discountCents: 470, taxCents: 338, totalCents: 5_038,
  }, 4_700, "exclusive"), false);
  assert.equal(isReconciledAutomaticTax({
    enabled: true, status: "complete", subtotalCents: 4_700, discountCents: 4_701, taxCents: 0, totalCents: 0,
  }, 4_700, "exclusive"), false);
});

test("rejects incomplete tax calculation caused by insufficient location data", () => {
  assert.equal(isReconciledAutomaticTax({
    enabled: true, status: "requires_location_inputs", subtotalCents: 4_700, discountCents: 0, taxCents: null, totalCents: 4_700,
  }, 4_700, "exclusive"), false);
});

test("rejects a live key in test mode without exposing it", () => {
  const liveKey = stripeFixture("sk", "live", "secret-value");
  withStripeEnvironment({ STRIPE_MODE: "test", STRIPE_SECRET_KEY: liveKey }, () => {
    const error = getStripeConfigurationError();
    assert.equal(getStripe(), null);
    assert.match(error, /does not match configured Stripe mode/);
    assert.doesNotMatch(error, new RegExp(liveKey));
  });
});

test("accepts a live key only in live mode", () => {
  withStripeEnvironment({ STRIPE_MODE: "live", STRIPE_SECRET_KEY: stripeFixture("rk", "live", "example") }, () => {
    assert.equal(getStripeMode(), "live");
    assert.equal(getStripeConfigurationError(), null);
    assert.ok(getStripe());
  });
});

test("rejects a test key in live mode without exposing it", () => {
  const testKey = stripeFixture("rk", "test", "secret-value");
  withStripeEnvironment({ STRIPE_MODE: "live", STRIPE_SECRET_KEY: testKey }, () => {
    const error = getStripeConfigurationError();
    assert.equal(getStripe(), null);
    assert.match(error, /does not match configured Stripe mode/);
    assert.doesNotMatch(error, new RegExp(testKey));
  });
});

test("rejects an unset or invalid Stripe mode safely", () => {
  const testKey = stripeFixture("sk", "test", "example");
  withStripeEnvironment({ STRIPE_SECRET_KEY: testKey }, () => {
    assert.equal(getStripeMode(), null);
    assert.equal(getStripe(), null);
    assert.match(getStripeConfigurationError(), /STRIPE_MODE/);
  });

  withStripeEnvironment({ STRIPE_MODE: "sandbox", STRIPE_SECRET_KEY: testKey }, () => {
    assert.equal(getStripeMode(), null);
    assert.equal(getStripe(), null);
    assert.match(getStripeConfigurationError(), /STRIPE_MODE/);
  });
});

test("validates both supported Stripe key families without logging or returning key material", () => {
  assert.equal(isStripeKeyForMode(stripeFixture("sk", "test", "example"), "test"), true);
  assert.equal(isStripeKeyForMode(stripeFixture("rk", "test", "example"), "test"), true);
  assert.equal(isStripeKeyForMode(stripeFixture("sk", "live", "example"), "live"), true);
  assert.equal(isStripeKeyForMode(stripeFixture("rk", "live", "example"), "live"), true);
  assert.equal(isStripeKeyForMode(stripeFixture("sk", "live", "example"), "test"), false);
  assert.equal(isStripeKeyForMode(stripeFixture("sk", "test", "example"), "live"), false);
});

test("accepts only matching webhook livemode values", () => {
  assert.equal(isStripeEventForMode(false, "test"), true);
  assert.equal(isStripeEventForMode(true, "test"), false);
  assert.equal(isStripeEventForMode(true, "live"), true);
  assert.equal(isStripeEventForMode(false, "live"), false);
});

test("accepts a root site origin in Worker runtime URL representations", () => {
  const previous = process.env.NEXT_PUBLIC_SITE_URL;
  process.env.NEXT_PUBLIC_SITE_URL = "https://threebyrd.com";
  try {
    assert.equal(getSiteOrigin(), "https://threebyrd.com");
  } finally {
    if (previous === undefined) delete process.env.NEXT_PUBLIC_SITE_URL;
    else process.env.NEXT_PUBLIC_SITE_URL = previous;
  }
});
