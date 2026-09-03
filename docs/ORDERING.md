# ThreeByrd ordering guide

## Current release state

Ordering is intentionally closed while the founders finalize pricing. The shared `ORDERS_OPEN = false` value in `app/order-config.ts` drives the disabled quantity controls, closed summary panel, and server-side checkout guard. This branding/content update did not configure, connect, test, or otherwise change Stripe objects, credentials, webhooks, or environment variables.

## What changed

The old fixed weekly-plan selector was replaced with a one-time, mix-and-match order builder. Customers can choose Little Chicken, Big Chicken, or Big Beef; Little Beef is displayed as Coming soon and cannot be purchased. The homepage now makes Chicken/Beef choice and Saturday delivery the primary story.

Important implementation files are `app/order-config.ts`, `app/components/OrderBuilder.tsx`, `app/components/Countdown.tsx`, `app/api/checkout/route.ts`, `app/api/webhooks/stripe/route.ts`, `app/success/page.tsx`, `db/schema.ts`, and `drizzle/0000_parched_sunfire.sql`.

## Product and pricing rules

Prices are integer cents in `app/order-config.ts`. Each SKU earns its discount independently once that SKU reaches quantity five:

| Product | 1–4 each | 5+ each |
| --- | ---: | ---: |
| Little Chicken | $8 | $6 |
| Big Chicken | $10 | $9 |
| Big Beef | $12 | $10 |
| Little Beef | Coming soon | Coming soon |

The server reconstructs a quote from product IDs and quantities. It does not accept a client-provided price, discount, subtotal, or total. Every order needs at least three total purchasable boxes, and the boxes may be mixed across SKUs.

To change prices, update `regularUnitAmountCents` and `discountedUnitAmountCents` for the relevant product in `app/order-config.ts`, then run the pricing tests and build. Do not duplicate prices in the UI or Stripe Dashboard: Checkout receives server-generated `price_data` for each current cart line.

To enable Little Beef later, add its regular and discounted cent values and change `purchasable` to `true` in the same product record. Confirm its nutrition and allergen copy before doing so, then rerun the complete test suite.

## Friday cutoff and Saturday delivery

The default first-launch cutoff is centrally defined as `2026-09-11T15:00:00` in `app/order-config.ts`. This is a business-local wall time in `America/New_York`, not a visitor-local timestamp. `getNextOrderCutoff()` uses that initial override while it is still in the future; afterward it rolls forward to the next Friday at 3:00 PM Eastern. The conversion uses `Intl.DateTimeFormat` and handles daylight-saving changes.

For a special week, configure `THREEBYRD_CUTOFF_OVERRIDE` to one business-local value such as `2026-09-18T15:00:00`. Change it in the local environment and in the Sites environment configuration before deploying. Do not scatter dates through React components.

After a cutoff passes, the UI never shows a negative timer and the server rejects stale Checkout attempts. The next page load/cycle uses the next Friday cutoff and describes Saturday as the next cook/delivery date. The site does not promise a particular delivery time, and it does not offer pickup.

## Stripe architecture

The integration follows the Stripe-hosted Checkout Sessions pattern:

1. The browser sends only product IDs and quantities to `POST /api/checkout`.
2. The server validates the catalog, per-SKU discount rules, 3-box minimum, and current cutoff.
3. The server creates a one-time Checkout Session with dynamic line `price_data`, collects a US delivery address and phone number, and redirects the customer to Stripe.
4. Stripe redirects to `/success` or `/order?checkout=canceled`.
5. `POST /api/webhooks/stripe` verifies the Stripe signature, listens for `checkout.session.completed`, and records the confirmed order in D1.
6. The D1 unique constraint on `stripe_session_id` makes repeated webhook delivery idempotent.

The checkout uses Stripe’s dynamic payment-method behavior; cards and eligible Apple Pay/Google Pay methods are handled by Stripe-hosted Checkout. No raw card data is handled by ThreeByrd. Automatic tax is not enabled yet because the company’s registrations and product tax classification have not been established; have a tax adviser confirm those inputs before enabling it.

