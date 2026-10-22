> Current pricing correction: paid meals retain regular sauce charges ($1 for BBQ/RedHot); only the free welcome meal includes its sauce. The 5% discount applies to meal prices, excluding sauce charges. This supersedes earlier free-sauce wording below.

# Weekly meal plan — Stage 1

Implemented locally only. No subscription enrollment, Stripe calls, customer email/SMS, production migrations, production deployments, or existing checkout changes. Nothing here authorizes or schedules payments. Example closures are not business decisions.

## Preview

Run `npm run preview:weekly` with the project runtime (Node 22.13+ supporting TypeScript stripping; Node 24 recommended). Open `.local-previews/weekly-plan/index.html` in a browser. It is a self-contained local HTML file with a scenario selector, no external dependencies or requests, and a restrictive content security policy. Regenerate after changing fixtures.

The report includes a first delivery, returning subscriber, this-week-only edit, skip, timed/indefinite pause, cancellation, exact-cutoff signup, holiday closure, unavailable welcome meal, below-minimum cart, and exhausted publication horizon. Expand each cycle to inspect dates, cutoff/charge time, meal/sauce lines, 5% discount, before-tax subtotal, and separate paid/free/physical counts. Future welcome lines are conditional projections, never redemption records. If a payment fails, recompute using the still-unredeemed ledger.

Use `npm run test:weekly` for the focused domain suite. The normal test command includes it too.

## Existing system and compatibility

- `app/order-config.ts` owns catalog, sauces, validation, and quantity tiers: 3–4, 5–9, and 10+ paid meals. One-time sauces currently cost $1 for BBQ and RedHot. One-time quantities remain capped at 99 per product and require 3 meals.
- The existing checkout creates a Stripe Customer with the validated delivery address, then a one-time Stripe-hosted payment session with automatic tax. Its signed payment webhook reconciles paid totals, records a D1 order, and queues the spreadsheet export. It records separate order/promotional SMS consent.
- The ordinary cutoff is Friday at 3 PM America/New_York, with an existing configured override; delivery is derived as the next day. Stage 1 does not alter this code, override, or any live dates.
- Capacity is currently uncapped, with atomic reservation support available for future caps. A free subscription box must consume physical capacity in the future integration, but must not affect paid quantity pricing.
- The Worker cron currently handles capacity cleanup and spreadsheet retries, not subscription billing or customer messages. GitHub main pushes deploy the frontend; the Worker is deployed separately.
- No authenticated subscriber/admin management infrastructure exists. Stage 1 deliberately adds no HTTP endpoints, public admin pages, or writable APIs.
- `docs/ORDERING.md` previously suggested a conventional Stripe Billing subscription as a possible future extension. That was not an implemented requirement; the new comparison below addresses the more specific skip/holiday requirements.

## Files and responsibilities

- `app/subscriptions/quote.ts`: reuses `quoteOrder` for paid-cart validation, product grouping and quantity-tier unit prices, then builds a separate weekly quote. Existing one-time pricing is never modified. All available weekly sauces are free, including adding sauce to a previously plain meal. This is the Stage 1 interpretation of free sauce swaps and needs margin review before launch.
- `app/subscriptions/calendar.ts`: validates explicit offset-bearing cutoff/charge timestamps and valid weekend delivery dates; enforces stable unique cycle IDs, permanent sequence order, chronological dates, and charge-at-cutoff. `rescheduleCycle` refuses locked cycles.
- `app/subscriptions/plan.ts`: pure plan model, cycle decisions, one-week/permanent edits, skip/unskip, timed/indefinite pause, resume, cancellation, and customer-scoped welcome audit projection. No persistence is implied by these pure functions.
- `app/subscriptions/preview-config.ts`: developer-controlled sample calendar and fictional plan/scenarios. This is not a published operational calendar and is not imported by the Worker or website routes.
- `scripts/preview-weekly-plan.mjs`: standalone internal report generator. Output is ignored by Git and outside `public/` and deployable assets.

## Pricing and offer semantics

The weekly quote uses the paid meal count to select the existing tier, removes sauce surcharges for subscribers, applies 5% to the complete paid meal subtotal, and rounds once to nearest cent, with half cents rounded up. Example: five Big Chicken meals cost $45 before discount, $2.25 discount, $42.75 before tax. A first-time eligible customer gets one selected Little Chicken or Little Beef, with any available sauce, in addition: five paid meals, one free, six physical meals.

