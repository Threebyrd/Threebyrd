import PolicyPage from "../components/PolicyPage";
import { siteUrl, withBasePath } from "../site-paths";

export const metadata = {
  title: "Terms & Conditions | ThreeByrd Meal Prep",
  alternates: { canonical: siteUrl("/terms") },
  description: "Website, ordering, and SMS terms for ThreeByrd Meal Prep.",
};

export default function TermsPage() {
  return <PolicyPage title="Terms & Conditions">
    <p>These terms apply to the ThreeByrd Meal Prep website, ordering services, and text messaging programs operated by Three Byrd Meal Prep LLC (“we,” “us,” or “our”) in Ithaca, New York. For assistance, contact <a href="mailto:luc@threebyrd.com">luc@threebyrd.com</a>.</p>
    <h2>Orders and website use</h2>
    <p>ThreeByrd Meal Prep offers one-time meal-prep orders for delivery within our service area. Available meals, prices, minimum quantities, ordering cutoffs, delivery eligibility, and delivery timing are shown during ordering. Stripe securely processes payment. Review your order and the total, including applicable taxes, before paying.</p>
    <p>Provide accurate contact and delivery information and use the website lawfully. Please contact us promptly about order mistakes, delivery problems, cancellation requests, or refund requests so we can review your situation. Nothing in these terms limits rights you have under applicable law.</p>
    <h2>SMS Terms</h2>
    <p>The ThreeByrd Meal Prep SMS programs offer (1) order and delivery updates and (2) recurring promotional messages, including menus and special offers. You may choose either, both, or neither using separate optional checkboxes during checkout. Checking one does not enroll you in the other. Texts may be sent using automated technology to the mobile number you provide during secure checkout.</p>
    <p>Message frequency varies. Order-text frequency depends on your order; promotional texts are recurring and their frequency varies. Message and data rates may apply. Consent to receive texts, including marketing texts, is not a condition of purchase. You must be authorized to provide consent for the mobile number you enter.</p>
    <p><strong>Reply STOP to unsubscribe from ThreeByrd Meal Prep texts. You may receive a final message confirming your opt-out.</strong> You can contact support to request enrollment again; we require a new valid opt-in before resuming messages.</p>
    <p><strong>Reply HELP for help, or email <a href="mailto:luc@threebyrd.com">luc@threebyrd.com</a>.</strong> Contact support if you change your phone number or need help with your messaging preferences.</p>
    <p>Carriers are not liable for delayed or undelivered messages. Text delivery depends on carrier and network availability. Please contact support for time-sensitive order questions.</p>
    <p>We handle personal information and SMS consent as described in our <a href={withBasePath("/privacy")}>Privacy Policy</a>. We do not sell or share SMS opt-in data or personal information with third parties for marketing purposes.</p>
    <h2>Changes and contact</h2>
    <p>We may update these terms by posting a revised version with an updated effective date. Changes do not create SMS consent or expand the purposes you agreed to. For questions, contact Three Byrd Meal Prep LLC, doing business as ThreeByrd Meal Prep, at <a href="mailto:luc@threebyrd.com">luc@threebyrd.com</a>.</p>
  </PolicyPage>;
}
