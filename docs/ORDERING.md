# ThreeByrd ordering guide

## Current release state

Production ordering is open. The production Wrangler variable `ORDERS_OPEN=true` enables the server-side Checkout path; staging explicitly sets it to `false`. The live Checkout and webhook path has been verified; staging remains isolated in Stripe test mode.

The weekly capacity implementation targets the current window (`2026-09-18`) with a 50-meal limit and a 30-minute reservation lifetime. Capacity is measured in total meals across all customer carts, not checkout count.

## What changed

The old fixed weekly-plan selector was replaced with a one-time, mix-and-match order builder. Customers can choose Little Chicken, Big Chicken, Little Beef, or Big Beef, mix quantities directly in the order summary, and see the full cart-wide pricing model before checkout. The homepage makes Chicken/Beef choice and Saturday delivery the primary story.

Important implementation files are `app/order-config.ts`, `app/components/OrderBuilder.tsx`, `app/components/Countdown.tsx`, `app/api/capacity/route.ts`, `app/api/checkout/route.ts`, `app/api/cors.ts`, `app/api/webhooks/stripe/route.ts`, `app/success/page.tsx`, `app/capacity.ts`, `app/order-capacity-config.ts`, `app/order-capacity-db.ts`, `db/schema.ts`, and `drizzle/0001_groovy_avengers.sql` plus `drizzle/0002_narrow_stature.sql`.

## Weekly capacity and reservations

Capacity counts total meals in completed customer orders. The public `GET /api/capacity` endpoint returns the display data needed by the frontend: whether a cap is enabled, the meal limit, `confirmedMeals`, active `reservedMeals`, remaining meals, and the existing `ordersOpen` state. It does not calculate or accept payment totals.

For a capped window, checkout performs this sequence:

1. Validate the cart using the existing canonical product and pricing logic.
2. Atomically release expired reservations and insert one new reservation only if confirmed plus active reserved meals plus the requested cart meal count fits within the configured limit.
3. Create the Stripe Checkout Session with the reservation ID, window key, and a matching approximately 30-minute Stripe expiration.
4. Attach the Stripe session ID to the reservation. A Stripe API failure releases the reservation immediately; an abandoned session is released by the scheduled cleanup or after its expiry on the next capacity request.
5. On a verified paid Checkout webhook, mark the reservation confirmed and insert the order with the existing unique `stripe_session_id` protection. Replayed webhooks do not consume another slot or create another order.

`app/order-capacity-config.ts` is the single window configuration source. Set `limit` to `null` for a future uncapped window, or update it to another meal limit such as 75 or 100 together with a new Friday `windowKey`. The row key keeps windows isolated without changing the existing `orders` table. A one-off Saturday cutoff still belongs to the preceding Friday capacity window. If the configured key is older than the current Friday cutoff, runtime automatically treats the window as uncapped until the operator explicitly advances the key. A five-minute Worker cron invokes cleanup across all windows.

The new migration is `drizzle/0002_narrow_stature.sql`. The existing staging database has its `orders` table but an empty legacy `d1_migrations` ledger, so replaying the historical baseline would try to recreate `orders`. Apply only this new schema file to staging:

```bash
npx wrangler d1 execute threebyrd-orders-staging --remote --config wrangler.staging.jsonc --file drizzle/0002_narrow_stature.sql
```

After staging approval, inspect production’s existing schema and apply the same file to production only if the reservation table is absent, then deploy the production Worker. Do not run the production migration as part of staging validation.

## Product and pricing rules

Prices are integer cents in the canonical pricing table in `app/order-config.ts`. The entire cart selects one tier before any line item is priced:

| Product | 3–4 meals | 5–9 meals | 10+ meals |
| --- | ---: | ---: | ---: |
| Little Chicken | $8.00 | $7.00 | $7.00 |
| Big Chicken | $10.00 | $9.00 | $8.50 |
| Big Beef | $11.00 | $10.00 | $9.50 |
| Little Beef | $9.00 | $8.00 | $8.00 |

The server reconstructs a quote from product IDs and quantities. It does not accept a client-provided price, discount, subtotal, or total. Every order needs at least three total purchasable boxes, and the boxes may be mixed across SKUs. The browser uses the same canonical matrix for display only; the server remains authoritative for payment.

To change prices, update the single matrix in `app/order-config.ts`, then run the pricing tests and build. Do not duplicate prices in the UI or Stripe Dashboard: Checkout receives server-generated `price_data` for each current cart line.

The product cards derive their visible high-to-low price ranges, compact tier disclosure, and next-tier order-summary message from that same matrix. At 10+ meals the best standard price is unlocked; 20+ meals keeps the 10+ prices and shows a custom-pricing contact note. Delivery is free, so the checkout summary shows `Meal subtotal`, `Delivery $0`, and `Total` with no Stripe shipping fee. Little Beef is currently purchasable and uses the exact macros in the product catalog.

| Meal | Calories | Protein | Carbs | Fat |
| --- | ---: | ---: | ---: | ---: |
| Big Chicken | 970 | 70g | 114g | 26g |
| Little Chicken | 660 | 47g | 78g | 17g |
| Big Beef | 1115 | 70g | 114g | 41g |
| Little Beef | 785 | 46g | 83g | 41g |

## Friday cutoff and Saturday delivery

