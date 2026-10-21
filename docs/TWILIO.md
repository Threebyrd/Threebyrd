# ThreeByrd Meal Prep SMS registration

Business confirmed by owner on October 21, 2026:
- Legal entity: Three Byrd Meal Prep LLC.
- Brand: ThreeByrd Meal Prep.
- Support: luc@threebyrd.com.
- No customer information or SMS consent shared for third-party marketing.
- Order and promotional messages offered separately.

## Public URLs (verify after deployment)

- Privacy: https://threebyrd.com/privacy/
- Terms: https://threebyrd.com/terms/
- Opt-in proof: https://threebyrd.com/order/

The consent controls are on the public order page before payment; they also appear on the homepage's order section. Use `/order/` as the specific proof URL. Submit screenshots showing both unchecked controls, all disclosure text and links, and the post-checkout success screen if requested. A payment is not SMS consent. Email updates do not grant SMS consent; the former phone signup field has been removed.

## Proposed campaign description

ThreeByrd Meal Prep, operated by Three Byrd Meal Prep LLC, offers meal-prep delivery in Ithaca, New York. Customers can opt in at https://threebyrd.com/order/ using two separate, unchecked, optional checkboxes: one for automated order and delivery updates and one for recurring automated promotional menus and special offers. Customers may choose either, both, or neither and can purchase without SMS consent. The phone number is provided during Stripe-hosted checkout; after payment, each purpose's decision, disclosure version, timestamp, source, and normalized destination are stored independently. Frequency, message/data rates, STOP and HELP instructions, and links to the privacy policy and terms are visible beside the controls. No purchased or third-party lists are used. This campaign description must match the actual Twilio use case and configured sending behavior before submission.

## Suggested messages (templates only, not enabled)

Order update: “ThreeByrd Meal Prep: Your meal order is scheduled for delivery on [actual delivery date]. Questions? luc@threebyrd.com. Reply STOP to unsubscribe.”

Promotion (only separate promotional opt-in): “ThreeByrd Meal Prep: This week's menu is available at https://threebyrd.com. Reply STOP to unsubscribe.”

Enrollment confirmation must reflect the actual purposes chosen: “ThreeByrd Meal Prep: You're enrolled in [order/delivery updates and/or recurring menus and offers]. Message frequency varies. Message and data rates may apply. Reply STOP to unsubscribe, HELP for help. Support: luc@threebyrd.com.”

HELP: “ThreeByrd Meal Prep: Help at luc@threebyrd.com. Message frequency varies. Message and data rates may apply. Reply STOP to unsubscribe.”

STOP: “ThreeByrd Meal Prep: You are unsubscribed. No more messages will be sent.”

## Remaining Twilio work — required before real SMS

No Twilio credentials, SMS sender, incoming SMS endpoint, or recurring-program enrollment-confirmation sender exist in this repository. SMS outbox rows are records only: the scheduled Worker processes order spreadsheets and capacity cleanup, not SMS. No real SMS is enabled by this change.

1. Register/verify the legal entity and exact brand, then register the campaign with matching purposes, URLs, and sample messages. Confirm the sender type and destination countries; these notes address US A2P 10DLC and do not establish compliance in other jurisdictions.
2. Configure the correct Messaging Service and approved sender. Verify STOP/HELP and other supported opt-out keywords using Twilio's default or Advanced Opt-Out features. Do not duplicate automatic carrier/Twilio responses.
3. Before adding an SMS sender, connect authenticated, signature-verified opt-out callbacks to `revokeTransactionalSmsReminders`, which revokes all SMS purposes and cancels pending jobs. Implement a durable number-level suppression record for opt-outs that arrive before any local consent record, and reconcile Twilio's suppression state. The current revocation helper is not reachable from Twilio yet.
4. A future sender must check current purpose-specific consent, revocation, and provider suppression immediately before every send, including retries. Never send promotions based on legacy combined consent, order-text consent, email signup, or just a phone number. A later order checkbox must not automatically clear an existing STOP.
5. Implement an immediate, idempotent confirmation for each recurring enrollment once valid consent and its destination are available. Confirm the complete flow with test credentials/mocked SMS before enabling production sends. Require a documented fresh opt-in flow to re-enroll opted-out numbers.
6. Obtain Twilio/carrier approval before using an A2P sender. Website changes alone do not guarantee approval or establish all legal obligations.

## Persistence and compatibility

`separate-sms-v2` stores `order_updates` and `promotional` as distinct `notification_consents` rows. Absent choices default to `no`. Current checkout metadata includes each decision and the server timestamp; the paid webhook associates them with the number provided during secure checkout. Declined or abandoned unpaid checkout sessions do not produce a paid-order consent record and must never enroll anyone.

The webhook continues accepting `order-and-promotions-v1` for in-flight/older paid sessions so fulfillment is not broken. Those records retain the original `order_and_promotional` purpose and create an explicit `no` for the new promotional purpose. No legacy records are upgraded into new promotional permission. The existing sheet's combined-consent column is retained for compatibility and is blank for new, separately recorded choices. The source of truth for new consent is D1, not that legacy spreadsheet column; do not use historical Yes values to start a new marketing program. The unchanged Apps Script does not need redeployment.

The local revocation helper cancels pending jobs and marks existing affirmative consents revoked; enqueueing checks for historical revocation at the same number. No automated re-enrollment is implemented.

## Disclosure archive: separate-sms-v2

Legend: “Optional text messages from ThreeByrd Meal Prep”

Intro: “Choose either, both, or neither. Consent is not a condition of purchase.”

Order checkbox: “Text me about my order” / “I agree to receive automated ThreeByrd Meal Prep order and delivery updates at the mobile number I provide during secure checkout. Message frequency varies by order. Message and data rates may apply. Reply STOP to unsubscribe or HELP for help.”

Promotional checkbox: “Text me menus and special offers” / “I agree to receive recurring automated promotional texts from ThreeByrd Meal Prep at the mobile number I provide during secure checkout. Message frequency varies. Message and data rates may apply. Reply STOP to unsubscribe or HELP for help.”

Adjacent links: “Read our Privacy Policy and Terms & Conditions. Help: luc@threebyrd.com.”

Sources checked October 21, 2026:
https://help.twilio.com/articles/11847054539547
https://www.twilio.com/docs/api/errors/30924
