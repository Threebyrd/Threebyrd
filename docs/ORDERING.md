# ThreeByrd ordering guide

## Current release state

Ordering is intentionally closed until the owners explicitly approve opening it. The shared `ORDERS_OPEN = false` value in `app/order-config.ts` drives the disabled quantity controls, closed summary panel, and server-side checkout guard. The live Checkout and webhook path has been verified, but public ordering is not enabled.

## What changed

The old fixed weekly-plan selector was replaced with a one-time, mix-and-match order builder. Customers can choose Little Chicken, Big Chicken, or Big Beef; Little Beef is displayed as Coming soon and cannot be purchased. The homepage now makes Chicken/Beef choice and Saturday delivery the primary story.

Important implementation files are `app/order-config.ts`, `app/components/OrderBuilder.tsx`, `app/components/Countdown.tsx`, `app/api/checkout/route.ts`, `app/api/cors.ts`, `app/api/webhooks/stripe/route.ts`, `app/success/page.tsx`, `db/schema.ts`, and `drizzle/0001_groovy_avengers.sql`.

## Product and pricing rules

Prices are integer cents in the canonical pricing table in `app/order-config.ts`. The entire cart selects one tier before any line item is priced:

| Product | 3–4 meals | 5–9 meals | 10–19 meals | 20+ meals |
| --- | ---: | ---: | ---: | ---: |
| Little Chicken | $8.00 | $7.50 | $7.00 | $6.50 |
| Big Chicken | $10.00 | $9.00 | $8.50 | $8.00 |
| Big Beef | $11.00 | $10.00 | $9.50 | $9.00 |
| Little Beef | Coming soon | Coming soon | Coming soon | Coming soon |

The server reconstructs a quote from product IDs and quantities. It does not accept a client-provided price, discount, subtotal, or total. Every order needs at least three total purchasable boxes, and the boxes may be mixed across SKUs. Little Beef has prices in the canonical matrix for future use but remains unavailable because its product record is still marked `purchasable: false`.

To change prices, update the single matrix in `app/order-config.ts`, then run the pricing tests and build. Do not duplicate prices in the UI or Stripe Dashboard: Checkout receives server-generated `price_data` for each current cart line.

To enable Little Beef later, change `purchasable` to `true` in its product record after confirming its nutrition and allergen copy. Its prices already exist in the canonical matrix; do not add a separate price table. Rerun the complete test suite before enabling it.

## Friday cutoff and Saturday delivery

The default first-launch cutoff is centrally defined as `2026-09-11T15:00:00` in `app/order-config.ts`. This is a business-local wall time in `America/New_York`, not a visitor-local timestamp. `getNextOrderCutoff()` uses that initial override while it is still in the future; afterward it rolls forward to the next Friday at 3:00 PM Eastern. The conversion uses `Intl.DateTimeFormat` and handles daylight-saving changes.

For a special week, configure `THREEBYRD_CUTOFF_OVERRIDE` to one business-local value such as `2026-09-18T15:00:00`. Change it in the local environment and in the Sites environment configuration before deploying. Do not scatter dates through React components.

After a cutoff passes, the UI never shows a negative timer and the server rejects stale Checkout attempts. The next page load/cycle uses the next Friday cutoff and describes Saturday as the next cook/delivery date. The site does not promise a particular delivery time, and it does not offer pickup.

## Stripe architecture

The integration follows the Stripe-hosted Checkout Sessions pattern:

1. The browser sends only product IDs and quantities to `POST https://api.threebyrd.com/api/checkout` in production; local development uses the local API unless `NEXT_PUBLIC_CHECKOUT_API_ORIGIN` is set.
2. The server validates the catalog, cart-wide pricing tier, 3-box minimum, and current cutoff.
3. The server recalculates the cart-wide tier and creates a one-time Checkout Session with dynamic line `price_data`, collects email, a US delivery address, and phone number, and redirects the customer to Stripe.
4. Stripe redirects to `/success` or `/order?checkout=canceled`.
5. `POST /api/webhooks/stripe` verifies the Stripe signature, handles completed and asynchronous successful Checkout events, reconciles the verified session against the canonical quote, and records the confirmed order in D1.
6. The D1 unique constraint on `stripe_session_id` makes repeated webhook delivery idempotent. The success page never fulfills an order.

