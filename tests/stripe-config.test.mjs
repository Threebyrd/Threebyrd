import assert from "node:assert/strict";
import test from "node:test";
import { safeErrorMessage } from "../app/stripe.ts";

test("redacts Stripe and Google credentials from provider error messages", () => {
  const stripeKey = ["sk", "test"].join("_") + "_abcdefghijklmnopqrstuvwxyz123456";
  const webhookSecret = "whsec" + "_abcdefghijklmnopqrstuvwxyz123456";
  const mapsKey = "AIza" + "AbCdEf0123456789";
  const message = safeErrorMessage(new Error(
    `Expired API Key provided: ${stripeKey} and ${webhookSecret} with${mapsKey}`,
  ));

  assert.doesNotMatch(message, /sk_test_|whsec_|AIza/);
  assert.match(message, /\[redacted-secret\]/);
});
