# Stage 3 progress — local cutoff and operations simulation

October 21, 2026. Current homepage and checkout design preserved. Production remains unchanged.

## Implemented

`app/subscriptions/sandbox/cutoff.mjs` provides an explicit mock-only cutoff runner. It uses the published cycle's absolute cutoff (including its DST offset), stored plan and availability, verified payment-method readiness, and trusted meal quote. It commits an immutable address/cart/price snapshot with a stable plan/cycle identity, tracks simulated paid/failed/requires-action states separately, and places only successfully paid orders in a uniquely keyed local fulfillment outbox. The welcome ledger is redeemed only on payment success. Recovering a payment is idempotent. Unresolved previous payments block overlapping new orders; explicit abandonment allows a later eligible delivery to receive the gift. Recovery after the delivery date is rejected.

Skips, pauses, cancellations and holiday closures produce no charge or preparation row. If a job is delayed until after a plan mutation, it requires support review rather than treating current choices as historical cutoff authority. There is no autonomous scheduler and no external payment call. A local SQLite transaction makes mock charging, entitlement and outbox writes atomic; this is not an implementation of distributed Stripe/D1 transactions.

Private `/api/dev-operations` uses the existing developer bearer key and reports subscriber statuses, simulated payment issues and paid preparation rows. The private inbox screen displays summary counts and subscriber statuses. Customer sessions cannot access this endpoint.

Run the independent fictional exercise:

```
node scripts/weekly-sandbox/simulate-week.mjs
```

It uses an in-memory database, not the active customer sandbox database. It creates four fictional plans (paid, failed, skipped, paused), runs cutoff, recovers the failed payment, reruns cutoff, and writes ignored local review files:

- `.local-previews/weekly-stage3/operations.json`
- `.local-previews/weekly-stage3/orders.csv`

The CSV demonstrates proposed order type, plan ID, gift flag, delivery date, paid/free kitchen quantities and totals. It is not connected to Google Sheets and does not change the existing export contract. Mock tax defaults to zero and is explicitly labeled; it is not a tax determination.

## Validation

47 subscription/domain/service tests passed, including cutoff boundary, exact totals/sauce charges, immutable snapshots, duplicate jobs, successful recovery, requires-action, unpaid exclusion, skipped/paused/canceled/closed cycles, subsequent discounted weeks without another gift, unresolved recovery overlap, abandonment, late changes and private operator visibility. Existing customer management and one-time mock checkout tests remain passing. Targeted lint passed.

## Remaining before public pilot

- Port synchronous local storage to the existing async Worker/D1 runtime with atomic conditional transitions, reviewed migrations and durable outbox delivery. No production migration has run.
- Configure a separate Stripe test account/key and signed payment webhook, implement real off-session PaymentIntent/recovery reconciliation and test it end to end. Existing setup adapter alone is insufficient. Do not bill sandbox authorization records.
- Confirm final tax treatment, payment-recovery deadline, late payment/refund policy, approved holiday calendar, inventory source and price-change notice policy.
- Select/configure transactional email; implement reminders, receipts, change confirmations and secure management links with controlled test recipients. SMS stays mocked/off.
- Map the paid-order outbox into the actual order schema and idempotent Google Sheets export; add subscriber visibility in a separate tab. Review spreadsheet permissions and columns first.
- Add an approved operator interface, monitored scheduler, billing kill switch, rollout/rollback procedures and fresh final customer authorization.

Do not interpret this simulation as real Stripe test-mode verification, a functioning production scheduler, a Google Sheets integration, or launch readiness.

## Upfront first delivery and any-size welcome box

The mock signup success path now immediately purchases the first eligible open delivery and saves the test payment method; later cutoff runs reuse that order and cannot charge it again. The management page separates purchased deliveries from future estimates. The welcome box can be any purchasable size; the first selected box is provisional in the main builder, with a dedicated editable gift choice at signup. Three other paid meals remain required. Paid sauces keep normal charges; only gift sauce is included. Authorization version is weekly-stage3-v3. No real payments occur.

