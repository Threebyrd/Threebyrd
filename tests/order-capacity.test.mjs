import assert from "node:assert/strict";
import test from "node:test";
import {
  formatOrderCapacityMessage,
  isOrderCapacitySoldOut,
} from "../app/capacity.ts";
import { getOrderCapacityConfig, ORDER_CAPACITY_CONFIG } from "../app/order-capacity-config.ts";
import {
  attachOrderCapacityReservation,
  cleanupExpiredOrderCapacityReservations,
  confirmOrderCapacityReservation,
  getOrderCapacityAvailability,
  recordConfirmedOrder,
  releaseOrderCapacityReservation,
  reserveOrderCapacity,
} from "../app/order-capacity-db.ts";

class FakeD1 {
  rows = [];
  orders = [];
  lock = Promise.resolve();

  prepare(query) {
    return {
      bind: (...values) => ({ query, values, run: () => this.run({ query, values }) }),
    };
  }

  async batch(statements) {
    const previous = this.lock;
    let release;
    this.lock = new Promise((resolve) => { release = resolve; });
    await previous;
    try {
      return statements.map(({ query, values }) => this.execute(query, values));
    } finally {
      release();
    }
  }

  async run(statement) {
    const previous = this.lock;
    let release;
    this.lock = new Promise((resolve) => { release = resolve; });
    await previous;
    try {
      return this.execute(statement.query, statement.values);
    } finally {
      release();
    }
  }

  execute(query, values) {
    if (query.includes("SET status = 'released'") && query.includes("expires_at <=")) {
      const [releasedAt, expiresAt] = values;
      let changes = 0;
      for (const row of this.rows) {
        if (row.status === "reserved" && row.expiresAt <= expiresAt) {
          row.status = "released";
          row.releasedAt = releasedAt;
          changes += 1;
        }
      }
      return { meta: { changes } };
    }

    if (query.includes("INSERT INTO order_capacity_reservations")) {
      const [id, windowKey, reservedAt, expiresAt, countWindowKey, now, limit] = values;
      const count = this.rows.filter((row) => (
        row.windowKey === countWindowKey &&
        (row.status === "confirmed" || (row.status === "reserved" && row.expiresAt > now))
      )).length;
      if (count >= limit) {
        return { meta: { changes: 0 } };
      }
      this.rows.push({ id, windowKey, stripeSessionId: null, status: "reserved", reservedAt, expiresAt });
      return { meta: { changes: 1 } };
    }

    if (query.includes("INSERT INTO orders")) {
      const [sessionId, , , , , , , , amountCents, , , , reservationId] = values;
      const reservationConfirmed = reservationId === null || this.rows.some((row) => (
        row.status === "confirmed" && (row.id === reservationId || row.stripeSessionId === sessionId)
      ));
      const alreadyExists = this.orders.some((order) => order.stripeSessionId === sessionId);
      if (!reservationConfirmed || alreadyExists) {
        return { meta: { changes: 0 } };
      }
      this.orders.push({ stripeSessionId: sessionId, amountCents });
      return { meta: { changes: 1 } };
    }

    if (query.includes("SET stripe_session_id")) {
      const [stripeSessionId, reservationId] = values;
      const row = this.rows.find((candidate) => candidate.id === reservationId && candidate.status === "reserved" && candidate.stripeSessionId === null);
      if (!row) return { meta: { changes: 0 } };
      row.stripeSessionId = stripeSessionId;
      return { meta: { changes: 1 } };
    }

    if (query.includes("SET status = 'released'") && query.includes("stripe_session_id =")) {
      const [releasedAt, reservationValue, reservationId, sessionValue, stripeSessionId] = values;
      let changes = 0;
      for (const row of this.rows) {
        if (
          row.status === "reserved" &&
          ((reservationValue !== null && row.id === reservationId) || (sessionValue !== null && row.stripeSessionId === stripeSessionId))
        ) {
          row.status = "released";
          row.releasedAt = releasedAt;
          changes += 1;
        }
      }
      return { meta: { changes } };
    }

    if (query.includes("SET status = 'confirmed'")) {
      const [confirmedAt, stripeSessionId, reservationValue, reservationId, sessionId] = values;
      let changes = 0;
      for (const row of this.rows) {
        if (
          (row.status === "reserved" || row.status === "confirmed") &&
          (row.stripeSessionId === stripeSessionId || (reservationValue !== null && row.id === reservationId && (row.stripeSessionId === null || row.stripeSessionId === sessionId)))
        ) {
          row.status = "confirmed";
          row.confirmedAt = confirmedAt;
          row.releasedAt = null;
          changes += 1;
        }
      }
      return { meta: { changes } };
    }

    if (query.includes("SELECT") && query.includes("AS confirmed")) {
      const [now, windowKey] = values;
      const current = this.rows.filter((row) => row.windowKey === windowKey && (
        row.status === "confirmed" || (row.status === "reserved" && row.expiresAt > now)
      ));
      return {
        results: [{
          confirmed: current.filter((row) => row.status === "confirmed").length,
          reserved: current.filter((row) => row.status === "reserved").length,
        }],
      };
    }

    if (query.includes("SELECT id FROM orders")) {
      const [stripeSessionId] = values;
      return { results: this.orders.some((order) => order.stripeSessionId === stripeSessionId) ? [{ id: stripeSessionId }] : [] };
    }

    throw new Error(`Unhandled fake D1 query: ${query}`);
  }
}

function reservation(id, now = 1_000) {
  return {
    id,
    windowKey: "test-window",
    reservedAt: now,
    expiresAt: now + 1_800,
  };
}

