> Current pricing correction: paid meals retain regular sauce charges ($1 for BBQ/RedHot); only the free welcome meal includes its sauce. The 5% discount applies to meal prices, excluding sauce charges. This supersedes earlier free-sauce wording below.

# Stage 2 — functional local customer sandbox

## Status and scope

This stage implements a customer-facing, persistent local application at `http://localhost:3012`, separate from the public website and the Stage 1 scenario report. A person can request a mock email link, verify identity, choose paid meals and a welcome meal, accept versioned staged recurring terms, save a mock payment method, and edit/skip/pause/resume/cancel the plan. It persists to an isolated SQLite database under the ignored `.local-previews/weekly-stage2/` directory. Browser reloads and process restarts preserve customer records and plan choices.

This is local only, not a production-ready deployment. The entry page demonstrates the one-time/weekly choice; the existing one-time checkout is deliberately outside this service and remains unchanged. Meal choices use the existing shared catalog, images, tier validation and weekly quote/domain rules, with a dedicated editable customer UI rather than modifying the live React order builder. Integration into the actual website and its Worker/D1 architecture remains required before public rollout. No email provider has been selected or configured. No real Stripe test API calls were made without credentials; the Stripe adapter was tested using signed fixture events and a mocked SDK.

No automatic charges, kitchen orders, welcome redemptions, real customer emails/SMS, production migrations, or deployments occur. The Node service refuses production mode and a billing-enable flag. It only binds loopback, requires the configured localhost Host, and does not load `.env.local` or existing live credentials. It does not support public staging hosting as-is.

## Run and review

Requires Node 24 (for built-in `node:sqlite` and TypeScript stripping), existing project dependencies, and no new packages.

```
npm run build:weekly
npm run dev:weekly
```

Startup prints the customer URL and a separate private test-inbox URL with a random developer access key in the fragment. Open both. The developer key is not a customer login token; do not publish it or reuse this inbox design in production.

1. On the customer page choose Build my weekly plan. Enter a fictional email such as `review@example.test`.
2. Open the private test inbox, click Refresh inbox, then the email's sign-in link. Real email is not sent.
3. Choose meals/sauces, a welcome small meal, name and test address. The mock zone accepts numbered street addresses in Ithaca, NY 14850. This is NOT a real geographic delivery determination.
4. Review price breakdown, first delivery/cutoff and authorization. Accept and continue to mock card setup.
5. Simulate failed, canceled or successful setup. No actual card number is collected in mock mode.
6. Manage weekly deliveries, edit one week or usual defaults, skip/unskip, pause until a published return or indefinitely, resume, update name/address and welcome selection, update the test card, and cancel.

Session cookies are HttpOnly, Secure and SameSite=Lax. Use `localhost`, which Chrome treats as a secure local context; do not substitute an arbitrary HTTP hostname. No login tokens are logged or put in query strings. Email-link tokens travel in the URL fragment, are removed from browser history before exchange, expire after 15 minutes and are consumed once. The mock inbox retains links in process memory only (maximum 30 messages) and clears on restart. Reopen the printed developer URL after reloading the inbox page; its key is intentionally not stored by the UI.

`WEEKLY_SANDBOX_PORT` and `WEEKLY_SANDBOX_DB` can override the port and isolated database file. Do not point at production data. Mock and Stripe-test databases are rejected if their existing plan environment differs; use a separate file per mode.

## Storage and security

`app/subscriptions/sandbox/schema.sql` is an additive SQLite schema applied only by this standalone sandbox. It is not added to production migration discovery.

Tables cover verified identities, hashed login/session tokens, persistent request limits, published cycles with historical revisions, per-environment Stripe customer mappings, plans/defaults/overrides/skips, versioned authorization evidence, setup attempts, deduplicated setup events, customer-wide welcome redemptions, change audit snapshots, and immutable committed-order snapshots. There is at most one current plan per verified customer; re-enrollment creates a new plan ID and authorization while retaining customer identity/entitlements. Legacy Stripe records are never merged.

Authenticated changes require exact same origin, a session-specific CSRF header and an owned customer record. IDs supplied by a client do not select another customer. JSON/body sizes are limited. Login responses do not reveal whether the email exists. Requests are throttled per hashed email and loopback client identity; public deployment requires a trusted edge-derived IP/rate-limit strategy, not this loopback fixture. Tokens/sessions expire, are random 256-bit values, and raw values are not stored in SQL. Sign-out deletes the current session. Production email delivery and full account-recovery procedures are not implemented.

Changes use synchronous `BEGIN IMMEDIATE` transactions and optimistic plan versions, rechecking current calendar, clock, locks, inventory, and customer ownership on save. A stale edit receives 409. State reads and domain updates use trusted stored identity; submitted prices, eligibility flags, and Stripe IDs are not accepted as authority. No promotions stack with enrollment. The audit includes plan and address snapshots. Committed snapshots reject UPDATE/DELETE at the database level; a support adjustment must be a separate audit record. No paid-order creation path exists in this stage.