The checkout uses Stripe’s dynamic payment-method behavior; cards and eligible Apple Pay/Google Pay methods are handled by Stripe-hosted Checkout. No raw card data is handled by ThreeByrd. Automatic tax is not enabled yet because the company’s registrations and product tax classification have not been established; have a tax adviser confirm those inputs before enabling it.

No Stripe Products, Prices, Billing subscriptions, or Invoices are created by this code. The flexible cart intentionally does not create a separate Stripe object for every quantity tier. A single controlled live verification payment was processed and refunded separately; its D1 order row remains as an audit record.

## Environment separation

ThreeByrd uses separate Cloudflare Workers and D1 databases for the two Stripe modes:

| Environment | Worker | Stripe mode | Stripe webhook | D1 |
| --- | --- | --- | --- | --- |
| Local | `vinext dev` | `test` | local CLI secret | local D1 persistence |
| Staging | `threebyrd-website-staging` on `workers.dev` | `test` | sandbox endpoint at `/api/webhooks/stripe` | `threebyrd-orders-staging` |
| Production | `threebyrd-website` at `api.threebyrd.com` | `live` (verified; ordering closed) | live endpoint at `/api/webhooks/stripe` | `threebyrd-orders` |

`STRIPE_MODE` is not a secret. The server only constructs a Stripe client when the configured key prefix matches the mode (`sk_test_`/`rk_test_` for test and `sk_live_`/`rk_live_` for live). The webhook handler also requires Stripe’s signed event `livemode` value to match. Signing secrets do not identify their mode by prefix, so they must remain separate per Worker and per Stripe webhook endpoint.

The staging environment has no `api.threebyrd.com` route and allows only controlled local origins by default. The production Worker keeps the existing custom domain, production D1 binding, live secrets, and `ORDERS_OPEN = false` until public launch is approved.

## Required environment variables

Local `.env.local`:

```text
STRIPE_SECRET_KEY=<Stripe test secret>
STRIPE_WEBHOOK_SECRET=<Stripe webhook signing secret>
STRIPE_MODE=test
NEXT_PUBLIC_SITE_URL=http://localhost:3000
NEXT_PUBLIC_CHECKOUT_API_ORIGIN=
CORS_ALLOWED_ORIGINS=http://localhost:3000,http://127.0.0.1:3000
THREEBYRD_CUTOFF_OVERRIDE=2026-09-11T15:00:00
```

For staging, set `STRIPE_MODE=test`, use the staging sandbox secrets, use the staging D1 binding, and allow only local or an explicitly approved staging frontend origin. For production at launch, set `STRIPE_MODE=live`, use the live secrets, keep `NEXT_PUBLIC_SITE_URL=https://threebyrd.com`, and keep `CORS_ALLOWED_ORIGINS=https://threebyrd.com`. Set `NEXT_PUBLIC_CHECKOUT_API_ORIGIN=https://api.threebyrd.com` in the GitHub Pages build environment. Store both Stripe values as hosted secrets, not in Git, `.env` files, browser code, or logs. Use separate least-privilege restricted keys for test and live.

The D1 binding is declared logically as `DB` in `.openai/hosting.json`. Apply the generated migration through the Sites/D1 deployment flow; do not assume a local unbound Worker has a persistent database.

## Local Stripe testing

Install and authenticate the Stripe CLI separately, then forward test events:

```bash
stripe listen --forward-to localhost:3000/api/webhooks/stripe
```

Put the CLI-provided webhook signing secret in `STRIPE_WEBHOOK_SECRET`, restart the dev server, and use test-mode Checkout with Stripe’s official test payment details. Test 2 meals (blocked), 3, 4, 5, 9, 10, 19, 20, and 21 meals, mixed products (including the 3 Big Chicken + 2 Big Beef = $47 example), Little Beef and invalid SKUs (blocked), zero/negative/fractional quantities, canceled Checkout, frontend price manipulation, one successful Checkout, both successful webhook event types, failed asynchronous payment, and replayed delivery. A successful webhook needs a real D1 binding to persist the order; without it, the endpoint intentionally returns a retryable error rather than claiming the order was saved.

