> Updated sandbox model (supersedes older staging language below): first eligible delivery is purchased at signup, then later eligible deliveries are charged at cutoff. One free box of any available size, including sauce, with the first paid delivery; at least three other paid meals. All payments remain simulated.

# Weekly plan privacy additions — local draft only

Not published or effective for the live website. These are additions to be reconciled with the existing Privacy Policy before public enrollment.

Three Byrd Meal Prep LLC, operating ThreeByrd Meal Prep, uses verified email addresses to identify subscribers and deliver secure sign-in links. Stored information includes delivery name/address, paid meal preferences, welcome meal selection, cycle overrides/skips, pause/cancellation state, saved payment-method identifiers, recurring authorization version/text and time, and an audit history of changes. Login/session secrets are stored as hashes, links expire and are single-use, and authorization is checked before accessing or changing a plan. We do not store full card numbers.

The local sandbox uses fictional records, a private in-memory mock email inbox, and mock payment methods by default. When explicitly configured with separate Stripe test credentials, Stripe handles test card setup and returns identifiers. No production credentials or customer records are imported, no real email is sent, and no recurring charges can be initiated by this implementation.

Subscription permission does not authorize SMS marketing. Preserve the existing separate SMS choices and no third-party marketing-sharing commitments. A future email provider will need access only to information needed to deliver authentication and service notices; do not automatically enroll subscribers in marketing email or SMS as a condition of purchase.

Before launch, select and disclose the actual transactional email provider, retention and deletion procedures, token/session expiration practices, support identity verification and account-recovery procedures, and any new service-provider processing. Keep authorization, opt-out, payment and welcome-redemption audit records as required for their purposes; do not promise universal immediate deletion.

Contact: luc@threebyrd.com.
