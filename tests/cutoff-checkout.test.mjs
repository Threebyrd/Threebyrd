import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { getNextOrderCutoff } from "../app/order-config.ts";

test("checkout keeps accepting carts on both sides of the fulfillment cutoff", () => {
  const previous = process.env.THREEBYRD_CUTOFF_OVERRIDE;
  process.env.THREEBYRD_CUTOFF_OVERRIDE = "2026-10-03T17:00:00";
  try {
    const cutoff = new Date("2026-10-03T21:00:00.000Z");
    const moments = [
      new Date(cutoff.getTime() - 31 * 60_000),
      new Date(cutoff.getTime() - 29 * 60_000),
      new Date(cutoff.getTime() - 60_000),
      new Date(cutoff.getTime() - 1_000),
      cutoff,
      new Date(cutoff.getTime() + 1_000),
      new Date(cutoff.getTime() + 30 * 60_000),
    ];

    assert.deepEqual(
      moments.map((now) => getNextOrderCutoff(now).toISOString()),
      [
        cutoff.toISOString(),
        cutoff.toISOString(),
        cutoff.toISOString(),
        cutoff.toISOString(),
        "2026-10-09T19:00:00.000Z",
        "2026-10-09T19:00:00.000Z",
        "2026-10-09T19:00:00.000Z",
      ],
    );
  } finally {
    if (previous === undefined) delete process.env.THREEBYRD_CUTOFF_OVERRIDE;
    else process.env.THREEBYRD_CUTOFF_OVERRIDE = previous;
  }
});

test("checkout route has no wall-clock cutoff or thirty-minute shutdown guard", async () => {
  const source = await readFile(new URL("../app/api/checkout/route.ts", import.meta.url), "utf8");
  assert.doesNotMatch(source, /secondsUntilCutoff|30 \* 60|order window has closed|closing soon|Checkout must be started/);
  assert.doesNotMatch(source, /Date\.now\(\)\s*>=\s*cutoff\.getTime\(\)/);
  assert.match(source, /const cutoff = getNextOrderCutoff\(new Date\(\)\);/);
});

test("webhook route does not reject paid sessions because the wall clock passed cutoff", async () => {
  const source = await readFile(new URL("../app/api/webhooks/stripe/route.ts", import.meta.url), "utf8");
  assert.doesNotMatch(source, /outside the order window|session\.created\s*>=|session\.expires_at\s*>/);
  assert.match(source, /missing a valid fulfillment window/);
});
