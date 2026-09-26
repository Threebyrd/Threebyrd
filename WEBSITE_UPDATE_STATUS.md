# ThreeByrd website update status

## Current production state — 2026-09-26

- The cutoff-rollover hotfix is deployed from commit `3c0ed2b` as Worker version `79aaecb3-aa8e-4213-9590-88fb8acb4b50`; Pages workflow run `36264784314` completed successfully. Checkout remains available before, at, and after each cutoff; the cutoff only assigns the fulfillment window.
- Production Worker `threebyrd-website` is live at `https://api.threebyrd.com` with `ORDERS_OPEN=true`, `STRIPE_MODE=live`, and uncapped capacity (`ORDER_CAPACITY_CONFIG.limit=null`). The structured-address update is deployed from commit `5f0f92e` as Worker version `8b477d36-a3c7-4748-9c4c-17cd53ed1c5a`. Existing paid orders and D1 data remain intact.
- GitHub Pages production is live at `https://threebyrd.com` from commit `5f0f92e`; Pages workflow run `36263335605` completed successfully.
- The one-time special window has rolled over. The live site currently assigns orders to Friday, October 2 at 3:00 PM ET → Saturday, October 3; after that, it continuously rolls to the next Friday cutoff and Saturday delivery with no weekly cutoff closure.
- The current customer update adds structured Street Address, City, State, and ZIP Code fields with native autofill attributes. The Worker reconstructs and validates the structured address server-side; the canonical Google-validated address remains the value propagated to Stripe metadata, D1, webhook fulfillment, and Sheets.
- The customer-facing availability-status card was removed. Capacity remains dormant infrastructure and is used only for the runtime emergency open/closed gate while production is uncapped.
- Read-only post-deploy verification confirms 5 confirmed production orders, 29 confirmed meals, and 0 active reservations; no checkout session or payment was created by this update.
- This status section supersedes the historical staging-only deployment notes below; those notes are retained as an audit trail.

## Current phase

The original staging validation and direct Sheets export work are complete. Historical staging notes below describe the validation sequence at the time; production deployment status is recorded above.

### Final staging Sheets redirect validation — 2026-09-26

- Deployed staging Worker version `f391e777-bda2-419f-b559-ec6b59dc09e0` with the corrected Apps Script redirect flow. The authenticated staging diagnostic returned HTTP 200 from the newly deployed Apps Script and reported `ThreeByrd Weekly Orders - STAGING` → `Orders`, `headersValid=true`, and `lastRow=3` before the final export.
- Completed exactly one hosted Stripe test checkout through the staging Worker: 3 Big Chicken + 2 Big Beef, 5 meals, 5–9 tier, `$47.00`, validated address `700 W Buffalo St, Ithaca, NY 14850, USA`, session `cs_test_b15MVQfgmaWmlZxjdQ6tT2B3rmVC34uA5BJI2mH0t23OK3fA6aaZCyngjp`.
- The payment redirected to the static `/success` page. Webhook fulfillment created exactly one confirmed D1 order and one confirmed 5-meal reservation. The outbox export was synced on the first scheduled attempt; the Apps Script diagnostic then reported `lastRow=4`, confirming the row was appended to the configured destination.
- A forced retry of the same synthetic outbox row completed with `attempts=2`, `status=synced`, no error, and no row-count increase (`lastRow` remained 4). This proves the duplicate-safe retry path reached the Apps Script duplicate contract without creating a second Sheet row, order, reservation, or capacity decrement.
- The final staging cleanup removed only the synthetic D1 order, reservation, and outbox row. The Stripe test session and successful Sheet row remain for audit/manual inspection. Final staging capacity is limit 50, confirmed 0, reserved 0, remaining 50, `ordersOpen=false`; closed checkout returns HTTP 503.
- The connected Drive account exposes two similarly titled header-only spreadsheets, so it could not independently read the configured Apps Script destination. The Apps Script diagnostic is authoritative for the configured target and confirms the destination name, worksheet, headers, and row count; no alternate Sheet was modified.

## Completed