No promotion-code or stackable discount parameter exists in the weekly quote. A future request boundary must reject promotion stacking; it must load catalog/inventory and eligibility from trusted storage and never trust client amount, discount, free-box, identity, or redemption flags. These pure TypeScript APIs are not a substitute for runtime request validation or authorization.

Quotes intentionally return `taxStatus: not_calculated` and no grand total. The free line is shown as $0 in the preview only, not as a final tax determination. Future Stripe line-level discount allocation must reconcile exactly to the whole-subtotal rounding rule and verified tax treatment.

Welcome eligibility belongs to a verified internal customer ID, not email input, Stripe Customer ID, or plan ID. `recordWelcomeRedemption` models successful paid weekly orders containing the box, ignores failed payments/one-time orders, and preserves existing redemptions on duplicate/rejoined/refund events. It is NOT a concurrent payment processor: Stage 3 needs atomic storage uniqueness, a pending entitlement reservation, and reconciliation before late retries, so two overlapping orders cannot both be promised a box. Retain an immutable audit history for refunds and explicit support corrections.

## Calendar and state semantics

Sample cycles carry permanent `id` and `sequence`, actual `deliveryDate`, cutoff and identical proposed charge instant, open/closed status, and optional reason. Use explicit UTC offsets; Friday 3 PM is 19:00 UTC before autumn DST and 20:00 UTC afterward. This avoids guessing ambiguous wall times. Custom cutoffs require an operator to supply and verify the intended instant. Date validation uses America/New_York.

The calendar passed to domain functions must include all published history referenced by plan skips, overrides, and return cycles. Never recycle an ID, renumber a cycle, or prune referenced history. Rescheduling changes the same cycle's date and retains skips/overrides. The rescheduling guard must receive committed IDs from trusted storage; direct config changes are not a production locking mechanism. Rescheduling beyond neighboring cycles fails validation and requires a deliberate calendar redesign rather than silently reordering identity.

Cutoff is closed at the exact instant: now >= cutoff means no new enrollment/edit/skip for that cycle. New signups use the next published eligible open cycle. No future cycle means no enrollment date is invented. Business closures have no quote/order/charge proposal. Paused plans with a return cycle resume at that cycle if open, otherwise the next open cycle; customer-specific skips still apply.

A missing/invalid welcome selection blocks the first eligible order instead of silently substituting. Invalid paid carts also block; the preview does not disguise an invalid upcoming order by advertising a later valid one.

“One delivery only” stores a cycle override. “This and future” changes defaults starting with the first still-editable, unskipped open cycle at or after a scheduled return and explicitly replaces overrides from that cycle onward. Starting a permanent edit at a more distant cycle is rejected in this initial model to avoid rewriting intervening previews. Stage 2 must explain this replacement behavior before saving. Versioned defaults can extend it later if needed.

Plan cancellation/pause functions affect future previews only. Paid orders are not represented or rewritten by these previews. Future persistence must store immutable committed order snapshots and effective state changes; post-cutoff support actions must operate on those separately. Canceling a plan does not issue a refund, cancel a payment intent, or delete a paid order. Rejoining requires new enrollment but reuses the verified identity and welcome ledger.

## Recommended payment architecture for Stages 2/3

Recommendation: keep the business calendar and weekly order state in D1, and use Stripe for secure saved-card setup and individual scheduled-cycle payments. Choose this for calendar/meal flexibility, not because Stripe Billing lacks pause features.

| Option | Strengths | Work and risks for this product |
| --- | --- | --- |
| Stripe Billing subscriptions | Managed recurring invoicing, recovery, and subscription lifecycle; weekly billing anchors; newer pause/resume capabilities | Still requires our delivery calendar, overrides, welcome entitlement and kitchen records. Must reconcile holidays, variable carts, tier prices, DST, cutoff edits, and one-time free lines with invoice generation. Prorations/default schedules must not accidentally bill closed weeks. Validate API version and SDK compatibility for newer pause behavior. |
| Calendar-driven weekly orders + Stripe saved-method payments | One business cycle is one order/payment; natural skips, holiday closures, variable carts and delivery rescheduling | We must build durable scheduling, tax calculation, failure recovery/authentication, notices, webhook reconciliation, locking and idempotency. Saving a card does not guarantee future payments succeed. More operational responsibility. |