No Stripe Products, Prices, Billing subscriptions, Invoices, or live payment objects were created by this code change. This flexible cart intentionally does not create a separate Stripe object for every quantity tier.

## Required environment variables

Local `.env.local`:

```text
STRIPE_SECRET_KEY=<Stripe test secret>
STRIPE_WEBHOOK_SECRET=<Stripe webhook signing secret>
NEXT_PUBLIC_SITE_URL=http://localhost:3000
THREEBYRD_CUTOFF_OVERRIDE=2026-09-11T15:00:00
```

Set the same non-secret site URL and cutoff override in the Sites environment configuration. Store `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` as hosted secrets, not in Git, `.env` files, browser code, or logs. Use separate test and live credentials, preferably least-privilege restricted keys, and rotate them if access changes.

The D1 binding is declared logically as `DB` in `.openai/hosting.json`. Apply the generated migration through the Sites/D1 deployment flow; do not assume a local unbound Worker has a persistent database.

## Local Stripe testing

Install and authenticate the Stripe CLI separately, then forward test events:

```bash
stripe listen --forward-to localhost:3000/api/webhooks/stripe
```

Put the CLI-provided webhook signing secret in `STRIPE_WEBHOOK_SECRET`, restart the dev server, and use test-mode Checkout with Stripe’s official test payment details. Test one/two boxes (blocked), three mixed boxes (allowed), each pricing threshold, Little Beef (blocked), canceled Checkout, one successful Checkout, and replayed `checkout.session.completed` delivery. A successful webhook needs a real D1 binding to persist the order; without it, the endpoint intentionally returns a retryable error rather than claiming the order was saved.

## Viewing and refunding orders

Confirmed records are stored in the D1 `orders` table with the Stripe session ID, payment intent ID, selected items, customer delivery details, amount, currency, cutoff, and confirmation timestamp. View them through the Sites database/D1 tooling or the Cloudflare D1 console. Stripe Dashboard → Payments remains the source for payment status and reconciliation.

Refunds should be initiated from Stripe Dashboard → Payments for the matching payment, or through the Stripe API after confirming the order/session ID. A refund workflow/UI is not exposed to customers by this site, and no custom refund endpoint was added.

## Billing and Invoicing foundation

The live UX is one-time Checkout only. Billing is intentionally left as a future extension: a later “make this recurring” choice should create a Stripe Billing subscription through a `mode: subscription` Checkout Session and should use the Customer Portal for changes/cancellation. No subscription objects or renewal loops exist today.

Invoicing is also intentionally outside student checkout. For future fraternity, club, campus-organization, or catering customers, create invoices through Stripe Invoicing or the Dashboard after deciding customer/payment terms. No invoice objects or B2B UI were created here.

## What ThreeByrd still needs to do

1. Create/configure the Stripe account in test mode and verify the business, payout, and delivery details.
2. Create a test restricted key with only the permissions needed for Checkout Session creation and Session retrieval, or use a test secret key while validating the integration.
3. Add `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, and `NEXT_PUBLIC_SITE_URL` to local and hosted environments.
4. Register `https://threebyrd.com/api/webhooks/stripe` (or the approved production origin) for `checkout.session.completed` events and confirm the endpoint can reach the D1 binding.
5. Decide tax registrations, product tax classification, and whether to enable Stripe Tax with a tax adviser; do not enable it by assumption.
6. Run the test-mode cases, inspect one confirmed D1 record, reconcile it to Stripe, and test a refund.
7. Only after test validation, review Stripe’s go-live checklist, provision separate live credentials/secrets, re-create any required tax registrations in live mode, and approve the feature branch for merge.

## Deployment

The app remains a Vinext/Cloudflare Worker project. After the feature branch is reviewed and explicitly approved for merge, the normal main-branch deployment automation can publish it. Do not merge or push this branch to `main` without approval.
