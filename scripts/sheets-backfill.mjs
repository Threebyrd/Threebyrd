import { spawnSync } from "node:child_process";

const baselineCreatedAt = 1_792_874_100; // 2026-10-24 4:35 PM America/New_York
const baselineSession = "cs_live_b1Qx89y2OWpwYsyZd0b3JnKfgTummQ8SNEDXtmdZoBxOUh20TruOfAYbsX";
const database = "threebyrd-orders";
const apply = process.argv.includes("--requeue");
const unknownArgs = process.argv.slice(2).filter((arg) => arg !== "--requeue" && arg !== "--dry-run");
if (unknownArgs.length) {
  console.error(`Unknown argument(s): ${unknownArgs.join(", ")}`);
  process.exit(2);
}

const sql = `
SELECT
  o.id AS order_id,
  date(o.cutoff_at, '+1 day') AS delivery_date,
  (SELECT COALESCE(SUM(CAST(json_extract(item.value, '$.quantity') AS INTEGER)), 0)
   FROM json_each(o.items) AS item) AS total_meals,
  o.amount_cents,
  COALESCE(e.status, 'missing') AS export_status,
  COALESCE(e.attempts, 0) AS attempts
FROM orders o
LEFT JOIN order_sheet_exports e ON e.order_id = o.id
WHERE o.created_at > ${baselineCreatedAt}
  AND o.stripe_session_id <> '${baselineSession}'
  AND o.stripe_session_id LIKE 'cs_live_%'
  AND o.status = 'confirmed'
  AND o.stripe_payment_status = 'paid'
  AND COALESCE(e.status, 'missing') <> 'synced'
ORDER BY o.created_at ASC;
`;

const result = spawnSync("npx", ["wrangler", "d1", "execute", database, "--remote", "--json", "--command", sql], {
  encoding: "utf8",
  maxBuffer: 10 * 1024 * 1024,
});
if (result.status !== 0) {
  process.stderr.write(result.stderr || result.stdout);
  process.exit(result.status ?? 1);
}

let parsed;
try {
  parsed = JSON.parse(result.stdout.slice(result.stdout.indexOf("[")));
} catch {
  console.error("Could not parse the Wrangler D1 query result; no changes were made.");
  process.exit(1);
}
const rows = parsed.flatMap((entry) => entry.results ?? []);
console.log(`${apply ? "Backfill candidates" : "Dry run — no changes made"}: ${rows.length}`);
for (const row of rows) {
  console.log(`${row.order_id} | delivery ${row.delivery_date ?? "unknown"} | ${row.total_meals} meals | $${(row.amount_cents / 100).toFixed(2)} | ${row.export_status} | attempts ${row.attempts}`);
}

if (!apply) {
  console.log("To make eligible records due for the normal Worker retry path, rerun with --requeue after the sync fix is deployed.");
  process.exit(0);
}

const missing = rows.filter((row) => row.export_status === "missing");
if (missing.length) {
  const orderIds = missing.map((row) => `'${row.order_id.replaceAll("'", "''")}'`).join(",");
  const now = Math.floor(Date.now() / 1000);
  const enqueueSql = `INSERT INTO order_sheet_exports (order_id, stripe_session_id, status, attempts, next_attempt_at, created_at) SELECT o.id, o.stripe_session_id, 'pending', 0, ${now}, ${now} FROM orders o WHERE o.id IN (${orderIds}) ON CONFLICT(order_id) DO NOTHING;`;
  const enqueue = spawnSync("npx", ["wrangler", "d1", "execute", database, "--remote", "--yes", "--command", enqueueSql], { encoding: "utf8", maxBuffer: 2 * 1024 * 1024 });
  if (enqueue.status !== 0) {
    process.stderr.write(enqueue.stderr || enqueue.stdout);
    process.exit(enqueue.status ?? 1);
  }
}

const now = Math.floor(Date.now() / 1000);
const requeueSql = `UPDATE order_sheet_exports SET status = 'pending', next_attempt_at = ${now}, lease_until = NULL, claim_token = NULL WHERE order_id IN (${rows.map((row) => `'${row.order_id.replaceAll("'", "''")}'`).join(",") || "''"}) AND status IN ('pending', 'processing');`;
const requeue = spawnSync("npx", ["wrangler", "d1", "execute", database, "--remote", "--yes", "--command", requeueSql], { encoding: "utf8", maxBuffer: 2 * 1024 * 1024 });
if (requeue.status !== 0) {
  process.stderr.write(requeue.stderr || requeue.stdout);
  process.exit(requeue.status ?? 1);
}
console.log("Requeued eligible exports for the existing scheduled Worker sync; no Sheet rows were written directly.");