- Replaced product-card food photography with the six supplied meal photos, using matched 3:2 presentation and optimized JPEG assets.
- Added a two-image hero carousel using the supplied diagonal Big Chicken and Big Beef photos. The chicken source is flipped so broccoli is on the left and both images share the same visual direction.
- Added free-delivery-in-Ithaca messaging and a delivery-address eligibility step.
- Added server-side Google Geocoding plus traffic-unaware Routes API validation from `700 W Buffalo St, Ithaca, NY 14850`, enforcing a 20-minute maximum drive time before Stripe Checkout creation.
- Added structured Stripe Checkout metadata for product quantities, total meals, normalized delivery address, delivery date, pricing, and the existing reservation identifiers.
- Shifted the one-time local/staging cutoff override to Saturday, September 26, 2026 at 3:00 PM Eastern, with next-day Sunday cook/delivery messaging. The recurring schedule remains Friday at 3:00 PM Eastern after the override expires.
- Kept meal-based capacity, cart-wide pricing, Stripe mode isolation, webhook verification, D1 idempotency, and CORS logic intact.
- Removed obsolete food-image duplicates and temporary asset staging files from the repository.
- Made the server-validated pre-Checkout delivery address authoritative by storing it in server-generated Checkout metadata and using that metadata during webhook fulfillment; hosted Checkout address changes cannot redirect a paid order to an unvalidated destination.
- Added a Cloudflare-edge client-key guard that permits only one active reservation per client/window, without storing raw IP addresses, and returns a safe conflict response for repeated attempts.
- Added Stripe-session cleanup for the create/attach race: if Stripe creates a session but the reservation cannot be attached, the Worker attempts to expire the session and retains the reservation until normal expiry/reconciliation.
- Added secret redaction for Stripe, webhook, and Google provider errors before they reach Worker logs.
- Added a fail-closed capacity loading/error state with retry, fixed the delivery eligibility response contract used by the browser, kept quantity editing available across fulfillment-window rollover, and made mobile anchor navigation close its menu.
- Removed the stale Checkout cutoff guards. The cutoff now only selects the fulfillment window; checkout remains available at every point in the week, and paid webhook reconciliation no longer compares session timestamps to the wall-clock cutoff.
- Hardened paid webhook reconciliation so capped sessions must match their exact reservation ID, capacity window, meal count, and Stripe `client_reference_id`; no reservation-less paid event can create a capped order.
- Made the browser honor the Worker’s runtime `ordersOpen` state before enabling quantity controls or checkout, and reject partial Google geocodes before routing.
- Hardened the Apps Script sheet writer against formula-like customer text. The updated `google-apps-script/Code.gs` must be redeployed to the staging/production Apps Script projects before relying on that protection.
- Made the Apps Script destination explicit with the required `GOOGLE_SHEETS_SPREADSHEET_ID` property and `SpreadsheetApp.openById(...)`; the script no longer uses or falls back to the active container-bound spreadsheet. Missing or inaccessible spreadsheet destinations return safe structured errors.

## Validation