48 subscription tests, targeted lint and TypeScript passed. Immediate purchase, any-size gift and cutoff deduplication have explicit regression coverage. Paid-order changes currently require support; self-service additional-payment/refund adjustments are not implemented. The old setup-only Stripe test adapter does not implement real upfront payment and must not be presented as finished payment integration.

## Paid-delivery adjustments (local mock)

Purchased deliveries now have a Change this paid delivery button before their cutoff. The editor quotes the exact additional payment or refund, requires explicit acceptance of that delta, and provides simulated success/failure. Changes apply only to that purchased delivery; future defaults and the already-earned gift remain unchanged. The original purchase snapshot stays immutable; append-only, versioned adjustments determine the effective order and replace its one local preparation row. Failed adjustments do not change paid meals/totals. Ownership, CSRF, cutoff, inventory, minimum quantities, stale revisions and idempotency keys are checked server-side. These are atomic mock adjustments, not actual Stripe charges/refunds.

50 subscription tests passed; TypeScript and targeted lint passed. Browser verified a first order of three Big Chicken BBQ plus a free Big Beef ($31.50 before mock tax) changed to four paid Chicken ($42), with a $10.50 simulated additional payment. Future defaults stayed at three meals. Existing staging Worker secret names include Stripe test and Sheets settings; no values were retrieved. Staging database belongs to the existing Thorbwag account. Sheet browser access redirected to Cornell login, so authenticated sheet review is pending user sign-in. No staging deployment, remote migration, real sheet write, real payment or email was performed.

## Authenticated staging sheet inspection

Confirmed in the user's signed-in Chrome session: workbook `Fall 2026 ThreeByrd Weekly Orders - STAGING`, spreadsheet ID `1yIAcqcs5jdivSJb1AfAxNiu8b4_MuFzLD0B8SpUY4oE`; Orders tab ID `1338815972`. Inspected its exported workbook read-only. Orders has the same 23-column layout as `GOOGLE_SHEETS_HEADERS`, including physical product quantities, meal subtotal, discount, tax, total paid, delivery date, Stripe Session ID, payment status, notes and legacy SMS field. Existing rows and kitchen formulas were not modified.

Added a tested read-only local weekly-to-existing-column preview mapper. Physical counts include the gift, money reconciles to the trusted discounted quote, and weekly plan/free-box/revision information is mapped to Notes. Mock records carry prominent mock labels and no fabricated Stripe session. Two mapping tests pass. This does not send to Sheets: existing production export requires a real Checkout Session ID and cannot safely be reused unchanged for future PaymentIntent-only weekly payments or versioned paid-order adjustments. Remote endpoint and receiver upgrades remain required before any staging writes. Subscriber-tab creation remains pending integration; no remote spreadsheet was edited.

## Stripe first-payment adapter (not yet activated)

Added `sandbox/stripe-purchase.ts` and `.mjs` as a dedicated test-only Checkout payment adapter, separate from the previous setup-only adapter. It builds a first-order payment session with the exact 5% meal discount allocated in cents, full paid sauce prices, a zero-price any-size welcome box, automatic tax, the verified test customer's delivery address and off-session future usage. It uses a stable purchase idempotency key. Reconciliation verifies signed test events, retrieves the current Session/PaymentIntent/method, checks saved purchase ownership, exact discounted subtotal/tax/total/currency, successful payment and tax, off-session usage and method attachment. Browser return URLs are not payment evidence.

55 subscription-related tests passed; TypeScript and targeted lint passed. New tests use signed fixtures and a mocked SDK, not an actual Stripe account. Official reference checked: https://docs.stripe.com/api/checkout/sessions/object and https://docs.stripe.com/payments/save-during-payment .

IMPORTANT: This adapter is not yet wired into the local enrollment routes or any staging Worker deployment. The local server continues to simulate purchases, and its existing Stripe-test setup path still only saves cards. Do not claim end-to-end test payment or spreadsheet sync from these fixtures. Dedicated WEEKLY_STRIPE_TEST_KEY / webhook secret are not set in the current local environment; existing staging Worker secrets cannot be retrieved as plaintext through Wrangler. Stripe dashboard setup/access is pending. Further work must persist a server-owned pending purchase before creating Checkout, bind its Session ID, reconcile it durably/idempotently into a paid order/outbox, and deliver through the staging-only sheet receiver after verifying its configured destination. Preserve no-live-key checks, gift uniqueness, tax correctness and customer cutoff authorization. No real Stripe API request, external sheet write, remote migration, deployment or email occurred.

