import assert from "node:assert/strict";
import test from "node:test";
import {
  getStripe,
  getStripeConfigurationError,
  getStripeMode,
  isStripeEventForMode,
  isStripeKeyForMode,
} from "../app/stripe.ts";

const originalEnvironment = {
  STRIPE_MODE: process.env.STRIPE_MODE,
  STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY,
};

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
  }
}

test("accepts a test key only in test mode", () => {
  withStripeEnvironment({ STRIPE_MODE: "test", STRIPE_SECRET_KEY: "sk_test_example" }, () => {
    assert.equal(getStripeMode(), "test");
    assert.equal(getStripeConfigurationError(), null);
    assert.ok(getStripe());
  });
});

test("rejects a live key in test mode without exposing it", () => {
  withStripeEnvironment({ STRIPE_MODE: "test", STRIPE_SECRET_KEY: "sk_live_secret-value" }, () => {
    const error = getStripeConfigurationError();
    assert.equal(getStripe(), null);
    assert.match(error, /does not match configured Stripe mode/);
    assert.doesNotMatch(error, /sk_live_secret-value/);
  });
});

test("accepts a live key only in live mode", () => {
  withStripeEnvironment({ STRIPE_MODE: "live", STRIPE_SECRET_KEY: "rk_live_example" }, () => {
    assert.equal(getStripeMode(), "live");
    assert.equal(getStripeConfigurationError(), null);
    assert.ok(getStripe());
  });
});

test("rejects a test key in live mode without exposing it", () => {
  withStripeEnvironment({ STRIPE_MODE: "live", STRIPE_SECRET_KEY: "rk_test_secret-value" }, () => {
    const error = getStripeConfigurationError();
    assert.equal(getStripe(), null);
    assert.match(error, /does not match configured Stripe mode/);
    assert.doesNotMatch(error, /rk_test_secret-value/);
  });
});

test("rejects an unset or invalid Stripe mode safely", () => {
  withStripeEnvironment({ STRIPE_SECRET_KEY: "sk_test_example" }, () => {
    assert.equal(getStripeMode(), null);
    assert.equal(getStripe(), null);
    assert.match(getStripeConfigurationError(), /STRIPE_MODE/);
  });

  withStripeEnvironment({ STRIPE_MODE: "sandbox", STRIPE_SECRET_KEY: "sk_test_example" }, () => {
    assert.equal(getStripeMode(), null);
    assert.equal(getStripe(), null);
    assert.match(getStripeConfigurationError(), /STRIPE_MODE/);
  });
});

test("validates both supported Stripe key families without logging or returning key material", () => {
  assert.equal(isStripeKeyForMode("sk_test_example", "test"), true);
  assert.equal(isStripeKeyForMode("rk_test_example", "test"), true);
  assert.equal(isStripeKeyForMode("sk_live_example", "live"), true);
  assert.equal(isStripeKeyForMode("rk_live_example", "live"), true);
  assert.equal(isStripeKeyForMode("sk_live_example", "test"), false);
  assert.equal(isStripeKeyForMode("sk_test_example", "live"), false);
});

test("accepts only matching webhook livemode values", () => {
  assert.equal(isStripeEventForMode(false, "test"), true);
  assert.equal(isStripeEventForMode(true, "test"), false);
  assert.equal(isStripeEventForMode(true, "live"), true);
  assert.equal(isStripeEventForMode(false, "live"), false);
});
