import PolicyPage from "../components/PolicyPage";
import { siteUrl, withBasePath } from "../site-paths";

export const metadata = {
  title: "Privacy Policy | ThreeByrd Meal Prep",
  alternates: { canonical: siteUrl("/privacy") },
  description: "How Three Byrd Meal Prep LLC handles customer information and SMS consent.",
};

export default function PrivacyPage() {
  return <PolicyPage title="Privacy Policy">
    <p>Three Byrd Meal Prep LLC operates ThreeByrd Meal Prep (“we,” “us,” or “our”), a meal-prep delivery business in Ithaca, New York. This policy explains how we handle information through our website, ordering services, and communications.</p>
    <h2>Information we collect</h2>
    <p>When you order, we collect your name, email address, phone number, delivery address, meal selections, delivery instructions you provide, and order and payment status. We record payment transaction identifiers, amounts, discounts, and taxes. Stripe processes payment details; our application does not store your full payment card number.</p>
    <p>If you join our email updates list, we collect the email address you submit. For SMS choices during checkout, we record each choice separately, the phone number provided during secure checkout, the time, the source, and the version of the disclosure shown. Our service providers may process technical request information, such as network addresses and error logs, to operate and protect the service.</p>
    <h2>How we use information</h2>
    <p>We use information to process payments, prepare and deliver orders, check delivery eligibility, provide customer support, prevent abuse, maintain business records, and send communications you request. Order and delivery texts require order-text consent. Promotional texts require a separate promotional-text opt-in. A purchase or an email signup does not enroll you in SMS marketing.</p>
    <h2>Service providers and disclosures</h2>
    <p>We use Stripe for payments, Google services for delivery-address checks and operational spreadsheets or signup records, and hosting providers including Cloudflare and GitHub to operate the website and ordering services. Messaging providers, including Twilio when messaging is enabled, process phone numbers and message information to deliver authorized texts. These providers receive information needed for their services.</p>
    <p>We do not sell or share your SMS opt-in data or personal information with third parties for marketing purposes. Mobile information will not be shared with third parties or affiliates for marketing or promotional purposes. Text messaging originator opt-in data and consent are excluded from any sharing for marketing or promotional purposes; necessary messaging service providers may process this information solely to provide messaging services.</p>
    <p>We may disclose information when required by law or as necessary to protect the security and rights of our customers and business. This does not authorize sharing SMS consent for another party’s marketing.</p>
    <h2>SMS choices</h2>
    <p>SMS enrollment is voluntary and is not a condition of purchase. Message frequency varies; order-message frequency depends on your order, and promotional messages are recurring. Message and data rates may apply. <strong>Reply STOP to unsubscribe or HELP for help.</strong> You may also contact <a href="mailto:luc@threebyrd.com">luc@threebyrd.com</a>. See our <a href={withBasePath("/terms")}>Terms &amp; Conditions</a> for SMS Terms.</p>
    <h2>Retention and security</h2>
    <p>We retain information as needed to fulfill orders, provide support, maintain consent and opt-out records, meet tax and other legal obligations, and resolve disputes. Retention depends on the record and purpose. We use access controls and security measures appropriate to our systems, but no online service can guarantee absolute security.</p>
    <h2>Your requests and policy changes</h2>
    <p>To ask about your information, request access, correction, or deletion, or stop email updates, contact <a href="mailto:luc@threebyrd.com">luc@threebyrd.com</a>. We may need to verify your identity and retain records required for legal obligations or to honor opt-outs. We will post policy updates here with an updated effective date.</p>
    <h2>Contact</h2>
    <p>Three Byrd Meal Prep LLC · ThreeByrd Meal Prep · Ithaca, New York<br />Email: <a href="mailto:luc@threebyrd.com">luc@threebyrd.com</a></p>
  </PolicyPage>;
}