## First-payment route wiring update

Supersedes the adapter-only note above: `/api/purchase` now persists an immutable server-owned pending purchase and binds a stable, idempotent Stripe Checkout Session. `/api/purchase-webhook` verifies via the test adapter before atomically creating a committed order, redeeming the gift, saving the payment method and adding one `weekly_test_exports` row. Duplicate events/orders cannot enqueue again. Stripe-test signup calls this purchase route; mock signup remains unchanged. Configure WEEKLY_STRIPE_TEST_KEY, WEEKLY_STRIPE_TEST_WEBHOOK_SECRET and WEEKLY_STRIPE_TEST_TAX_CODE explicitly. Existing `/api/setup-webhook` remains for card-setup updates, not initial purchase authority. Each configured webhook must use its correct signing secret; the local adapter currently uses the dedicated weekly test secret for these endpoints.

56 subscription tests passed, TypeScript and targeted lint passed. Real API calls remain unverified without dedicated local test credentials. Test Checkout expires no later than cutoff or 23 hours from creation. New Checkout within 31 minutes of cutoff is currently rejected to respect Stripe expiration constraints; pending/expired checkout recovery still requires support and must be completed before pilot. No public Worker integration, recurring real PaymentIntent runner, remote Sheets sender or email provider has been activated. `weekly_test_exports` is a durable local queue, not proof of spreadsheet delivery. Remaining steps: obtain authorized Stripe sandbox access, exercise signed real test events/webhook forwarding, verify configured staging sheet destination, implement test-sheet upserts and validate receipt in the actual sheet. No production deployment, payment, sheet modification or email occurred.

## Real Stripe sandbox → staging sheet verification (October 21, 2026)

Supersedes credential/access blockers above. User signed into the existing ThreeByrd Stripe sandbox in Chrome. Its existing test credential was stored only in ignored `.local-previews/weekly-stage3/stripe-test-key` with mode 0600 (no live key). The official Stripe CLI v1.54.1 was downloaded from stripe/stripe-cli's GitHub release into `/tmp` and forwards only checkout.session.completed to isolated localhost:3013. A separate `stripe-test.sqlite` database protects the reviewed mock sandbox at 3012.

A fictional weekly customer paid through actual Stripe-hosted test Checkout using Stripe's 4242 test card: three Big Chicken BBQ paid meals, one free Big Beef BBQ, $33 original paid subtotal minus $1.50 meal discount = $31.50; Stripe automatic tax returned $2.52, total $34.02. The actual signed event was delivered by Stripe CLI and accepted with HTTP 200. Verified saved method attached to test customer, one committed order, one gift redemption and one paid export queue row. No live funds or customer messages.

Staging spreadsheet bound Apps Script source matched the repository, but its active Version 2 rejected the current headers. Refreshed ONLY that existing staging project's deployment to Version 3, retaining execution identity, existing access setting, URL, secret and test-only workbook binding. Read-only diagnostic then confirmed the exact STAGING workbook, Orders tab, valid headers and lastRow 22. No production script, workbook, Worker or database was changed.

Added `test-sheet-sync.mjs`: exports only signed-event-backed, reconciled Stripe-test orders through the existing confirmed staging endpoint, records durable export receipts, and uses actual cs_test_ session IDs. Physical counts include the gift; Notes explicitly label STRIPE SANDBOX TEST — no delivery. First send inserted Orders row 23; second run returned no work. Browser copied row A23:W23 and verified fictional recipient, FREE WELCOME BOX, $34.02, and test label. Screenshot `/tmp/threebyrd-staging-paid-order.png` records the result. The sheet now contains ONE new fictional test order, deliberately retained for review.

This proves first purchase, real signed completion, saved card and initial staging export. It does NOT prove subsequent recurring payments, real paid-order adjustments/refunds, automated spreadsheet retries, subscriber-tab sync, customer email delivery, or production deployment. Those remain next-stage work. CLI listener and isolated test server run only while this machine is awake. Existing mock preview remains unchanged at 3012.