The default first-launch cutoff is centrally defined as `2026-09-11T15:00:00` in `app/order-config.ts`. This is a business-local wall time in `America/New_York`, not a visitor-local timestamp. `getNextOrderCutoff()` uses that initial override while it is still in the future; afterward it rolls forward to the next Friday at 3:00 PM Eastern. The conversion uses `Intl.DateTimeFormat` and handles daylight-saving changes.

For a special week, configure `THREEBYRD_CUTOFF_OVERRIDE` to one business-local value such as `2026-09-19T17:00:00`. Set it in the Worker vars and the static Pages build environment before deploying. The runtime automatically resumes the normal Friday schedule after the override passes; do not permanently change the recurring cutoff or scatter dates through React components.

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
| Production | `threebyrd-website` at `api.threebyrd.com` | `live` (verified; ordering open) | live endpoint at `/api/webhooks/stripe` | `threebyrd-orders` |

`STRIPE_MODE` is not a secret. The server only constructs a Stripe client when the configured key prefix matches the mode (`sk_test_`/`rk_test_` for test and `sk_live_`/`rk_live_` for live). The webhook handler also requires Stripe’s signed event `livemode` value to match. Signing secrets do not identify their mode by prefix, so they must remain separate per Worker and per Stripe webhook endpoint.

The staging environment has no `api.threebyrd.com` route and allows only controlled local origins by default. The production Worker keeps the existing custom domain, production D1 binding, live secrets, and `ORDERS_OPEN=true`; staging keeps `ORDERS_OPEN=false`. Set the production variable back to `false` and redeploy as the emergency close procedure.

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

Put the CLI-provided webhook signing secret in `STRIPE_WEBHOOK_SECRET`, restart the dev server, and use test-mode Checkout with Stripe’s official test payment details. Test 2 meals (blocked), 3, 4, 5, 9, 10, 19, 20, and 21 meals, mixed products (including the 3 Big Chicken + 2 Big Beef = $47 example), Little Beef, invalid SKUs, zero/negative/fractional quantities, canceled Checkout, frontend price manipulation, one successful Checkout, both successful webhook event types, failed asynchronous payment, and replayed delivery. A successful webhook needs a real D1 binding to persist the order; without it, the endpoint intentionally returns a retryable error rather than claiming the order was saved.

Staging sandbox webhooks must use the signing secret for the Stripe test-mode endpoint. Never put the production live webhook secret in local or staging files, and never use a Stripe CLI forwarding secret for a registered production endpoint.

## Viewing and refunding orders

Confirmed records are stored in the D1 `orders` table with the Stripe session ID, payment intent ID, selected items, customer delivery details, amount, currency, cutoff, and confirmation timestamp. View them through the Sites database/D1 tooling or the Cloudflare D1 console. Stripe Dashboard → Payments remains the source for payment status and reconciliation.

Refunds should be initiated from Stripe Dashboard → Payments for the matching payment, or through the Stripe API after confirming the order/session ID. A refund workflow/UI is not exposed to customers by this site, and no custom refund endpoint was added.

## Billing and Invoicing foundation

The live UX is one-time Checkout only. Billing is intentionally left as a future extension: a later “make this recurring” choice should create a Stripe Billing subscription through a `mode: subscription` Checkout Session and should use the Customer Portal for changes/cancellation. No subscription objects or renewal loops exist today.

Invoicing is also intentionally outside student checkout. For future fraternity, club, campus-organization, or catering customers, create invoices through Stripe Invoicing or the Dashboard after deciding customer/payment terms. No invoice objects or B2B UI were created here.

## What ThreeByrd still needs to do

1. Keep staging isolated with `STRIPE_MODE=test`, its sandbox secrets, and its separate D1 database.
2. Decide tax registrations, product tax classification, and whether to enable Stripe Tax with a tax adviser; do not enable it by assumption.
3. Monitor the live-account operational checklist, including receipts, statement descriptor, fulfillment, refunds, and webhook delivery.
4. If an emergency close is needed, set `ORDERS_OPEN` to `false`, deploy the Worker, and verify that checkout returns HTTP 503.

## Cloudflare configuration before public API access

The following must be completed manually before `api.threebyrd.com` is made public:

1. In Cloudflare Workers & Pages, deploy the server-backed Vinext build to the existing Threebyrd Sites/Worker project and keep the logical D1 binding named `DB` attached to the existing `orders` database. Do not deploy the static GitHub Pages artifact as the API runtime.
2. Add `api.threebyrd.com` as a custom domain for that Worker. If Cloudflare requests DNS configuration instead, create only the `api` DNS record pointing to the exact target Cloudflare provides, with proxying enabled if Cloudflare marks it required. Do not change the root `threebyrd.com` record or GitHub Pages custom-domain configuration.
3. Wait for the Cloudflare-managed certificate to become active and verify `https://api.threebyrd.com/` reaches the Worker. With ordering open, verify a valid cart reaches Stripe Checkout and invalid/unavailable carts remain rejected.
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

The app remains a Vinext/Cloudflare Worker project. The main-branch automation publishes the static frontend, while the Worker is deployed separately through Wrangler. Production is currently launched with `ORDERS_OPEN=true`; staging remains on its separately deployed test-mode artifact with `ORDERS_OPEN=false`.
