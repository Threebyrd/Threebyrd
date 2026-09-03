# ThreeByrd Meal Prep

ThreeByrd is a delivery-only meal-prep site for one-time, customizable orders of Chicken and Beef boxes. Customers choose Little or Big portions, mix and match three or more purchasable boxes, and check out through Stripe-hosted Checkout.

## Quick start

Requirements: Node.js 22.13 or newer.

```bash
npm install
npm run dev
```

Open [http://localhost:3000/](http://localhost:3000/). Products and nutrition remain visible, but ordering is intentionally closed through the centralized `ORDERS_OPEN` flag until the founders finalize pricing.

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
- `app/order-config.ts`: trusted product catalog, tiered pricing, quote validation, and cutoff recurrence.
- `app/api/checkout/route.ts`: server-side quote validation and Stripe Checkout Session creation.
- `app/api/webhooks/stripe/route.ts`: signature verification and idempotent D1 order confirmation.
- `app/success/page.tsx`: post-checkout confirmation experience.
- `db/schema.ts` and `drizzle/`: confirmed-order schema and D1 migration.
- `docs/ORDERING.md`: operator and developer guide for pricing, Stripe, cutoff overrides, orders, refunds, and deployment.
- `public/assets/threebyrd-logo.png`: supplied complete ThreeByrd logo used for full-logo placements.
- `public/assets/threebyrd-logo.png`: complete ThreeByrd logo used in the website header and footer.
- `public/assets/threebyrd-single-chicken-star.png`: transparent single chicken-and-star mark used for favicon and app-icon assets.

## Environment

Copy the needed values into `.env.local` for local development. Never commit that file.

- `STRIPE_SECRET_KEY`: Stripe test-mode secret or least-privilege restricted key for server-side Checkout and confirmation retrieval.
- `STRIPE_WEBHOOK_SECRET`: signing secret for `/api/webhooks/stripe`.
- `NEXT_PUBLIC_SITE_URL`: trusted site origin used in Stripe success/cancel URLs.
- `THREEBYRD_CUTOFF_OVERRIDE`: optional business-local wall time such as `2026-09-11T15:00:00`; see `docs/ORDERING.md`.
- `NEXT_PUBLIC_APPS_SCRIPT_URL`: existing optional launch-list endpoint.

## Current scope

The current customer experience is a closed ordering preview. Stripe payment code remains in place but is gated by `ORDERS_OPEN = false`; this update did not configure, connect, test, or modify Stripe. Stripe Billing and Invoicing remain future work.
