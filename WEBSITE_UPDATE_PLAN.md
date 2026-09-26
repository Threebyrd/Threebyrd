# ThreeByrd website update plan

## Guardrails

- Implement and validate locally/staging only. Do not deploy the production Worker, change live Cloudflare resources, change production Stripe settings, or publish the frontend from this task.
- Keep server-side pricing, Stripe mode isolation, D1 idempotency, webhook verification, and meal-based capacity authoritative.

## Current architecture

- Vinext/Vite React app with a static GitHub Pages build and a Cloudflare Worker API.
- `app/order-config.ts` is the shared product/pricing/cutoff module used by the browser and Worker; the server quote is authoritative.
- Stripe Checkout Sessions are created in `app/api/checkout/route.ts`; paid webhook events are fulfilled idempotently into D1.
- D1 stores confirmed orders and active/confirmed/released meal reservations. The current configured cap is measured in total meals.
- The static frontend sends checkout/capacity requests to the configured API origin.

## Implementation decisions

1. Use the six supplied photos only. Use the four straight-on photos for product cards and the two diagonal photos for a two-image hero carousel. Horizontally flip the supplied diagonal chicken photo so broccoli sits on the left and both hero images share the same diagonal direction.
2. Standardize product and hero image containers with fixed aspect ratios and `object-fit: cover`; do not stretch the source photos.
3. Use a small client-side hero carousel with a gentle timer, no heavy controls, and reduced-motion support.
4. Use Google Maps Platform Routes API server-side for address eligibility. The Worker will geocode the submitted US address, request a traffic-unaware driving route from 700 W Buffalo St, Ithaca, and enforce a 20-minute maximum using the static route duration. No routing key is exposed to the browser. A server credential is required for final staging/live route validation.
5. Keep the address UI usable without a browser maps key: a native address input with browser autofill semantics, explicit delivery copy, and a server-side normalized address. Optional provider autocomplete can be added later without changing checkout enforcement.
6. Add a dedicated eligibility endpoint for responsive UX, but repeat the server-side eligibility check immediately before Stripe Checkout creation. The browser's eligibility state is never trusted for payment.
7. Add concise server-generated Stripe metadata for the Zapier mapping, including the reservation/order ID, zero-filled product quantities, total meals, normalized delivery address, delivery date, and existing cart/pricing fields. D1 remains authoritative for fulfillment.
8. Replace stale cutoff copy with cutoff-derived wording. Configure this week's one-time business-local override as Saturday, September 26, 2026 at 3:00 PM Eastern in local/staging build configuration, with recurring Saturday 3:00 PM cutoffs after it passes.
9. Replace the unfinished Zapier order export with a direct Google Apps Script Web App. Confirmed D1 orders enqueue one idempotent outbox record in the same batch; a scheduled Worker retries the validated D1-derived row independently of Stripe fulfillment.

## Testing plan

- Pricing boundaries and mixed carts remain covered by existing tests.
- Add routing tests for eligible, outside-zone, invalid, ambiguous, and provider-failure responses, plus checkout rejection when the client attempts to bypass eligibility.
- Add Stripe metadata tests for every product quantity, total meals, delivery address, delivery date, and mixed carts.
- Run lint, typecheck, unit/build tests, static Pages build, local/staging smoke checks, and responsive visual checks at mobile, tablet, and desktop widths. Do not run production deployment.

## Risks / blockers

- Staging hosted Checkout, signed webhook fulfillment, D1 meal-capacity accounting, address validation, and cleanup have passed with the active test-mode Worker secret. The staging Worker is restored to `ORDERS_OPEN=false`.
- A direct Stripe CLI event resend was not run because the locally authenticated CLI context is live-only; no live event or credential was used. Application-level replay/idempotency tests and the D1 unique session constraint pass, and each of the three staging sessions produced exactly one order.
- Google Maps route validation is live and passing on staging. Stripe and Google secrets must never be committed or sent to the frontend.
- Google Sheets export is implemented and tested locally, with an additive outbox migration applied to staging. Apps Script deployment and its URL/shared secret are the only remaining external setup steps; no Sheets credentials are present in the repository or staging Worker.
- Production deployment and opening remain an explicit later step; production was not deployed or modified during this update.
