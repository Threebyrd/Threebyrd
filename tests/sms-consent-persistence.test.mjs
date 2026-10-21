import assert from "node:assert/strict";
import test from "node:test";
import { DatabaseSync } from "node:sqlite";
import { readdirSync, readFileSync } from "node:fs";
import { recordConfirmedOrder, revokeTransactionalSmsReminders } from "../app/order-capacity-db.ts";

function database() {
  const sql = new DatabaseSync(":memory:");
  for (const file of readdirSync(new URL("../drizzle/", import.meta.url)).filter((file) => file.endsWith(".sql")).sort()) {
    sql.exec(readFileSync(new URL(`../drizzle/${file}`, import.meta.url), "utf8"));
  }
  const adapter = {
    prepare(query) {
      return { bind: (...values) => ({ run: async () => {
        const statement = sql.prepare(query);
        if (statement.columns().length) return { results: statement.all(...values) };
        return { meta: { changes: Number(statement.run(...values).changes) } };
      } }) };
    },
    async batch(statements) {
      sql.exec("BEGIN");
      try { const results = []; for (const statement of statements) results.push(await statement.run()); sql.exec("COMMIT"); return results; }
      catch (error) { sql.exec("ROLLBACK"); throw error; }
    },
  };
  return { sql, adapter };
}

function order(id, orderChoice, marketingChoice, version = "separate-sms-v2") {
  return {
    stripeSessionId: id, stripePaymentIntentId: "pi_test_mock", customerEmail: "test@example.com",
    customerName: "Test", recipientName: "Test", customerPhone: "+16075550123", deliveryAddress: "Test address",
    items: "[]", subtotalCents: 3000, discountCents: 0, taxCents: 0, amountCents: 3000,
    stripeCouponId: null, stripePromotionCodeId: null, stripePaymentStatus: "paid", automaticTaxStatus: "complete",
    taxBehavior: "exclusive", productTaxCode: null, currency: "usd", cutoffAt: "2026-10-24T19:00:00Z", createdAt: 1000,
    smsReminderDecision: orderChoice, smsMarketingDecision: marketingChoice, smsReminderDisclosureVersion: version,
    smsReminderDecisionAt: 990, smsReminderSource: "checkout", smsDestinationNormalized: "+16075550123",
  };
}

test("paid test orders independently persist all four consent combinations, idempotently", async () => {
  const { sql, adapter } = database();
  try {
    for (const orders of ["yes", "no"]) for (const marketing of ["yes", "no"]) {
      const id = `cs_test_${orders}_${marketing}`;
      const payload = order(id, orders, marketing);
      assert.equal(await recordConfirmedOrder(adapter, payload), true);
      assert.equal(await recordConfirmedOrder(adapter, payload), true);
      const consents = sql.prepare("SELECT * FROM notification_consents WHERE stripe_session_id = ? ORDER BY purpose").all(id);
      assert.equal(consents.length, 2);
      assert.equal(consents.find((row) => row.purpose === "order_updates").decision, orders);
      assert.equal(consents.find((row) => row.purpose === "promotional").decision, marketing);
      assert.ok(consents.every((row) => row.decided_at === 990 && row.source === "checkout" && row.destination_normalized === "+16075550123" && row.disclosure_version === "separate-sms-v2"));
      assert.equal(sql.prepare("SELECT count(*) AS n FROM notification_outbox WHERE stripe_session_id = ?").get(id).n, orders === "yes" ? 1 : 0);
    }
  } finally { sql.close(); }
});

test("legacy bundled consent is not promoted into a new marketing opt-in", async () => {
  const { sql, adapter } = database();
  try {
    await recordConfirmedOrder(adapter, order("cs_test_legacy", "yes", "yes", "order-and-promotions-v1"));
    assert.equal(sql.prepare("SELECT decision FROM notification_consents WHERE purpose = 'promotional'").get().decision, "no");
    assert.equal(sql.prepare("SELECT decision FROM notification_consents WHERE purpose = 'order_and_promotional'").get().decision, "yes");
  } finally { sql.close(); }
});

test("revocation cancels queued SMS, revokes both purposes, and suppresses future jobs", async () => {
  const { sql, adapter } = database();
  try {
    await recordConfirmedOrder(adapter, order("cs_test_before_stop", "yes", "yes"));
    await revokeTransactionalSmsReminders(adapter, "+16075550123", 1200);
    assert.ok(sql.prepare("SELECT revoked_at FROM notification_consents").all().every((row) => row.revoked_at === 1200));
    assert.equal(sql.prepare("SELECT status FROM notification_outbox").get().status, "canceled");
    await recordConfirmedOrder(adapter, order("cs_test_after_stop", "yes", "yes"));
    assert.equal(sql.prepare("SELECT count(*) AS n FROM notification_outbox WHERE status = 'pending'").get().n, 0);
  } finally { sql.close(); }
});