## Real off-session / additional-payment / refund / decline exercise

Added operator-only `scripts/weekly-sandbox/exercise-stripe.mjs`. It loads only the dedicated ignored test credential and fictional Stripe-test database, validates test customer/method ownership, uses stable idempotency keys and persists each completed result for restart/retry safety. This is an explicit payment exercise, NOT an autonomous cutoff scheduler and NOT authority to bill real enrollments.

Verified actual Stripe sandbox results:
- Saved-card off-session PaymentIntent succeeded: $31.50 meal/sauce subtotal, Stripe Tax calculation $2.52, total $34.02. Recorded the test tax transaction.
- Additional saved-card payment succeeded: $10.50 subtotal + $0.84 tax = $11.34.
- Full refund of that additional $11.34 succeeded; its tax transaction was fully reversed.
- Separate fictional customer with Stripe's attachable failure test method produced `card_declined`; no order/export was produced for that failure.

The first attempted decline method refused attachment, so it did not reach payment. The corrected attachable test method used a fresh idempotency key. Successful earlier exercise operations were reused rather than charged again. Report: ignored `.local-previews/weekly-stage3/stripe-exercise-results.json`. No production money, real customer or email was involved. No new spreadsheet row was sent by this exercise: recurring PaymentIntent-only exports and in-place revised paid-order sheet updates still need receiver integration. Do not fabricate a Checkout Session ID for those payments.

Added eight local email previews (receipt, cutoff reminder, payment failure, order change, skip, pause, cancel, holiday), restricted to luc@threebyrd.com and explicitly preview-only. They do not send email or contain reusable login tokens. Output: ignored `email-previews.json`. A verified sender domain/provider, durable email event triggers and delivery transport are still required. Current website still does not send these emails.

59 subscription tests pass, targeted lint passes. First Checkout discount allocation now distributes cents across meal units so identical meals display the same discounted amount while sauces remain full price. Real payment exercises demonstrate provider behavior; a complete production lifecycle still requires scheduler locks/recovery, signed recurring-event reconciliation, real paid-order adjustment state, tax-aware partial corrections and corresponding Sheet upserts, customer authentication recovery and tested email delivery. Existing one-time checkout and production deployment remain untouched.

## Outbound email setup — authorization boundary

Confirmed Cloudflare zone/account for threebyrd.com. Incoming Email Routing is enabled and luc@threebyrd.com forwards to the user's verified Gmail destination. Existing CLI login can read routing but outbound sending-subdomain access was unauthorized; the authorized one-message setup-send attempt returned 403 `email.sending.error.email.sending_disabled`. No email was accepted/sent.

Signed into the existing Cloudflare dashboard using its saved Google account and inspected Email Sending. The account is on Workers Free; Email Sending requires Workers Paid. Prepared the actual upgrade checkout (no activation, no terms checkbox, no payment): $5/month base fee charged today, plus usage overages charged monthly until cancellation. Existing payment method is present. This is a new recurring financial commitment and requires the user's action/approval; prior authorization to implement emails did not specify a spending limit. The browser is left on the review checkout for user handoff; screenshot `/tmp/threebyrd-cloudflare-email-plan.png`. No plan, DNS record or access permission was changed.

Implemented and unit-tested Cloudflare test-only email transport with fixed From `ThreeByrd Meal Prep <orders@threebyrd.com>`, Reply-To and sole recipient luc@threebyrd.com. Preview messages use those same headers. Transport distinguishes queued/delivered receipts from disabled service, rejections, suppressions and bounces. Customer distribution remains disabled. After user approves/activates the required plan: onboard sender domain, review additive DNS authentication records while preserving current routing, verify sender status, send the approved setup email, and verify mailbox reception/Reply-To. These external steps are not complete. Three targeted email tests and lint passed.

### October 21 — outbound email setup verified

Cloudflare Email Sending enabled for threebyrd.com after the owner upgraded Workers. Sending DNS configured; existing incoming routing preserved. Owner completed the limited Wrangler authorization (account/user read and email sending). Credentials stay in ignored local preview storage with restrictive permissions.