Stage 2 can use Stripe-hosted setup-mode Checkout/SetupIntents with explicit off-session consent and a verified customer mapping; no charge at signup. Stage 3 should atomically reserve a cycle order and welcome entitlement before payment, revalidate inventory/address and calculate tax, use stable idempotency keys, reconcile signed events, and only then enqueue physical fulfillment. Persist a domain order before payment for recovery, but do not expose it as a confirmed kitchen order. Do not assume the current checkout-session-only webhook/export schema can accept these payments unchanged.

Official Stripe sources reviewed October 21, 2026:
- https://docs.stripe.com/api/setup_intents/create — saving methods and permissions for later payment, including off-session usage.
- https://docs.stripe.com/payments/checkout/save-and-reuse — setup without a payment using Checkout.
- https://docs.stripe.com/billing/subscriptions/billing-cycle — weekly anchors and UTC-based configuration.
- https://docs.stripe.com/billing/subscriptions/pause-payment — pausing collection still generates invoices, unlike stopping the business's delivery cycles.
- https://docs.stripe.com/billing/subscriptions/pause — newer full pause capabilities, flexible billing and API compatibility requirements.

No Stripe API integration or credential access was performed in Stage 1.

## Decisions before later stages launch

1. Approve free sauces for all subscriber paid meals in addition to the welcome meal, and verify 5% plus the box against margins at each tier.
2. Decide payment-failure recovery cutoff relative to kitchen preparation, retries, late success, refunds, and exhausted recovery. Avoid overlapping first-week welcome reservations.
3. Confirm New York tax treatment of discounted meals, waived sauce charges, and the complimentary box. Verify final tax integration, line discount allocation and receipts using test mode.
4. Choose how far ahead cycles must be published and when reminders go out. Example fixtures do not authorize a Thanksgiving closure. Confirm real holiday dates and customer-notice procedures.
5. Confirm treatment of a paid order when a plan is canceled or a delivery is moved after cutoff; define support corrections and notice rules.
6. Choose/configure the transactional email service and sender domain. Existing email-list signup is not an authentication/delivery email provider.
7. Approve handling and notice for future catalog/price changes and unavailable meals; no silent meal substitutions.
8. Verify production/staging Stripe API versions, required permissions and tax settings before any billing implementation.

## Persistence, migration and rollback

Stage 1 adds no schema and requires no database migrations. It stores no customer data and exposes no production routes. Rollback consists of removing the new subscription modules, preview generator/test, package script additions, and ignored report directory. Existing checkout remains independent.

Stage 2 should propose additive tables for verified customers, mapped Stripe IDs per environment, hashed one-use email tokens, plans/defaults/overrides/skips, cycles and revisions, authorization evidence, and customer-scoped welcome audit/reservations. Stage 3 adds cycle-order snapshots, payment attempts, deduplicated webhook events and notification/fulfillment outboxes. Enforce uniqueness per plan/cycle and welcome customer plus a policy for multiple simultaneous plans. No automatic legacy-customer merging or historical backfill.

Keep test/live identities, tokens, payment methods, events, and databases isolated. Apply migrations locally/staging first and prepare rollback that disables enrollment/charging without deleting paid orders, authorization evidence, or redemption history. A production feature flag is necessary later, but not a reason to deploy or enable billing now.

See `WEEKLY_PLAN_STAGE2_PROMPT.md` for the next implementation task.

## Verification completed October 21, 2026

- Full regression suite: 145 tests passed (24 new weekly-plan tests plus 121 existing tests).
- TypeScript check passed.
- Repository lint passed; focused lint passed again after the final domain adjustment.
- Existing Vinext production build passed locally. No subscription route was added to its route list.
- Browser verification: all 12 standalone preview scenarios passed at 1280px and 390px widths, with one visible scenario at a time, no horizontal overflow, correct holiday-return/blocked-selection messages, and no HTTP requests from the report. Desktop and mobile screenshots were visually inspected.
- No existing public route, checkout handler, tax integration, Worker schedule, database schema, order export, or deployment configuration was changed. No production push/deployment or remote database command was run for this stage.

Local preview server for this review: http://127.0.0.1:3011/ (only available while the local server runs). The saved HTML remains available after that server stops and can be regenerated with `npm run preview:weekly`.
