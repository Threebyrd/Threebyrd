import assert from "node:assert/strict";
import test from "node:test";
import { requestDeliveryEligibility } from "../app/delivery-client.ts";

const address = { streetAddress: "700 W Buffalo St", city: "Ithaca", state: "NY", zipCode: "14850" };
const eligible = { normalizedAddress: "700 W Buffalo St, Ithaca, NY 14850, USA", driveMinutes: 1 };

test("retries temporary API failures and returns the successful delivery result", async () => {
  let attempts = 0;
  const result = await requestDeliveryEligibility("/api/delivery-eligibility", address, async () => {
    attempts += 1;
    if (attempts === 1) return Response.json({ error: "temporary" }, { status: 503 });
    if (attempts === 2) throw new TypeError("temporary network failure");
    return Response.json(eligible);
  });
  assert.equal(attempts, 3);
  assert.equal(result.ok, true);
  assert.deepEqual(result.body, eligible);
});

test("does not retry an invalid or out-of-zone address", async () => {
  let attempts = 0;
  const result = await requestDeliveryEligibility("/api/delivery-eligibility", address, async () => {
    attempts += 1;
    return Response.json({ error: "outside delivery area" }, { status: 422 });
  });
  assert.equal(attempts, 1);
  assert.equal(result.status, 422);
});

test("stops after three failed API attempts", async () => {
  let attempts = 0;
  const result = await requestDeliveryEligibility("/api/delivery-eligibility", address, async () => {
    attempts += 1;
    return Response.json({ error: "temporary" }, { status: 503 });
  });
  assert.equal(attempts, 3);
  assert.equal(result.status, 503);
});