The default runtime availability provider uses the shared catalog. Tests inject unavailable meals/sauces to verify rejected edits. Production inventory publication needs an operator source before launch. Existing commercial delivery eligibility is not modified; the sandbox injects mock address validation. Before public staging, inject the existing server-side delivery service with dedicated test configuration rather than treating the sample Ithaca check as proof of eligibility.

## Calendar publication

A dedicated `sampleCalendar()` in `scripts/weekly-sandbox/server.mjs` seeds an empty local database. It is explicitly not `preview-config.ts` and not an approved operational calendar. The UI labels its dates/closure as examples. There is no public admin editor.

`WeeklyStore.publish(calendar)` validates stable identity and sequence, chronology, cutoff/charge equality, and weekend dates, keeps revision snapshots, rejects dropping history or renumbering, and refuses changing a committed cycle. Publication is an operator-only code path, not an HTTP endpoint. On restart it does not overwrite existing published cycles. Tests exercise rescheduling locks. For real rollout, publish approved dates in a separately authorized operator workflow and reconcile shared one-time ordering deadlines without changing existing schedules silently.

## Stripe test setup

The installed Stripe SDK is 22.6.2 locally, compatible with the repository's `^22.6.1` range; its default API version is `2026-08-26.dahlia`. Setup parameters are built in the typed `stripe-setup.ts`, so existing SDK definitions check them. Checkout's `setup_intent_data` does not expose a `usage` parameter; setup-mode Checkout is used and `off_session` usage is verified on the resulting SetupIntent.

By default the provider is mock. To exercise actual Stripe TEST setup later, supply only these dedicated environment variables to this local service:

- `WEEKLY_STRIPE_TEST_KEY`: a test-mode secret/restricted key with customer, Checkout setup, SetupIntent and payment-method permissions.
- `WEEKLY_STRIPE_TEST_WEBHOOK_SECRET`: the signing secret for this separate test endpoint.
- A separate `WEEKLY_SANDBOX_DB` path for Stripe-test mode.

No credentials are included or auto-read. Live keys are rejected. Configure a Stripe CLI test forwarder to `/api/setup-webhook` for `checkout.session.completed`. The webhook path is distinct from live ordering's Stripe webhook.

The adapter creates/reuses a stable per-verified-customer test Customer with an idempotency key, then a setup-mode hosted Checkout Session with no meal line items and no charge. It verifies the raw signed event, rejects livemode, retrieves the current Checkout Session and SetupIntent, requires `succeeded` and `off_session`, and verifies the saved payment method belongs to the mapped customer and is test-mode. The stored setup attempt must match the current enrollment. Duplicate events are idempotent; older attempts cannot replace a newer method, and cancellation prevents readiness activation. A success URL or canceled/failed setup never grants readiness by itself. The resulting state is `staged_ready`, not a billable subscription.

Stripe-test card setup has NOT been exercised against a real Stripe test account during this stage because separate credentials/webhook forwarding were not configured. That remains a required integration check before launch. No scheduler or PaymentIntent charge call exists here.

Official documentation checked October 21, 2026:
- https://docs.stripe.com/api/checkout/sessions/create
- https://docs.stripe.com/api/setup_intents/retrieve
- https://docs.stripe.com/events/manage-webhook-endpoints

## Drafts and remaining decisions

Local terms/privacy screens and `docs/drafts/WEEKLY_PLAN_TERMS.md` / `WEEKLY_PLAN_PRIVACY.md` describe the actual staged behavior and are not published. Existing public policies are unchanged. A fresh authorization to final terms is required at launch; staged consent is not a way to start charging these fictional or test enrollments.

Before public rollout: confirm final tax treatment of discounted/free meals, failure-recovery deadline, refund/support rules, price-change notice rules, calendar publication lead time, transactional email provider/domain, production identity recovery and inventory publication, and whether free sauces on all paid subscription meals are approved economically. Unresolved decisions did not block the isolated mock experience; they do block real billing/delivery promises.

## Migration, rollout and rollback

No production database or worker configuration was changed. Removing the sandbox files/scripts stops this feature without affecting existing checkout. Local test data can be archived/deleted deliberately; it is ignored by Git. Do not delete real authorization/paid-order/redemption history in a future rollback.

Before deploying on the existing Cloudflare Worker, port the local synchronous SQLite store to the async D1 transaction/conditional-write model, create reviewed additive migrations, preserve all server authorization and atomic cutoff/version guarantees, and integrate the UI into the existing app/router/design. Node's DatabaseSync cannot run in the current Worker. Alternatively choose and review a separate persistent Node backend; do not accidentally ship this loopback review server as production infrastructure. This is a deliberate isolation choice for the customer review, not completed production hosting.

Stage 3 must first complete that runtime integration and then implement durable scheduling, trusted tax calculation, immutable cycle orders, signed paid-event reconciliation, atomic welcome reservations/redemption, payment recovery/authentication, notices and fulfillment exports. No production enablement without a separate approved rollout and end-to-end test-mode verification.

