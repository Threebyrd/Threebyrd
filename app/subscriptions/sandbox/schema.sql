PRAGMA foreign_keys = ON;
CREATE TABLE IF NOT EXISTS weekly_customers (
 id TEXT PRIMARY KEY, email TEXT NOT NULL UNIQUE, verified_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS weekly_tokens (
 hash TEXT PRIMARY KEY, email TEXT NOT NULL, expires_at INTEGER NOT NULL, consumed_at INTEGER
);
CREATE TABLE IF NOT EXISTS weekly_sessions (
 hash TEXT PRIMARY KEY, customer_id TEXT NOT NULL REFERENCES weekly_customers(id), csrf TEXT NOT NULL, expires_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS weekly_rate_limits (key TEXT PRIMARY KEY, window_start INTEGER NOT NULL, count INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS weekly_cycles (id TEXT PRIMARY KEY, sequence INTEGER NOT NULL UNIQUE, data TEXT NOT NULL, revision INTEGER NOT NULL DEFAULT 1);
CREATE TABLE IF NOT EXISTS weekly_cycle_revisions (id TEXT PRIMARY KEY, cycle_id TEXT NOT NULL, revision INTEGER NOT NULL, snapshot TEXT NOT NULL, at INTEGER NOT NULL, UNIQUE(cycle_id,revision));
CREATE TABLE IF NOT EXISTS weekly_customer_mappings (
 customer_id TEXT NOT NULL REFERENCES weekly_customers(id), environment TEXT NOT NULL CHECK(environment IN ('mock','stripe_test')), stripe_customer_id TEXT NOT NULL,
 PRIMARY KEY(customer_id,environment), UNIQUE(environment,stripe_customer_id)
);
CREATE TABLE IF NOT EXISTS weekly_plans (
 customer_id TEXT PRIMARY KEY REFERENCES weekly_customers(id), plan_id TEXT NOT NULL UNIQUE, data TEXT NOT NULL, address TEXT NOT NULL, recipient_name TEXT NOT NULL,
 version INTEGER NOT NULL DEFAULT 1, readiness TEXT NOT NULL CHECK(readiness IN ('setup_pending','staged_ready')), latest_setup_id TEXT, payment_method_id TEXT,
 environment TEXT NOT NULL CHECK(environment IN ('mock','stripe_test'))
);
CREATE TABLE IF NOT EXISTS weekly_authorizations (
 id TEXT PRIMARY KEY, customer_id TEXT NOT NULL REFERENCES weekly_customers(id), plan_id TEXT NOT NULL, disclosure_version TEXT NOT NULL, disclosure_text TEXT NOT NULL,
 accepted_at INTEGER NOT NULL, environment TEXT NOT NULL, source TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS weekly_setup_attempts (
 id TEXT PRIMARY KEY, customer_id TEXT NOT NULL, stripe_customer_id TEXT NOT NULL, plan_id TEXT NOT NULL, environment TEXT NOT NULL,
 status TEXT NOT NULL DEFAULT 'pending', created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS weekly_events (id TEXT PRIMARY KEY, processed_at INTEGER NOT NULL, environment TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS weekly_audit (id TEXT PRIMARY KEY, customer_id TEXT NOT NULL, action TEXT NOT NULL, version INTEGER NOT NULL, at INTEGER NOT NULL, snapshot TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS weekly_welcome_redemptions (
 customer_id TEXT PRIMARY KEY REFERENCES weekly_customers(id), order_id TEXT NOT NULL UNIQUE, cycle_id TEXT NOT NULL, redeemed_at TEXT NOT NULL
);
-- Locked cycle snapshots are intentionally separate from mutable plans.
CREATE TABLE IF NOT EXISTS weekly_committed_orders (
 id TEXT PRIMARY KEY, customer_id TEXT NOT NULL, cycle_id TEXT NOT NULL, snapshot TEXT NOT NULL,
 UNIQUE(customer_id,cycle_id)
);
CREATE TRIGGER IF NOT EXISTS weekly_committed_no_update BEFORE UPDATE ON weekly_committed_orders BEGIN SELECT RAISE(ABORT,'Committed orders are immutable'); END;
CREATE TRIGGER IF NOT EXISTS weekly_committed_no_delete BEFORE DELETE ON weekly_committed_orders BEGIN SELECT RAISE(ABORT,'Committed orders require an audit correction'); END;

-- Isolated stage-3 simulation, never production payment authority.
CREATE TABLE IF NOT EXISTS weekly_mock_payments (
 id TEXT PRIMARY KEY REFERENCES weekly_committed_orders(id), customer_id TEXT NOT NULL,
 cycle_id TEXT NOT NULL, status TEXT NOT NULL CHECK(status IN ('paid','failed','requires_action','abandoned')),
 amount_cents INTEGER NOT NULL, created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS weekly_mock_exports (
 order_id TEXT PRIMARY KEY REFERENCES weekly_committed_orders(id), row_json TEXT NOT NULL, created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS weekly_mock_adjustments (
 id TEXT PRIMARY KEY, order_id TEXT NOT NULL REFERENCES weekly_committed_orders(id),
 revision INTEGER NOT NULL, request_json TEXT NOT NULL, snapshot TEXT NOT NULL,
 delta_cents INTEGER NOT NULL, outcome TEXT NOT NULL CHECK(outcome IN ('paid','failed')),
 created_at INTEGER NOT NULL, UNIQUE(order_id,revision)
);
CREATE TRIGGER IF NOT EXISTS weekly_adjustments_no_update BEFORE UPDATE ON weekly_mock_adjustments BEGIN SELECT RAISE(ABORT,'Adjustments are immutable'); END;
CREATE TRIGGER IF NOT EXISTS weekly_adjustments_no_delete BEFORE DELETE ON weekly_mock_adjustments BEGIN SELECT RAISE(ABORT,'Adjustments are immutable'); END;

CREATE TABLE IF NOT EXISTS weekly_test_purchases (
 id TEXT PRIMARY KEY, customer_id TEXT NOT NULL, plan_id TEXT NOT NULL UNIQUE,
 cycle_id TEXT NOT NULL, snapshot TEXT NOT NULL, session_id TEXT UNIQUE,
 status TEXT NOT NULL CHECK(status IN ('pending','paid')), created_at INTEGER NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS weekly_test_pending_customer ON weekly_test_purchases(customer_id) WHERE status='pending';
CREATE TABLE IF NOT EXISTS weekly_test_paid_events (
 event_id TEXT PRIMARY KEY, purchase_id TEXT NOT NULL REFERENCES weekly_test_purchases(id), at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS weekly_test_exports (
 order_id TEXT PRIMARY KEY REFERENCES weekly_committed_orders(id), row_json TEXT NOT NULL, created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS weekly_test_sheet_receipts (
 order_id TEXT PRIMARY KEY REFERENCES weekly_test_exports(order_id), receipt TEXT NOT NULL, exported_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS weekly_email_outbox (
 id TEXT PRIMARY KEY, customer_id TEXT NOT NULL REFERENCES weekly_customers(id),
 recipient TEXT NOT NULL, kind TEXT NOT NULL, details TEXT NOT NULL,
 status TEXT NOT NULL CHECK(status IN ('pending','sending','accepted','blocked_recipient','review_required')),
 receipt TEXT, created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS weekly_test_recurring (
 id TEXT PRIMARY KEY, customer_id TEXT NOT NULL REFERENCES weekly_customers(id),
 cycle_id TEXT NOT NULL, snapshot TEXT NOT NULL,
 status TEXT NOT NULL CHECK(status IN ('prepared','processing','paid','failed','requires_action','review_required')),
 payment_intent_id TEXT UNIQUE, result TEXT, created_at INTEGER NOT NULL,
 UNIQUE(customer_id,cycle_id)
);

CREATE TABLE IF NOT EXISTS weekly_test_adjustments (
 id TEXT PRIMARY KEY, order_id TEXT NOT NULL REFERENCES weekly_committed_orders(id), customer_id TEXT NOT NULL,
 revision INTEGER NOT NULL, snapshot TEXT NOT NULL, delta_cents INTEGER NOT NULL, delta_tax_cents INTEGER NOT NULL,
 status TEXT NOT NULL CHECK(status IN ('quoted','processing','paid','failed','review_required')),
 expires_at INTEGER NOT NULL, result TEXT
);
CREATE UNIQUE INDEX IF NOT EXISTS weekly_test_adjustment_active ON weekly_test_adjustments(order_id) WHERE status IN ('processing','review_required');
CREATE UNIQUE INDEX IF NOT EXISTS weekly_test_adjustment_paid_revision ON weekly_test_adjustments(order_id,revision) WHERE status='paid';

CREATE TABLE IF NOT EXISTS weekly_test_sheet_updates (
 order_id TEXT NOT NULL REFERENCES weekly_committed_orders(id), revision INTEGER NOT NULL,
 row_json TEXT NOT NULL, created_at INTEGER NOT NULL, receipt TEXT,
 PRIMARY KEY(order_id,revision)
);

-- Failed cycles can be explicitly closed only after Stripe confirms cancellation.
-- Preserve the original failure and immutable job for audit and deduplication.
CREATE TABLE IF NOT EXISTS weekly_payment_resolutions (
 job_id TEXT PRIMARY KEY REFERENCES weekly_test_recurring(id),
 customer_id TEXT NOT NULL, action TEXT NOT NULL CHECK(action='skip_unpaid'),
 resolved_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS weekly_runtime_status (
 task TEXT PRIMARY KEY, status TEXT NOT NULL CHECK(status IN ('ok','error')), checked_at INTEGER NOT NULL
);