- `npm test` — pass after the cutoff-rollover hotfix (74 tests).
- `npm run lint` — pass.
- `npx tsc --noEmit` — pass.
- `npm run build` — pass.
- `npm run build:pages` — pass.
- Production and staging Wrangler dry runs — pass.
- Staging Worker deployed at `https://threebyrd-website-staging.thorbwag.workers.dev`; current closed-order version `db012308-ecc6-47a7-803e-362de20de2c7`.
- Staging `STRIPE_MODE=test` is deployed. Wrangler confirms the expected secret names exist (`STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `GOOGLE_MAPS_SERVER_API_KEY`, `GOOGLE_SHEETS_WEB_APP_URL`, and `GOOGLE_SHEETS_SYNC_SECRET`); secret values were never read, logged, or committed. A safe runtime diagnostic confirms both Sheets secrets are accessible without printing their values.
- Staging `/api/capacity` after cleanup — HTTP 200, limit 50, confirmed 0, reserved 0, remaining 50, `ordersOpen:false`.
- Staging Google validation — kitchen origin 1 minute; Cornell-area address 7 minutes; Dryden boundary case 19 minutes; Trumansburg 17 minutes; valid Binghamton/Cortland addresses rejected outside the 20-minute zone; locality-only, invalid, and malformed inputs rejected with HTTP 400.
- Staging hosted Stripe Checkout completed successfully for three synthetic test carts:
  - 3 Big Chicken — 3 meals, 3–4 tier, $30.00; session `cs_test_a1drxkSwQ1q4BPHqs16XOEuIHEp05iAbTpNH1voLOFUsrvQXH8h1oaeJtL`.
  - 3 Big Chicken + 2 Big Beef — 5 meals, 5–9 tier, $47.00; session `cs_test_b1TwS8IgrBaZzaizPHpq3BKof3LfxLZ0pCfLjnti6i0iifvuSGp3kr3Bo4`.
  - 5 Big Chicken + 5 Big Beef — 10 meals, 10+ tier, $90.00; session `cs_test_b12wwX96e93M4cR567puhs9IHpKDHMfmOiFntevNNyLpSjnmkcGjCfDzWx`.
- The new staging test key is functioning: all three sessions were created by the Worker and paid through Stripe-hosted test Checkout without exposing the key. Stripe webhook processing confirmed each reservation and inserted exactly one D1 order per session. D1 stored the normalized eligible address (`700 W Buffalo St, Ithaca, NY 14850, USA`) and a 1-minute route result.
- Capacity was enforced in meal units: 50 → 47 after the first reservation, → 42 after the second, → 32 after the third; each paid webhook converted its reservation to `confirmed` without double-counting it. The staged D1 rows contained 3, 5, and 10 meal reservations and matching $30.00, $47.00, and $90.00 orders.
- Server-generated metadata was verified against the canonical quote and metadata tests. The 5-meal sample is: `big_chicken_qty=3`, `big_beef_qty=2`, `little_chicken_qty=0`, `little_beef_qty=0`, `total_meals=5`, `totalBoxes=5`, `subtotalCents=4700`, `pricingTier=5-9`, `delivery_date=2026-09-27`, and the normalized delivery address. Reservation/window identifiers and the cart JSON are also attached server-side.
- The webhook route rejected an unsigned request with HTTP 400. Replayed delivery is covered by the passing atomic D1/idempotency tests and the unique `orders.stripe_session_id` constraint; the three live staging sessions each produced one row. A direct Stripe CLI resend was not available because the locally authenticated CLI context is live-only; no live event or credential was used for staging.
- All synthetic staging orders and reservations were deleted after verification. Final staging D1 counts are `orders=0`, `reservations=0`, `active_reservations=0`. A closed-order smoke request returns HTTP 503.
- Staging `/success` and production `/success?session_id=...` both return HTTP 200. The static bundle contains no Stripe secret prefixes.
- Independent UX and engineering/security reviews completed. The frontend contract, capacity fail-closed behavior, mobile menu, cutoff guard, delivery-address authority, reservation-hoarding guard, Stripe-session cleanup, and log-redaction findings were fixed locally and redeployed to staging. Lower-priority copy/signup/accessibility suggestions remain non-blocking for this scope.

## Direct Google Sheets export (staging-only)

- Replaced the unfinished Zapier order-export design with a direct ThreeByrd webhook → D1 outbox → Google Apps Script Web App path. Zapier is not used by the implementation.
- Added `order_sheet_exports` as an additive D1 outbox table. A paid, verified, idempotently confirmed order and its pending export are created in the same D1 batch; Google Sheets is never on the Stripe webhook critical path.
- Added five-minute Worker retry processing with a five-minute per-claim lease token, bounded exponential backoff from 5 minutes to 6 hours, safe generic error reasons, and duplicate-safe `order_id`/`stripe_session_id` handling.
- Added `google-apps-script/Code.gs` for the existing `ThreeByrd Weekly Orders` → `Orders` worksheet. It authenticates with `GOOGLE_SHEETS_SYNC_SECRET`, validates the exact 17-column header, uses `LockService`, and treats an existing Order ID or Stripe Session ID as an idempotent duplicate.
- Added `GOOGLE_SHEETS_SETUP.md` with the exact Apps Script deployment, Script Property, Cloudflare staging configuration, test/live mode isolation, verification, and cleanup steps. The existing `scripts/apps-script/Code.gs` launch-list handler was left unchanged.
- Added automated payload, numeric-dollar, retry, timeout, malformed-response, endpoint-failure, Apps Script authentication, explicit spreadsheet destination, duplicate-row, test/live isolation, stale-claim, outbox, strict export-success, destination-diagnostic, redirect, no-credential-material, reservation-hoarding, delivery-authority, and Stripe-session-race tests. `npm test` passes with 69 tests; lint, TypeScript, Pages build, staging dry run, and production dry run pass.
- Added and applied `drizzle/0004_marvelous_angel.sql`, `drizzle/0005_purple_luckman.sql`, and `drizzle/0006_fast_wolverine.sql` to staging only. The staging database already contained the earlier schema but had an empty migration history, so Wrangler's full migration command was intentionally not used; the three additive migrations were applied directly after confirming their tables/columns were absent.
- Staging Worker version `0637de76-ee79-45c1-a7e9-fd002b083aea` is deployed at `https://threebyrd-website-staging.thorbwag.workers.dev` with `ORDERS_OPEN=false`, `STRIPE_MODE=test`, zero staging orders/reservations/exports, and capacity 50 remaining. Both Sheets secret names are present; the corrected URL passes the exact `/exec` allowlist at runtime.
- No production Worker, production D1, production secrets, DNS, live Stripe configuration, or GitHub Pages deployment was modified.

### Latest staging Sheets verification attempt

- Staging was temporarily opened and one real Stripe test-mode checkout was completed through the normal hosted Checkout flow: 3 Big Chicken + 2 Big Beef, 5 meals, 5–9 tier, `$47.00`, eligible address `700 W Buffalo St, Ithaca, NY 14850, USA`.
- Stripe webhook fulfillment succeeded. D1 recorded exactly one confirmed order, one confirmed 5-meal reservation, and one Sheets outbox row. Capacity moved from 50 to 45 without double-counting.
- The corrected staging secret is present as `GOOGLE_SHEETS_WEB_APP_URL`; the Worker accepted the exact `/exec` shape without exposing the URL or sync secret. The outbox export completed successfully on the first delivery and again after a safe retry (`attempts=4`, `status=synced`), demonstrating retry/idempotent acceptance at the Worker boundary.
- The Google Drive connector currently exposes two accessible spreadsheets titled `ThreeByrd Weekly Orders` (IDs `1gFUT-PS8VL36ss6CP-jAmEyq_YeRTA16B3I0wGTyM2k` and `1ILY3HX_4a2J1_VFfnpgPJD-CeDI5VqAD13dnCpSM_7E`). Both `Orders` tabs still contain only the required header row, so the expected 17-column test row could not be independently confirmed. This indicates the active Apps Script deployment is targeting a different spreadsheet, a different Google account, or a deployment whose bound spreadsheet/code does not match the accessible staging file; it is not safe to claim Sheet-row validation complete.
- The exact validated payload generated for the test was: `Order Date/Time=2026-09-25 8:51 PM`, `Order ID=cs_test_b16LH7Wwqj0ltOkYMWwxka5N2M2kwQ68laRisCTLCWpqklzcJY97yNjk9z`, `Customer Name=Staging Sheets Validation`, `Phone=+16075550199`, `Email=staging-sheets@example.com`, `Ithaca Delivery Address=700 W Buffalo St, Ithaca, NY 14850, USA`, `Big Chicken Qty=3`, `Little Chicken Qty=0`, `Big Beef Qty=2`, `Little Beef Qty=0`, `Total Meals=5`, `Total Paid=47.00`, `Delivery Date=2026-09-27`, `Stripe Session ID` equal to the Order ID, `Payment Status=paid`, `Order Status=New`, `Notes=` blank. These are payload values, not a claim that a visible Sheet row exists.
- Synthetic staging D1 orders, reservations, and outbox data were removed after the retry investigation. Final staging state is `orders=0`, `active_reservations=0`, `exports=0`, capacity `50`, and `ordersOpen=false`. The paid Stripe test object remains in Stripe test mode only and was not used in production. The successful Stripe test checkout itself is intentionally not deleted from Stripe, but no synthetic operational D1 record remains.

### Latest explicit-destination staging verification

- After the Apps Script deployment was updated with `GOOGLE_SHEETS_SPREADSHEET_ID`, staging was opened temporarily and one normal hosted Stripe test checkout completed: 3 Big Chicken + 2 Big Beef, 5 meals, 5–9 tier, `$47.00`, eligible address `700 W Buffalo St, Ithaca, NY 14850, USA`.
- The checkout session was `cs_test_b1m9avnXkGPuijQSDtEA2BbZlGkyPrs13qv8s0b3S3xdfPKjkFvkIcE4Ks`. D1 recorded exactly one confirmed order and one confirmed 5-meal reservation; the webhook completed fulfillment once and capacity moved 50 → 45. The order used the server-authoritative normalized address and the 5–9 pricing tier.
- The D1 outbox created exactly one export. The first scheduled attempt returned the prior generic endpoint rejection; after the Worker was redeployed with safe Apps Script error classification, the next retry recorded `spreadsheet_unavailable` and remained pending/retryable. No secret, spreadsheet ID, or provider response detail was logged.
- The Apps Script endpoint therefore reached the explicit `openById(...)` branch but could not open the configured spreadsheet. Both accessible candidate `ThreeByrd Weekly Orders` spreadsheets remain header-only, so no Sheet row can be claimed as written. This requires a human check of the configured spreadsheet ID and Apps Script owner permissions.
- The synthetic D1 order, reservation, and outbox row were then removed. Staging was redeployed closed; `/api/capacity` reports limit 50, confirmed 0, reserved 0, remaining 50, `ordersOpen=false`, and checkout returns HTTP 503. The Stripe test Checkout Session remains in Stripe test mode for audit; no production data was touched.

### Latest staging Apps Script deployment verification

- Staging secret names were confirmed present without reading values. The Worker accepted the configured URL's exact `/exec` shape and successfully delivered the new test export to the endpoint; the outbox transitioned from `pending` to `synced` on the scheduled run.
- One Stripe test checkout was completed through the normal hosted flow: 3 Big Chicken + 2 Big Beef, 5 meals, 5–9 tier, `$47.00`, eligible normalized address `700 W Buffalo St, Ithaca, NY 14850, USA`. Webhook fulfillment created exactly one confirmed D1 order and one confirmed 5-meal reservation; capacity moved 50 → 45.
- The same export was safely replayed once. The outbox returned to `synced` with `attempts=2`; no second D1 order, reservation, or export row was created.
- Direct reads of both accessible `ThreeByrd Weekly Orders` spreadsheets still returned header-only `Orders` tabs. Because the Apps Script endpoint returned success while no expected row is visible in the accessible destinations, the exact deployed Web App target remains unresolved and the Sheet-row assertion is not claimed as passed.
- Synthetic staging order, reservation, and export rows were removed with exact predicates. Staging was redeployed closed at Worker version `db012308-ecc6-47a7-803e-362de20de2c7`; final capacity is 50, with zero orders, active/confirmed reservations, and exports. Closed checkout returns HTTP 503.

### Apps Script response-contract hardening

- The Worker now accepts export success only when the response explicitly contains exactly one of `inserted:true` or `duplicate:true`; generic `{ok:true}`, `doGet()` health responses, malformed success bodies, and conflicting success flags remain retryable failures.
- Apps Script writes and duplicate responses now include safe destination diagnostics (`spreadsheetName`, `worksheetName`, `lastRow`, and `headersValid`). Authenticated `diagnostic:true` POSTs inspect the configured destination without appending a row; `doGet()` explicitly includes `exportResult:false`.
- The pre-fix staging diagnostic observations above are retained for history. The current staging-only, read-only `POST /api/sheets-diagnostic` route returns HTTP 200 from the deployed diagnostic-capable Apps Script; the Worker follows the `/exec` 302 with GET, and the configured destination reports the expected spreadsheet, worksheet, headers, and row count.
- No new Stripe order was created for this diagnosis. Staging remains closed and clean; production was not modified.

### Current review findings

- Responsive browser smoke testing passed at 320, 375, 390, 430, and 1440px: no horizontal overflow, broken images, or console errors; the ticker moved; and the signup section appeared once. The static order-page home link uses `prefetch={false}` to avoid a Vinext RSC prefetch console error in the deployed browser runtime.
- The independent engineering/security review identified and the primary agent fixed three checkout blockers: repeated unauthenticated attempts could hoard temporary reservations; hosted Checkout address changes could create a paid but unfulfillable order; and a rare Stripe-session/reservation attachment failure could leave a payable session unlinked. Regression coverage now proves the client guard, metadata-authoritative delivery path, and created-session expiry path. The latest reviewer task completed without surfacing additional text; the primary review rerun and local attack/regression suite found no new blocker.

### Checkout safety fixes validated in staging

- Reservation hoarding: a Cloudflare-edge SHA-256 client key is used only for the active-reservation uniqueness check. The raw IP is never stored or logged. A second active attempt returns HTTP 409 and does not create another Stripe session; expiry/release permits a later attempt.
- Paid-but-unfulfilled address changes: Checkout no longer collects a mutable shipping address. The previously Google-validated, normalized address is written into server-generated metadata and the webhook persists only that value. Stripe-hosted mutable fields are not used for fulfillment eligibility.
- Stripe-session attachment race: if session creation succeeds but reservation attachment fails, the Worker attempts `checkout.sessions.expire`; the reservation remains available for normal TTL cleanup/reconciliation if expiry cannot be confirmed. This avoids a usable unlinked payment session while preserving webhook reconciliation safety.

## Required staging-only setup

`GOOGLE_MAPS_SERVER_API_KEY`, the active Stripe test secret, the staging webhook signing secret, `GOOGLE_SHEETS_WEB_APP_URL`, and `GOOGLE_SHEETS_SYNC_SECRET` are configured on `threebyrd-website-staging`. Keep them as Cloudflare Worker secrets; do not put either Stripe value, the Sheets sync secret, or the Apps Script URL in the frontend, repository, logs, or a committed environment file. The URL must be exactly `https://script.google.com/macros/s/<deployment-id>/exec` with no query string or fragment. Staging is intentionally restored to `ORDERS_OPEN=false` after verification.

## Zapier mapping

Use a Stripe test/live `Checkout Session Completed` trigger only as an operational notification/fulfillment input; D1 and the verified webhook remain authoritative. Map the event as follows:

| Zapier source | ThreeByrd meaning |
| --- | --- |
| `data.object.id` | Stripe Checkout Session ID / D1 `stripe_session_id` |
| `data.object.payment_intent` | Stripe Payment Intent ID |
| `data.object.customer_details.email` | Customer email |
| `data.object.customer_details.name` | Customer name |
| `data.object.customer_details.phone` | Customer phone |
| `data.object.amount_total` | Paid total in cents; format as dollars only in the destination |
| `data.object.currency` | Currency (`usd`) |
| `data.object.metadata.order_id` | Internal capacity reservation/order correlation ID |
| `data.object.metadata.big_chicken_qty` | Big Chicken quantity |
| `data.object.metadata.little_chicken_qty` | Little Chicken quantity |
| `data.object.metadata.big_beef_qty` | Big Beef quantity |
| `data.object.metadata.little_beef_qty` | Little Beef quantity |
| `data.object.metadata.total_meals` or `totalBoxes` | Total meals/boxes |
| `data.object.metadata.pricingTier` | Cart-wide pricing tier |
| `data.object.metadata.subtotalCents` | Meal subtotal in cents |
| `data.object.metadata.delivery_address` | Server-normalized delivery address |
| `data.object.metadata.delivery_date` | ISO cook/delivery date |
| `data.object.metadata.cart` | Canonical cart JSON |
| `data.object.metadata.cutoffAt` | Cutoff timestamp used for the order |
| `data.object.metadata.capacityReservationId` | Capacity reservation ID |
| `data.object.metadata.capacityWindowKey` | Capacity window key |

The Zap is safe to publish only if it filters for paid `checkout.session.completed` (or a separately handled successful asynchronous payment), never trusts client-submitted prices, and does not create a second order record. It has not been published from this repository because no Zapier account or destination was configured here.

## Production deployment steps after approval

1. Open the existing `ThreeByrd Weekly Orders` spreadsheet, deploy `google-apps-script/Code.gs` as a Web App, set its `GOOGLE_SHEETS_SYNC_SECRET` Script Property, and provide the resulting `/exec` URL. Do not put the secret in Git or a frontend variable.
2. Add the Apps Script URL and matching sync secret to the staging Worker first, temporarily open staging only, complete one test order, confirm every `Orders` column and duplicate behavior, then remove the synthetic row/data and restore `ORDERS_OPEN=false`.
3. Before production deployment, inspect production D1's actual schema and migration history. If `order_sheet_exports` is absent and the prior schema is already present without tracked Wrangler migrations—as staging was—apply only the additive files, in order: `drizzle/0004_marvelous_angel.sql`, `drizzle/0005_purple_luckman.sql`, and `drizzle/0006_fast_wolverine.sql` (the last adds the nullable client guard key and index). Do not replay migration 0000 against an existing `orders` table. Preserve all existing confirmed meal reservations/orders; do not backfill or reset capacity without reconciling real cart quantities first.
4. Add the production Apps Script `/exec` URL and matching sync secret as server-only production Worker bindings. Do not leave the empty `GOOGLE_SHEETS_WEB_APP_URL` placeholder in `wrangler.jsonc`; remove it before deployment so it cannot shadow the configured secret. Keep live Stripe secrets separate and never expose either Sheets value to Pages.
5. Build and deploy the Worker with the existing live secrets, `STRIPE_MODE=live`, the production `DB` binding, and the existing `api.threebyrd.com` custom domain. Keep `ORDERS_OPEN=false` until health checks pass.
6. Build/publish the GitHub Pages frontend with `NEXT_PUBLIC_CHECKOUT_API_ORIGIN=https://api.threebyrd.com`; do not publish secrets.
7. Verify `/api/capacity`, CORS, delivery validation, cart-wide pricing, minimum order, Little Beef availability, webhook delivery, D1 idempotency, static `/success`, and one successful Sheets retry before setting `ORDERS_OPEN=true`.
8. Change only the production Worker variable `ORDERS_OPEN` to `true`, deploy that Worker, and monitor Stripe/webhook/D1/Sheets health. Do not use staging secrets or staging D1.

## Rollback procedure

Immediately set production `ORDERS_OPEN=false` and redeploy the Worker; this closes new checkout attempts without deleting existing paid orders or reservations. Keep D1 rows intact for reconciliation. If the application rollback is required, redeploy the previously verified Worker/frontend commit after confirming the additive schema remains compatible, then recheck `/api/capacity`, webhook health, and the live D1 order count. Never delete paid orders as part of an application rollback.

## Production boundary

No production deployment or live configuration change was made. A read-only health check of the currently deployed production API returned HTTP 200 but reported `enabled:false`, `limit:null`, `confirmedMeals:26`, `reservedMeals:0`, and `ordersOpen:true`; production is still on its prior uncapped configuration. This is the primary launch blocker: apply and verify the production D1/config deployment before relying on the 50-meal cap. The 26 confirmed meals were not modified. The production Wrangler config now declares the Sheets URL as a required secret name but contains no value; the production Apps Script URL and sync secret must be configured manually before any production Sheets deployment.