Sent exactly one setup email to luc@threebyrd.com from ThreeByrd Meal Prep <orders@threebyrd.com>, with Reply-To luc@threebyrd.com. Cloudflare accepted it and Gmail receipt was verified at 5:48 PM EDT. Gmail showed mailed-by and signed-by threebyrd.com, TLS, and the correct reply-to header. Evidence: /tmp/threebyrd-email-delivered.png. No order or payment created. Automated customer distribution remains disabled; lifecycle delivery integration is still pending.

The localhost:8976 connection error was an expired CLI OAuth callback, not the website preview. Restarted the listener and completed a fresh login successfully; localhost:3012 remained running.

## Automatic sandbox email and customer access — October 21

Added a durable SQLite notification outbox. Confirmed first payments, successful mock paid-delivery adjustments, payment failures, skips, pauses, resumes, cancellations and future-plan changes queue notifications in the same transaction as their authoritative state. Stable event IDs prevent duplicate queue entries. Local reminder preparation uses published cutoff timestamps and Eastern time, excludes purchased/skipped/paused cycles, and rechecks reminder eligibility immediately before delivery. Closed-week notices are also prepared without creating payments. This remains a local scheduler, not hosted billing.

Delivery is opt-in through an injected email transport. Only events belonging to luc@threebyrd.com can send; other customer events are blocked rather than redirected to the owner. Each event is claimed before sending. An uncertain response is retained as review_required; an interrupted sending claim also requires operator inspection. Neither is automatically retried, avoiding duplicate emails after ambiguous acceptance. Provider acceptance is recorded separately from confirmed mailbox delivery.

New isolated review entry: node scripts/weekly-sandbox/email-review.mjs, localhost:3014, separate email-review.sqlite. It reads the ignored dedicated email-only credential and runs the actual Cloudflare transport. No customer distribution, live Stripe payments or sheet writes. The reviewed mock site at 3012 is unchanged.

Browser exercised actual sign-in email delivery to luc@threebyrd.com, opened its single-use link, and confirmed authenticated access. A fictional local plan and mock first purchase were created in the isolated email-review database. Its receipt was accepted by Cloudflare. Used the management page to skip Nov 8: next delivery advanced to Nov 14, paid first delivery stayed intact, and the automatic skip confirmation arrived in Gmail with the correct Nov 8 date and /my-plan link. Screenshot: /tmp/threebyrd-week-skip-email.png. Test emails explicitly state no real delivery or live payment. Existing hashed one-use, 15-minute login links and CSRF/ownership protections remain in place; emails contain an ordinary management entry URL and require sign-in if the session has expired.

64 subscription tests pass, including transactional rollback, duplicate delivery prevention, blocked recipients, ambiguous-send handling and stale-reminder suppression. Targeted lint and TypeScript passed. Still remaining: hosted async storage/runtime port, actual recurring test payment reconciliation integrated with cutoff, recurring PaymentIntent-only Sheet export and revised paid-order upserts, real tax-aware paid-edit lifecycle, monitored hosted jobs, launch business rules and production review. No weekly production launch or remote database migration has occurred.

## Integrated recurring test payment and staging export — October 21, 6:10 PM EDT

Added a test-only cutoff preparation/reconciliation pipeline (`recurring-test.mjs`). It requires a verified paid first Checkout, saved method, published eligible cycle, no after-cutoff mutation and no unresolved earlier recurring payment. A uniquely keyed immutable prepared snapshot locks the cycle before network work. The PaymentIntent identity and calculated tax are persisted before confirmation. Re-entry cannot create a second payment; uncertain or interrupted operations require explicit reconciliation rather than blind resends. API retrieval checks test mode, customer/method ownership, metadata, currency and exact totals. Tax transaction is recorded idempotently before committing one order/export/email event. Declines and authentication-required states produce no kitchen order. No public route or scheduler enables this runner.

Executed actual Stripe TEST flow on a copied local database with the clock explicitly advanced to the sample Nov 6 cutoff. Three paid Big Chicken BBQ meals, no second gift: $33 - $1.50 discount + $2.52 test tax = $34.02. PaymentIntent pi_3UT7XJEA6WIViEj21SzFWTRn succeeded. Repeated the same operator script: one existing paid result, no additional charge. Review script and result clearly label the simulated cutoff and no real delivery. This is verified provider retrieval, not yet a signed recurring-webhook integration or hosted scheduler.