const testConfig = { windowKey: "test-window", limit: 50, reservationTtlSeconds: 1_800 };

test("configures a reusable 50-order window with a 30-minute reservation", () => {
  assert.equal(ORDER_CAPACITY_CONFIG.limit, 50);
  assert.equal(ORDER_CAPACITY_CONFIG.reservationTtlSeconds, 1_800);
  assert.equal(typeof ORDER_CAPACITY_CONFIG.windowKey, "string");
  assert.equal(getOrderCapacityConfig("2026-09-18").limit, 50);
  assert.equal(getOrderCapacityConfig("2026-09-25").limit, null);
});

test("reserves a normal slot and converts it to one confirmed order", async () => {
  const database = new FakeD1();
  assert.equal(await reserveOrderCapacity(database, testConfig, reservation("r-1")), true);
  assert.equal(await attachOrderCapacityReservation(database, "r-1", "cs_test_1"), true);
  assert.equal(await confirmOrderCapacityReservation(database, { reservationId: "r-1", stripeSessionId: "cs_test_1" }, 1_100), true);
  assert.deepEqual(await getOrderCapacityAvailability(database, testConfig, 1_100), { confirmed: 1, reserved: 0, remaining: 49 });
});

test("expired and abandoned reservations release capacity", async () => {
  const database = new FakeD1();
  const expired = reservation("r-expired", 1_000);
  expired.expiresAt = 1_100;
  assert.equal(await reserveOrderCapacity(database, testConfig, expired), true);
  await cleanupExpiredOrderCapacityReservations(database, 1_101);
  assert.deepEqual(await getOrderCapacityAvailability(database, testConfig, 1_101), { confirmed: 0, reserved: 0, remaining: 50 });

  const abandoned = reservation("r-abandoned", 2_000);
  assert.equal(await reserveOrderCapacity(database, testConfig, abandoned), true);
  await releaseOrderCapacityReservation(database, { reservationId: "r-abandoned" }, 2_001);
  assert.deepEqual(await getOrderCapacityAvailability(database, testConfig, 2_001), { confirmed: 0, reserved: 0, remaining: 50 });
});

test("capacity one permits exactly one of simultaneous checkout attempts", async () => {
  const database = new FakeD1();
  const oneSlot = { ...testConfig, limit: 1 };
  const results = await Promise.all([
    reserveOrderCapacity(database, oneSlot, reservation("r-a")),
    reserveOrderCapacity(database, oneSlot, reservation("r-b")),
  ]);
  assert.deepEqual(results.sort(), [false, true]);
  assert.deepEqual(await getOrderCapacityAvailability(database, oneSlot, 1_000), { confirmed: 0, reserved: 1, remaining: 0 });
});

test("capacity zero rejects reservations and disabled capacity never blocks checkout", async () => {
  const database = new FakeD1();
  assert.equal(await reserveOrderCapacity(database, { ...testConfig, limit: 0 }, reservation("r-zero")), false);
  assert.equal(await reserveOrderCapacity(database, { ...testConfig, limit: null }, reservation("r-disabled")), true);
  const disabled = await getOrderCapacityAvailability(database, { ...testConfig, limit: null });
  assert.equal(disabled.remaining, null);
});

test("replaying confirmation is idempotent and sold-out UI messaging is explicit", async () => {
  const database = new FakeD1();
  await reserveOrderCapacity(database, testConfig, reservation("r-replay"));
  await attachOrderCapacityReservation(database, "r-replay", "cs_test_replay");
  assert.equal(await confirmOrderCapacityReservation(database, { reservationId: "r-replay", stripeSessionId: "cs_test_replay" }), true);
  assert.equal(await confirmOrderCapacityReservation(database, { reservationId: "r-replay", stripeSessionId: "cs_test_replay" }), true);
  assert.deepEqual(await getOrderCapacityAvailability(database, testConfig), { confirmed: 1, reserved: 0, remaining: 49 });

  const soldOut = { enabled: true, limit: 1, confirmed: 1, reserved: 0, remaining: 0, ordersOpen: true };
  assert.equal(isOrderCapacitySoldOut(soldOut), true);
  assert.equal(formatOrderCapacityMessage(soldOut), "Sold out for this week");
  assert.equal(formatOrderCapacityMessage({ ...soldOut, remaining: 27, confirmed: 0 }), "27 orders remaining this week");
});

test("paid webhook reconciliation is atomic and duplicate session delivery creates one order", async () => {
  const database = new FakeD1();
  await reserveOrderCapacity(database, testConfig, reservation("r-order"));
  await attachOrderCapacityReservation(database, "r-order", "cs_test_order");
  const order = {
    stripeSessionId: "cs_test_order",
    stripePaymentIntentId: "pi_test_order",
    customerEmail: "customer@example.com",
    customerName: "Customer",
    customerPhone: "+15555555555",
    deliveryAddress: "{}",
    items: "[{\"productId\":\"big-chicken\",\"quantity\":3}]",
    amountCents: 3_000,
    currency: "usd",
    cutoffAt: "2026-09-18T19:00:00.000Z",
    createdAt: 1_200,
  };
  assert.equal(await recordConfirmedOrder(database, order, { reservationId: "r-order", confirmedAt: 1_201 }), true);
  assert.equal(await recordConfirmedOrder(database, order, { reservationId: "r-order", confirmedAt: 1_202 }), true);
  assert.equal(database.orders.length, 1);
  assert.equal(database.orders[0].amountCents, 3_000);
});