Staging sandbox webhooks must use the signing secret for the Stripe test-mode endpoint. Never put the production live webhook secret in local or staging files, and never use a Stripe CLI forwarding secret for a registered production endpoint.

## Viewing and refunding orders

Confirmed records are stored in the D1 `orders` table with the Stripe session ID, payment intent ID, selected items, customer delivery details, amount, currency, cutoff, and confirmation timestamp. View them through the Sites database/D1 tooling or the Cloudflare D1 console. Stripe Dashboard → Payments remains the source for payment status and reconciliation.

Refunds should be initiated from Stripe Dashboard → Payments for the matching payment, or through the Stripe API after confirming the order/session ID. A refund workflow/UI is not exposed to customers by this site, and no custom refund endpoint was added.

## Billing and Invoicing foundation

The live UX is one-time Checkout only. Billing is intentionally left as a future extension: a later “make this recurring” choice should create a Stripe Billing subscription through a `mode: subscription` Checkout Session and should use the Customer Portal for changes/cancellation. No subscription objects or renewal loops exist today.

Invoicing is also intentionally outside student checkout. For future fraternity, club, campus-organization, or catering customers, create invoices through Stripe Invoicing or the Dashboard after deciding customer/payment terms. No invoice objects or B2B UI were created here.

## What ThreeByrd still needs to do

1. Keep production `ORDERS_OPEN = false` until the owners approve launch.
2. Keep staging isolated with `STRIPE_MODE=test`, its sandbox secrets, and its separate D1 database.
3. Decide tax registrations, product tax classification, and whether to enable Stripe Tax with a tax adviser; do not enable it by assumption.
4. Review the live-account operational checklist, including receipts, statement descriptor, fulfillment, and refund handling.
5. Publish and verify the complete frontend/API synchronization before opening orders.
6. When launch is approved, change `ORDERS_OPEN` to `true`, deploy the Worker, and verify the first real order through the live webhook and D1.

## Cloudflare configuration before public API access

The following must be completed manually before `api.threebyrd.com` is made public:

1. In Cloudflare Workers & Pages, deploy the server-backed Vinext build to the existing Threebyrd Sites/Worker project and keep the logical D1 binding named `DB` attached to the existing `orders` database. Do not deploy the static GitHub Pages artifact as the API runtime.
2. Add `api.threebyrd.com` as a custom domain for that Worker. If Cloudflare requests DNS configuration instead, create only the `api` DNS record pointing to the exact target Cloudflare provides, with proxying enabled if Cloudflare marks it required. Do not change the root `threebyrd.com` record or GitHub Pages custom-domain configuration.
3. Wait for the Cloudflare-managed certificate to become active and verify `https://api.threebyrd.com/` reaches the Worker. Verify `POST /api/checkout` still returns the closed-order response while `ORDERS_OPEN = false`.
4. Production currently has these API runtime values:
   - Secret `STRIPE_SECRET_KEY` containing the verified live restricted key
   - Secret `STRIPE_WEBHOOK_SECRET` for the registered live endpoint
   - Variable `STRIPE_MODE=live`
   - Variable `NEXT_PUBLIC_SITE_URL=https://threebyrd.com`
   - Variable `CORS_ALLOWED_ORIGINS=https://threebyrd.com`
5. The staging Worker must have its own `DB`, `ASSETS`, `STRIPE_MODE=test`, sandbox secrets, and controlled CORS values. It must not inherit or use the production custom-domain route.
6. The GitHub Actions Pages build uses `NEXT_PUBLIC_CHECKOUT_API_ORIGIN=https://api.threebyrd.com`; the root domain remains on GitHub Pages.
7. The registered live webhook belongs to production. The staging Worker uses a separate test-mode webhook endpoint and signing secret.
8. Before opening orders, verify CORS, success/cancel URLs, one D1 row per paid session, replay idempotency, and matching Stripe key/event modes.

## Deployment

The app remains a Vinext/Cloudflare Worker project. After the verified implementation is committed to `main`, the normal main-branch deployment automation publishes the static frontend. Keep the Worker deployed separately through Wrangler and keep `ORDERS_OPEN=false` until launch approval.