## Verification completed October 21, 2026

- 158 tests passed: 145 prior tests and 13 new Stage 2 tests, including real in-memory/file SQLite transactions, authentication/expiry/reuse, authorization evidence, access isolation, CSRF/origin enforcement, stale edit conflicts, all plan actions, ownership/mode checks, immutable orders, restarts, and signed Stripe fixture verification.
- TypeScript and repository lint passed. Existing website build passed locally, without any new public route or live checkout changes.
- Chrome customer-flow test passed: request mock email, consume link, enroll, failed then successful mock setup, one-week edit without changing defaults, skip, closed-cycle holiday pause/return, resume, update name/address, refresh persistence and cancel. Customer mobile/desktop screenshots were inspected. No real email, payment, delivery or remote database command occurred.
- Stripe setup parameters are type-checked against the installed SDK. Real Stripe test setup and real email-provider integration remain unverified/unconfigured and are required before public deployment.

See `WEEKLY_PLAN_STAGE3_PROMPT.md` for the next-stage handoff. Customer sandbox: http://localhost:3012/; it is available only while this computer and the local server are running.


## Customer review update: preserve the current website

The local root now serves a separately generated copy of the actual existing homepage, hero, menu, meal builder, fonts, imagery and wording. It adds only the top One-time order / Weekly plan switch and relevant weekly-plan information. One-time is selected by default; the weekly button displays 5% off plus the first-paid-delivery free small meal before selection. Selecting weekly reveals pause/holiday/change/cancel terms and the actual published sample cutoff. The cart is shared between modes; one-time prices/sauce charges return when switching back. Weekly mode shows the 5% breakdown and free sauces and continues to local signup with grouped meal preferences. Only non-personal meal choices persist across the email link in another tab.

`NEXT_PUBLIC_WEEKLY_SANDBOX=true` is enabled only by `npm run build:weekly`, which builds and copies a local artifact under `.local-previews/weekly-stage2/site`. Normal builds do not show the selector and are covered by regression assertions. Nothing was deployed. Regenerate the artifact after relevant UI changes. The local server serves the compiled website fonts/styles to the signup/management screens as well; the earlier green visual design was replaced with the current burgundy/gold/Anton/Inter palette.

The local one-time guest flow uses the unchanged order-builder behavior, with mock address checking and checkout handoff that ends in an explicit no-payment preview. The existing email-updates form also points to a local mock endpoint. These service mocks prevent real payments, messages or external mailing-list writes during review. They do not change live one-time checkout.

Verification: 159 tests passed, normal/local builds, TypeScript and lint passed. Browser checks compared the live site's fonts/colors with the local artifact, verified default mode, visible pre-click benefits, cart/price restoration across mode switches, guest checkout to the mock handoff, cross-tab signup draft preservation, the full management flow, and desktop/mobile layouts. Published cutoff dates drive the weekly copy; no fixed Friday/Saturday promise is embedded in subscription text.

## Welcome-meal and old-link correction

The main weekly cart now separates its first small meal as the provisional $0 first-delivery welcome gift. It is excluded from paid minimums, paid tier counts and the recurring default cart; additional small meals are paid normally. Signup rechecks eligibility through the verified customer's ledger. A restored draft preserves the explicitly selected gift. Switching to one-time makes all selected meals ordinarily paid again. Anonymous gift displays remain conditional on verified eligibility, never authority to grant the benefit.

The old `/weekly-plan` address redirects without caching to the current website with weekly mode selected. Actual signup now uses `/weekly-signup` and shows existing paid selections rather than another meal builder; edits return to the same website builder with the draft restored. The retired localhost:3011 Stage 1 preview redirects to the current localhost:3012 site. Versioned local signup assets prevent reuse of the earlier script/styles.

Verification: 161 tests passed, plus browser checks of one free small meal, additional paid small meals, the three-paid-meal minimum, ordinary one-time price restoration, both retired URLs, cross-tab signup, edit-back restoration, and the persisted paid-cart/welcome distinction. All services remained local and mocked. Current review URL: http://localhost:3012/?review=welcome-v3.

## Star bullets and sauce-price correction

The weekly explainer uses six small gold star bullets matching the existing palette. Regular paid-meal sauce surcharges are retained in the main builder, signup, management, trusted quotes, and catalog. Only the welcome meal's sauce is included. The 5% discount is calculated on paid meal prices; sauce charges remain full price. The authorization version is `weekly-stage2-v2`, and local draft terms reflect this correction.

Verification: 161 tests passed. Browser checks built a one-time cart with three Big Chicken meals and a Little Beef, all BBQ ($43 before tax), switched to weekly (three paid meals + free small gift, $31.50 before tax: $30 meals minus $1.50 discount plus $3 sauce), switched back ($43), then continued weekly signup with those selections preserved. Paid sauce dialogs display +$1; the gift dialog displays Included. Desktop and mobile star-bullet layouts passed inspection. No production change or real charge occurred.
