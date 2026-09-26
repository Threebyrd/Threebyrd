import assert from "node:assert/strict";
import test from "node:test";
import { processPendingOrderSheetExports } from "../app/order-capacity-db.ts";

const order = {
  id: "order-123",
  stripe_session_id: "cs_test_123",
  status: "confirmed",
  customer_email: "john@example.com",
  customer_name: "John Smith",
  customer_phone: "6075550100",
  delivery_address: JSON.stringify({ normalizedAddress: "123 College Ave, Ithaca, NY 14850, USA" }),
  items: JSON.stringify([
    { productId: "big-chicken", quantity: 3 },
    { productId: "big-beef", quantity: 2 },
  ]),
  amount_cents: 4_700,
  currency: "usd",
  cutoff_at: "2026-09-26T19:00:00.000Z",
  created_at: Math.floor(Date.parse("2026-09-25T14:30:00.000Z") / 1000),
};

class FakeOutboxD1 {
  exportRow = {
    order_id: "order-123",
    stripe_session_id: "cs_test_123",
    status: "pending",
    attempts: 0,
    next_attempt_at: 1_000,
    lease_until: null,
    claim_token: null,
    last_error: null,
    created_at: 1_000,
  };

  prepare(query) {
    return {
      bind: (...values) => ({ query, values, run: () => this.run(query, values) }),
    };
  }

  async run(query, values) {
    if (query.includes("FROM order_sheet_exports e")) {
      const [now] = values;
      const available = (
        this.exportRow.status === "pending" && this.exportRow.next_attempt_at <= now
      ) || (
        this.exportRow.status === "processing" && this.exportRow.lease_until <= now
      );
      return { results: available ? [{ ...order, attempts: this.exportRow.attempts }] : [] };
    }

    if (query.includes("SET status = 'processing'")) {
      const [leaseUntil, claimToken] = values;
      const now = values[3];
      const shouldClaim = (
        this.exportRow.status === "pending" && this.exportRow.next_attempt_at <= now
      ) || (
        this.exportRow.status === "processing" && this.exportRow.lease_until <= now
      );
      if (!shouldClaim) return { meta: { changes: 0 } };
      this.exportRow.status = "processing";
      this.exportRow.attempts += 1;
      this.exportRow.lease_until = leaseUntil;
      this.exportRow.claim_token = claimToken;
      this.exportRow.last_error = null;
      return { meta: { changes: 1 } };
    }

    if (query.includes("SET status = 'synced'")) {
      const [syncedAt, orderId, claimToken] = values;
      if (this.exportRow.status !== "processing" || orderId !== this.exportRow.order_id || claimToken !== this.exportRow.claim_token) {
        return { meta: { changes: 0 } };
      }
      this.exportRow.status = "synced";
      this.exportRow.synced_at = syncedAt;
      this.exportRow.lease_until = null;
      this.exportRow.claim_token = null;
      return { meta: { changes: 1 } };
    }

    if (query.includes("SET status = 'pending'")) {
      const [nextAttemptAt, lastError, orderId, claimToken] = values;
      if (this.exportRow.status !== "processing" || orderId !== this.exportRow.order_id || claimToken !== this.exportRow.claim_token) {
        return { meta: { changes: 0 } };
      }
      this.exportRow.status = "pending";
      this.exportRow.next_attempt_at = nextAttemptAt;
      this.exportRow.lease_until = null;
      this.exportRow.claim_token = null;
      this.exportRow.last_error = lastError;
      return { meta: { changes: 1 } };
    }

    throw new Error(`Unhandled fake outbox query: ${query}`);
  }
}

test("successful Sheets delivery marks one claimed export synced", async () => {
  const database = new FakeOutboxD1();
  let sentPayload;
  const previousMode = process.env.STRIPE_MODE;
  process.env.STRIPE_MODE = "test";
  try {
    await processPendingOrderSheetExports(database, 1_000, 10, async (payload) => {
      sentPayload = payload;
      return { ok: true, duplicate: false };
    });
  } finally {
    if (previousMode === undefined) delete process.env.STRIPE_MODE;
    else process.env.STRIPE_MODE = previousMode;
  }

  assert.equal(database.exportRow.status, "synced");
  assert.equal(sentPayload.totalMeals, 5);
  assert.equal(sentPayload.totalPaid, 47);
});

test("failed Sheets delivery stays pending with safe retry metadata", async () => {
  const database = new FakeOutboxD1();
  const previousMode = process.env.STRIPE_MODE;
  process.env.STRIPE_MODE = "test";
  try {
    await processPendingOrderSheetExports(database, 1_000, 10, async () => ({ ok: false, reason: "http_503" }));
  } finally {
    if (previousMode === undefined) delete process.env.STRIPE_MODE;
    else process.env.STRIPE_MODE = previousMode;
  }

  assert.equal(database.exportRow.status, "pending");
  assert.equal(database.exportRow.attempts, 1);
  assert.equal(database.exportRow.next_attempt_at, 1_300);
  assert.equal(database.exportRow.last_error, "http_503");
});

test("a generic ok response cannot mark an export synced", async () => {
  const database = new FakeOutboxD1();
  const previousMode = process.env.STRIPE_MODE;
  process.env.STRIPE_MODE = "test";
  try {
    await processPendingOrderSheetExports(database, 1_000, 10, async () => ({ ok: true }));
  } finally {
    if (previousMode === undefined) delete process.env.STRIPE_MODE;
    else process.env.STRIPE_MODE = previousMode;
  }

  assert.equal(database.exportRow.status, "pending");
  assert.equal(database.exportRow.last_error, "endpoint_rejected");
  assert.equal(database.exportRow.attempts, 1);
});

test("a stale worker cannot mark a reclaimed export synced", async () => {
  const database = new FakeOutboxD1();
  const previousMode = process.env.STRIPE_MODE;
  process.env.STRIPE_MODE = "test";
  try {
    await processPendingOrderSheetExports(database, 1_000, 10, async () => {
      database.exportRow.claim_token = "newer-worker-token";
      return { ok: true, duplicate: false };
    });
  } finally {
    if (previousMode === undefined) delete process.env.STRIPE_MODE;
    else process.env.STRIPE_MODE = previousMode;
  }

  assert.equal(database.exportRow.status, "processing");
  assert.equal(database.exportRow.synced_at, undefined);
});
