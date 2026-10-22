# Weekly plan release preparation

As of October 21, 2026, the weekly plan is deployed only to the isolated hosted staging Worker. Live weekly billing and customer email distribution remain disabled. The existing production one-time checkout is unchanged.

## Verified lifecycle

An operator-only script, `scripts/weekly-sandbox/review-launch-cycle.mjs`, exercises actual Stripe TEST APIs using a separate copied database and an explicitly advanced clock. It preserves the original first purchase, uses a distinct fixture plan identity to avoid payment-idempotency collisions with earlier exercises, and never copies fixtures to production.

- November 6 cutoff: actual recurring card decline; no kitchen order, no blind retry.
- November 7: actual successful off-session SetupIntent verified against Stripe and the same customer; explicitly recorded as operator verification, not a browser Checkout webhook test. The declined PaymentIntent was canceled and that unpaid week explicitly skipped.
- November 14 delivery skipped by the customer: no payment job.
- November 21 and 28 holiday closures: no payment jobs.
- December 4 cutoff: one successful renewal for December 5, three paid BBQ chicken meals, no repeated welcome gift. $33 less $1.50 weekly discount plus $2.52 test tax = $34.02.
- Staging Orders row 26 verified by copying A26:W26 from Google Sheets: three physical meals, actual PaymentIntent, correct delivery date and paid totals. Repeating export did not append a duplicate.

Provider behavior discovered and fixed: Stripe clears `payment_method` on some definitive card declines. Reconciliation now verifies the exact attempted method from `last_payment_error.payment_method.id` only when status is `requires_payment_method` and the primary method is null. Other ownership, metadata, amount and environment checks remain mandatory. A mismatched error method is rejected. The original uncertain result was explicitly reconciled; no declined charge was retried.

Local evidence is ignored, not shipped as site assets: `.local-previews/weekly-stage3/launch-cycle-report.json`, `launch-cycle-review.sqlite`. Sheet screenshot: `/tmp/threebyrd-launch-renewal-row.png`. These are advanced-clock tests, not observation of a real calendar deadline firing on the hosted scheduler.

## Concrete production preparation

`config/weekly-production-plan.json` records the agreed calendar, sender/reply-to, operator identity, recovery rules, secret binding names, empty-production-storage policy, disabled billing/email defaults and explicit incomplete rollout capabilities. Run `node scripts/weekly-sandbox/launch-readiness.mjs` for a read-only launch status. No credentials are stored in that file.

The current runtime and sheet adapter intentionally reject live payments. Do not replace test keys with live keys or remove those checks to launch. Remaining implementation:

1. Production payment/storage adapters and a fresh production subscription namespace. Require fresh customer authorization; never migrate test customers, methods or authorizations.
2. Upgrade the production Sheets receiver for recurring PaymentIntent references and revision upserts, preserving one-time orders, kitchen status and existing formulas. Current permission is deliberately limited to the exact staging workbook.
3. Install a separate signed live webhook and production sender binding, with delivery/failure monitoring and verified rollback. Keep the recurring scheduler disabled during that rehearsal.
4. Verify live destination identifiers and rollout configuration, then publish the existing reviewed frontend through the normal release process. Enable billing only after the production rehearsal passes.

The delivery-area integration reads the existing production checker. Capacity remains disabled today; if enabled later, weekly payments stop until they can reserve against the same atomic capacity authority. Reading availability alone cannot guarantee capacity.

No additional business information is needed for this preparation. Production work remains technical, not a request for the owner to reconfirm the same preferences.

Hosted monitoring check also completed through the private dashboard: owner test email, scheduled test billing, and staging sheet sync each reported OK at 7:01 PM Eastern. This verifies the hosted alarm handler ran; no billing deadline was due at that time. Dashboard screenshot: `/tmp/threebyrd-weekly-monitoring-verified.png`. Final validation: 106 subscription/Google Sheets tests pass, targeted lint passes, TypeScript passes.