Upgraded ONLY the existing staging Apps Script deployment to Version 4. Execution identity, existing sharing, URL and secret were preserved. The receiver accepts PaymentIntent references exclusively when configured for test mode AND the exact pinned staging workbook. Other workbooks, including production, still require the existing Checkout Session contract. Existing 23 columns and kitchen formulas are unchanged. Actual PaymentIntent is placed in the legacy payment-reference column, with Notes explicitly identifying the reference type; no fake Checkout Session is invented.

Sent the verified recurring order into STAGING Orders row 24, then reran export and received no work. Browser copied A24:W24 and confirmed three physical meals, zero gift, Sunday Nov 8 delivery, discount/tax/total and actual PaymentIntent. Evidence /tmp/threebyrd-recurring-staging-row.png and /tmp/threebyrd-staging-receiver-v4.png. No production script/workbook/Worker/database or live payment was changed. Production site and API returned HTTP 200 during checks.

94 combined subscription and Google Sheets tests pass, including production-workbook rejection of PaymentIntent exports, atomic paid-order/outbox commit, decline exclusion, ambiguous-payment handling, cutoff deduplication and recurring-reference mapping. Remaining: real tax-aware self-service paid-order adjustments and sheet revisions, hosted storage/runtime and scheduled reconciliation with billing controls, recurring signed-event handling/recovery, subscriber operations view, and final launch business calendar/policies. Do not describe weekly subscriptions as production-ready.

## Hosted Stripe test review — October 21

The isolated hosted review is available at https://threebyrd-weekly-staging.thorbwag.workers.dev with persistent Durable Object storage, native sender email restricted to luc@threebyrd.com, signed Stripe test webhooks, scheduled test reconciliation and staging-sheet export. It can operate while the laptop is off. Live keys are rejected and production routes/data remain unchanged.

Browser completed an actual Stripe TEST signup for three paid meals plus one free full-size box, totaling $30.78 with test tax. The signed webhook created one paid order, automatically exported to staging row 25. A customer edit added one paid meal for $10.26, then removed it for an actual $10.26 test refund, restoring $30.78. Both adjustments reached paid state; the future recurring cart remained unchanged. Earlier isolated recurring-cutoff exercise succeeded for $34.02 and repeated without another charge. The hosted future cutoff has not yet occurred and is not claimed as an observed scheduled charge.

The staging Apps Script receiver is now Version 5, accepting ordered idempotent paid-order revisions only for the pinned test workbook. Local verified revision exports updated row 23 in place. No production workbook or frontend launch was performed. Combined subscription/Google Sheets tests: 100 passing; targeted lint and TypeScript checks passed during implementation.

Launch work remains: replace the sample delivery/cutoff/holiday calendar with approved operations dates; integrate actual delivery eligibility and capacity; complete customer/operator failed-payment and ambiguous-payment recovery; verify original-purchase refund/tax cases beyond the tested additional-payment refund; provide subscriber operations visibility; and perform controlled live configuration, monitoring, rollback and production acceptance. Current billing remains test-only and customer emails remain restricted to the owner.

## Friday cutoff, private dashboard, recovery, and existing delivery checks — October 21

Owner selected Friday 3 PM Eastern as the normal deadline. Hosted calendar preserves permanent cycle identities and applies that cutoff across daylight saving changes. Both Nov 21 and Nov 28 are closed for Thanksgiving; no order/charge those weeks. Dec 5 is the last currently published cycle; no later dates are invented. Existing committed cycles cannot be silently rescheduled. Calendar publication runs only when content changes.

Private /operations dashboard uses the existing signed-in session and an explicitly configured operator email (luc@threebyrd.com); missing configuration, other users and anonymous requests are denied. It shows active/paused/canceled subscribers, next planned delivery/cutoff, payment attention, paid-order sheet sync and revision status, delivery calendar, and separate background-task status. No payment credentials, raw provider responses or login tokens are returned. The test order shows sheet synced, revision 2.

