import assert from "node:assert/strict";
import test from "node:test";
import {
  getStripe,
  getStripeConfigurationError,
  getStripeMode,
  getSiteOrigin,
  isStripeEventForMode,
  isStripeKeyForMode,
} from "../app/stripe.ts";

const originalEnvironment = {
  STRIPE_MODE: process.env.STRIPE_MODE,
  STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY,
  NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
};

const stripeFixture = (family, mode, suffix) => [family, mode, suffix].join("_");

function withStripeEnvironment(values, callback) {
  if (values.STRIPE_MODE === undefined) delete process.env.STRIPE_MODE;
  else process.env.STRIPE_MODE = values.STRIPE_MODE;

  if (values.STRIPE_SECRET_KEY === undefined) delete process.env.STRIPE_SECRET_KEY;
  else process.env.STRIPE_SECRET_KEY = values.STRIPE_SECRET_KEY;

  try {
    callback();
  } finally {
    if (originalEnvironment.STRIPE_MODE === undefined) delete process.env.STRIPE_MODE;
    else process.env.STRIPE_MODE = originalEnvironment.STRIPE_MODE;
    if (originalEnvironment.STRIPE_SECRET_KEY === undefined) delete process.env.STRIPE_SECRET_KEY;
    else process.env.STRIPE_SECRET_KEY = originalEnvironment.STRIPE_SECRET_KEY;
    if (originalEnvironment.NEXT_PUBLIC_SITE_URL === undefined) delete process.env.NEXT_PUBLIC_SITE_URL;
    else process.env.NEXT_PUBLIC_SITE_URL = originalEnvironment.NEXT_PUBLIC_SITE_URL;
  }
}

test("accepts a test key only in test mode", () => {
  withStripeEnvironment({ STRIPE_MODE: "test", STRIPE_SECRET_KEY: stripeFixture("sk", "test", "example") }, () => {
    assert.equal(getStripeMode(), "test");
    assert.equal(getStripeConfigurationError(), null);
    assert.ok(getStripe());
  });
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
