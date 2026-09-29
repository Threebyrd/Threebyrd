import assert from "node:assert/strict";
import test from "node:test";
import { buildCheckoutMetadata, getNextOrderCutoff, getDeliveryDateIso, quoteOrder } from "../app/order-config.ts";

test("browser and server use identical cutoff windows, including optional overrides", () => {
  const oldServer = process.env.THREEBYRD_CUTOFF_OVERRIDE;
  const oldPublic = process.env.NEXT_PUBLIC_THREEBYRD_CUTOFF_OVERRIDE;
  try {
    for (const override of ["", "2026-10-02T15:00:00"]) {
      process.env.THREEBYRD_CUTOFF_OVERRIDE = override;
      process.env.NEXT_PUBLIC_THREEBYRD_CUTOFF_OVERRIDE = override;
      for (const instant of ["2026-10-02T18:59:59Z", "2026-10-03T18:59:59.999Z", "2026-10-03T19:00:00Z", "2026-10-03T19:00:00.001Z", "2026-03-07T20:00:00Z", "2026-10-31T19:00:00Z"]) {
        const now = new Date(instant);
        const server = getNextOrderCutoff(now).toISOString();
        globalThis.window = {};
        try { assert.equal(getNextOrderCutoff(now).toISOString(), server); }
        finally { delete globalThis.window; }
      }
    }
  } finally {
    for (const [key, value] of [["THREEBYRD_CUTOFF_OVERRIDE", oldServer], ["NEXT_PUBLIC_THREEBYRD_CUTOFF_OVERRIDE", oldPublic]]) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
});

test("checkout metadata follows the selected window and historical delivery dates stay unchanged", () => {
  const quote = quoteOrder([{ productId: "big-chicken", quantity: 3 }]);
  for (const [instant, delivery] of [
    ["2026-10-03T18:59:59.999Z", "2026-10-04"],
    ["2026-10-03T19:00:00.000Z", "2026-10-11"],
    ["2026-10-03T19:00:00.001Z", "2026-10-11"],
  ]) {
    const cutoff = getNextOrderCutoff(new Date(instant));
    const metadata = buildCheckoutMetadata({ quote, cutoff, reservationId: "local-mock", deliveryAddress: "123 Test St, Ithaca, NY" });
    assert.equal(metadata.delivery_date, delivery);
    assert.equal(metadata.cutoffAt, cutoff.toISOString());
  }
  assert.equal(getDeliveryDateIso(new Date("2026-09-18T19:00:00Z")), "2026-09-19");
  assert.equal(getDeliveryDateIso(new Date("2026-09-26T19:00:00Z")), "2026-09-27");
});
