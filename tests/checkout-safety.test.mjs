import assert from "node:assert/strict";
import test from "node:test";
import { getCheckoutClientKey } from "../app/checkout-client.ts";
import { getValidatedDeliveryAddressFromMetadata } from "../app/checkout-reconciliation.ts";
import { expireCreatedCheckoutSession } from "../app/checkout-recovery.ts";

test("checkout client keys are stable hashes and never contain the raw edge IP", async () => {
  const request = new Request("https://api.threebyrd.test/api/checkout", {
    headers: { "CF-Connecting-IP": "203.0.113.10" },
  });
  const key = await getCheckoutClientKey(request);
  assert.match(key ?? "", /^ip:[0-9a-f]{64}$/);
  assert.doesNotMatch(key ?? "", /203\.0\.113\.10/);
  assert.equal(await getCheckoutClientKey(request), key);
  assert.equal(await getCheckoutClientKey(new Request("https://api.threebyrd.test/api/checkout")), null);
});

test("paid fulfillment uses the pre-validated server address, not a mutable hosted address", () => {
  const metadataAddress = "700 W Buffalo St, Ithaca, NY 14850, USA";
  assert.equal(
    getValidatedDeliveryAddressFromMetadata({ delivery_address: metadataAddress }),
    metadataAddress,
  );
  assert.equal(
    getValidatedDeliveryAddressFromMetadata({ delivery_address: "" }),
    null,
  );
  assert.equal(
    getValidatedDeliveryAddressFromMetadata({ delivery_address: "700\nW Buffalo St" }),
    null,
  );
});

test("a session created before a reservation-link failure is expired without releasing its reservation immediately", async () => {
  const expired = [];
  const stripe = {
    checkout: {
      sessions: {
        expire: async (sessionId) => {
          expired.push(sessionId);
          return { id: sessionId, status: "expired" };
        },
      },
    },
  };
  assert.equal(await expireCreatedCheckoutSession(stripe, "cs_test_race"), true);
  assert.deepEqual(expired, ["cs_test_race"]);
});

test("session expiry failure is contained and never exposes provider details", async () => {
  const stripe = { checkout: { sessions: { expire: async () => { throw new Error("provider failure"); } } } };
  assert.equal(await expireCreatedCheckoutSession(stripe, "cs_test_race"), false);
});