Failed-payment management lists unpaid deliveries with no kitchen order. Customers can update their saved test card for future weeks, then explicitly skip an unpaid failed/authentication-required delivery. Stripe must confirm cancellation of the exact test PaymentIntent owned by the customer before the unresolved-cycle blocker is released. Original failure records remain unchanged for audit; repeated skip is idempotent. Uncertain/processing payments require support review. No automatic retry of a missed cutoff, no invented payment grace period, no fulfillment for declined payments. A new recovery authorization or before-kitchen grace policy would be needed to sell a missed delivery after cutoff.

Hosted staging reuses production's READ-ONLY delivery-area endpoint for enrollment/address edits and rechecks delivery plus ordering/capacity status immediately before first-checkout creation and recurring PaymentIntent creation. A fictional Ithaca test address passed the actual existing checker; capacity was disabled and ordering open. No production checkout/reservation/order was created. If a capacity cap becomes enabled, weekly billing fails closed until connected to the same atomic reservation authority; a read cannot substitute for a reservation. The production one-time checkout remains unchanged.

Separate scheduled billing, sheet sync, and owner-only email tasks record status independently, so a provider failure cannot prevent other tasks from running. Preserve a nearer alarm created during an external call. 104 combined subscription and Google Sheets tests pass; targeted lint and TypeScript pass. Browser verified dashboard access, one active test plan, zero unresolved issues, sheet revision 2 synced, correct Friday cutoffs, and both Thanksgiving closures. Staging-only deployment; no live weekly rollout.

Calendar reference: Cornell's official 2026–2027 calendar lists December 7 as the last day of instruction (https://catalog.cornell.edu/enrollment-credit-requirements/academic-calendar/). December 5–6 is therefore the weekend before that final instruction week. Current staging retains Saturday December 5 as its final published delivery, without publishing spring dates. Dashboard screenshot: /tmp/threebyrd-weekly-dashboard.png. Final isolated Worker version: 0b097879-f052-47d2-968a-7ab3fa24a87c.

## Final staged lifecycle verification — October 21, 7 PM EDT

Executed `review-launch-cycle.mjs` against actual Stripe TEST with a separate fixture database and explicitly advanced clock. Decline at Nov 6 cutoff created no kitchen order or repeat charge; actual SetupIntent verified card update; exact failed PaymentIntent was canceled before skipping the unpaid week. Customer skip Nov 14 and closures Nov 21/28 created zero jobs. Dec 4 cutoff created one $34.02 renewal for Dec 5, three paid meals and zero repeated gifts. Export reached staging Orders row 26; repeat export was empty. Browser copied A26:W26 and verified quantities, $1.50 discount, $2.52 tax, total $34.02, actual PaymentIntent and Dec 5 delivery.

Real-provider test discovered that Stripe clears primary payment_method on some card declines. Reconciliation now accepts only the exact snapshot method from last_payment_error when status is requires_payment_method and primary payment_method is null; other ownership/metadata/money checks remain mandatory. The earlier uncertain result was explicitly reconciled, without retrying its charge. Regression rejects a mismatched error method.

Added an authenticated, same-origin/CSRF-protected operator control to schedule background checks in staging. Production preparation is recorded in config/weekly-production-plan.json, with billing and customer emails disabled. The read-only launch-readiness script explicitly reports remaining production runtime, live receiver/webhook/sender and rollback work. No claim of production readiness or live deployment. Current staged Worker version 31fb186b-854e-4336-a263-66e23100111f. 106 combined tests pass; targeted lint and TypeScript pass.

## Production port and disabled rollout — October 21, approximately 7:20 PM Eastern

Production adapters/runtime implemented; separate production origin/namespace deployed with billing, signup and customer email distribution disabled. Actual rollback rehearsal succeeded; main site remains HTTP 200. See WEEKLY_PLAN_PRODUCTION_ROLLOUT.md for exact versions, test boundaries, receiver backup and resume procedure. 113 combined tests pass, targeted lint and TypeScript pass.

Production receiver source saved and verified after reload; publication denied to current Cornell account. Existing deployed one-time receiver remains unchanged. Stripe production dashboard requires verification before existing live key reveal; no new key created or secret copied. All other preparation persisted. Do not claim live launch or enable billing until those connections and remaining release checks pass.
