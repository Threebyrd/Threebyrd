# ThreeByrd Meal Prep

ThreeByrd is a delivery-only meal-prep site for one-time, customizable orders of Chicken and Beef boxes. Customers choose Little or Big portions, mix and match three or more purchasable boxes, and check out through Stripe-hosted Checkout.

## Quick start

Requirements: Node.js 22.13 or newer.

```bash
npm install
npm run dev
```

Open [http://localhost:3000/](http://localhost:3000/). The production launch is enabled through the centralized `ORDERS_OPEN` flag; local development must continue using Stripe test credentials.

## Useful commands

```bash
npm run dev
npm run lint
npx tsc --noEmit
npm test
npm run build
npm run db:generate
```

## Main files

- `app/page.tsx`: homepage structure, delivery-first positioning, menu, process, story, founders, and launch list.
- `app/components/OrderBuilder.tsx`: customizable cart UI, live summary, minimum-order state, and Checkout handoff.
- `app/components/Countdown.tsx`: browser-safe countdown to the next Friday 3:00 PM Eastern cutoff.
- `app/order-config.ts`: trusted product catalog, canonical cart-wide pricing tiers, quote validation, and cutoff recurrence.
- `app/api/checkout/route.ts`: server-side quote validation and Stripe Checkout Session creation.
- `app/api/cors.ts`: exact-origin CORS protection for the checkout API.
- `app/api/webhooks/stripe/route.ts`: signature verification and idempotent D1 order confirmation.
- `app/stripe.ts`: Stripe mode and API-key isolation for local, staging, and production.
- `app/success/page.tsx`: post-checkout confirmation experience.
- `db/schema.ts` and `drizzle/`: confirmed-order schema and D1 migration.
- `docs/ORDERING.md`: operator and developer guide for pricing, Stripe, cutoff overrides, orders, refunds, and deployment.
- `public/assets/threebyrd-logo.png`: supplied complete ThreeByrd logo used for full-logo placements.
- `public/assets/threebyrd-logo.png`: complete ThreeByrd logo used in the website header and footer.
- `public/assets/threebyrd-single-chicken-star.png`: transparent single chicken-and-star mark used for favicon and app-icon assets.

## Environment

Copy the needed values into `.env.local` for local development. Never commit that file.

- `STRIPE_SECRET_KEY`: Stripe test-mode secret for local/staging, or the least-privilege live restricted key for production. Keep it in the Worker secret store only.
- `STRIPE_WEBHOOK_SECRET`: signing secret for `/api/webhooks/stripe`.
- `STRIPE_MODE`: `test` for local/staging and `live` for production; the server rejects mismatched Stripe key prefixes and webhook event modes.
- `NEXT_PUBLIC_SITE_URL`: trusted site origin used in Stripe success/cancel URLs.
- `NEXT_PUBLIC_CHECKOUT_API_ORIGIN`: public API origin used by the static frontend, normally `https://api.threebyrd.com` in production.
- `CORS_ALLOWED_ORIGINS`: comma-separated browser origins allowed to call the checkout API.
- `THREEBYRD_CUTOFF_OVERRIDE`: optional business-local wall time such as `2026-09-11T15:00:00`; see `docs/ORDERING.md`.
- `NEXT_PUBLIC_APPS_SCRIPT_URL`: existing optional launch-list endpoint.

## Current scope

The production customer experience is live ordering. Production uses the verified live Stripe key and live webhook secret with `STRIPE_MODE=live`; staging and local development use separate sandbox credentials and D1 data. The controlled live verification payment was refunded, its D1 row remains an audit record, and all four meals, including Little Beef, are available for purchase.
