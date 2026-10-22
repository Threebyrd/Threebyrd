# Production rollout — October 21, 2026

## Implemented and verified

A separate production Worker and fresh Durable Object namespace exist at `https://weekly.threebyrd.com`. Current deployment: f6cda1ef-f366-4a2b-9b4f-f33fef5a3215. Signup, billing and customer emails are OFF. `/health` confirms production, billingEnabled false, customerEmailsEnabled false, configured false. `/my-plan` returns 503 while live connections are incomplete. The main website still returns HTTP 200 and its weekly feature remains disabled by default. No live payments, customer migrations, customer emails or production order rows were created.

Shared verified payment lifecycles now support explicit, isolated test/live adapters. Existing test constructors still reject live keys; live constructors reject test keys and enforce the production origin. Provider customer, payment method, PaymentIntent, Checkout and webhook livemode must match storage. Fresh production SQL accepts only stripe_live mappings/plans. Production enrollment requires a distinct live authorization version/text; staging authorization is rejected. Legacy internal table/function names are retained for the shared tested lifecycle; they do not select the Stripe environment.

The billing off switch blocks enrollment, first purchase, card setup and paid-order save. Production adapters also gate before Checkout creation, before recurring creation/confirmation, and before paid adjustment execution. Existing customers can still manage plans and signed in-flight payment events can still reconcile/export when billing is paused. Customer email delivery remains separately disabled and queued. Current native sending binding permits only luc@threebyrd.com; unrestricted customer distribution requires an explicit later binding update and delivery verification.

Production management assets are built separately. The main website supports a disabled-by-default NEXT_PUBLIC_WEEKLY_ENABLED switch. The weekly draft crosses to weekly.threebyrd.com in a URL fragment (meal choices only), then is stored on that origin; server pricing/eligibility remain authoritative. One-time checkout continues using its existing path. Main frontend activation has not been deployed.

113 subscription/Google Sheets tests pass, including production isolation, fresh authorization, environment mismatch rejection, disabled billing, live-mode renewal/notification contracts using provider fixtures, and production receiver opt-in. No fixture test is claimed as a real live charge. Targeted lint and TypeScript pass. Existing actual Stripe TEST lifecycle was already verified independently.

## Rollback rehearsal completed

Deployed disabled version 7c231353-c086-43d7-9bc1-e463d6e0b62c, then disabled version 993c07cf-bd3b-4744-966a-9060a5e16e0e. Actually rolled back to the first version with Wrangler and verified HTTP 200 health with billing/customer emails still false. No production subscriber data existed. Rollback restores code/config, not data or accepted payments; never delete the subscription storage to undo a deployment. Reconcile any already-started payment before allowing a retry. The latest custom-domain deployment remains disabled.

## Production Google receiver

Backed up the original receiver source privately at `.local-previews/weekly-production/receiver-before.gs`. Saved the tested upgrade in the existing production project:
https://script.google.com/u/0/home/projects/1IKzzBL9FgoPRZ-32luhtY0DpwX705lAqBrItGMljEZ0GrP8d8NIqdiOh/edit

Reloaded the editor, copied its saved source, and confirmed it exactly matches reviewed `google-apps-script/Code.gs`. No new deployment, sharing change, execution identity change, URL change or secret change was made. The existing deployed one-time receiver remains active.

The receiver's production weekly support requires BOTH the exact production spreadsheet id and WEEKLY_EXPORTS_ENABLED=true. Existing one-time exports remain accepted when that flag is absent/false. Live sender diagnostics additionally require the exact production spreadsheet id, expected name and Orders tab. Revisions retain customer/payment identity and operator kitchen status; original rows/headers/formulas remain intact.

Publishing the existing deployment was denied to the current Cornell account: "You do not have permission to perform this action." A session refresh/retry did not resolve it. The other already-signed-in personal Google account could not open this project. The deployment owner must sign in/publish; do not create a replacement public deployment or change the execution identity to bypass this restriction.

## Stripe connection

The existing ThreeByrd production account is signed in. Existing key settings are open at:
https://dashboard.stripe.com/acct_1UBJ2iCmcRTrEecL/apikeys

Attempted to reuse the existing live secret; Stripe requires account verification before revealing it. No new key was created, no permissions were expanded, no live secret was copied, and no live webhook was installed. The open verification dialog remains at "Verification required / Please wait". Account owner interaction is required to complete/retry that verification.

Prepared `scripts/weekly-production/configure-live.mjs`. It refuses enabled billing/email configuration, requires an existing live key stored privately, verifies the exact production account, creates/reuses one signed webhook idempotently, and uploads secret values through stdin without printing them. It never charges a card. It has not been executed because the key is unavailable. Do not paste credentials into chat.

## Resume after owner access

1. Complete Stripe verification in the open production account; securely reuse the existing key. Run the prepared live connection script while billing remains off.
2. Publish a new version of the existing Google deployment as its owner, preserving URL/sharing/execution identity/secret. Enable the pinned weekly export property and verify its read-only diagnostic. Store receiver config only in ignored private storage and Worker secrets.
3. Verify authenticated production management, signed live event reconciliation with no financial transaction, and owner-only sender delivery. Finish final customer-facing terms/privacy review and frontend handoff check.
4. Update/verify the native customer email binding, then perform the controlled release. Keep billing off until all readiness checks pass. No real test purchase may be charged to the owner by the agent.

No additional business decisions are needed. The immediate blockers are external account verification and deployment-owner permissions, not a request to reconfirm the work.

Final re-entry check: repeated the existing actual Stripe TEST lifecycle after the shared-mode refactor. All checks passed, renewal remained $34.02, zero additional exports and zero forbidden kitchen orders. One read-only staging diagnostic timed out; a bounded retry succeeded without creating another payment/order. Final targeted lint and TypeScript passed. Production-disabled status screenshot: `/tmp/threebyrd-production-disabled.png`.

Owner requested retry of Stripe only, leaving Google deployment pending. Closed the stalled verification, refreshed the existing production API-key page, and retried Reveal for the same existing key. Stripe again remained at Verification required / Please wait with no usable challenge. Final full accessibility read confirmed verification still loading and no live key revealed/copied. No new key, webhook, Google change, live charge, or billing activation. Evidence: /tmp/threebyrd-stripe-verification-stalled.png. User must complete/retry the interactive Stripe verification before the prepared connection script can run.

Latest owner follow-up: verification completed in the in-app Stripe tab; the existing secret is now masked (no Reveal button). No full key was present on that page, in either task browser clipboard, or in the known private credential path. Filename-only search of Desktop/Downloads found no Stripe/key file. Weekly production secret-name listing returned an empty list, so it was not saved there. Asked only for the saved key's location/password-manager entry, not its value. Do not create/rotate a key without the owner requesting that action. Google remains deferred at the owner's request; billing remains disabled.
