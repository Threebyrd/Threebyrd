import Image from "next/image";
import Link from "next/link";

export default function SuccessPage() {
  return (
    <main className="successPage">
      <div className="successCard">
        <Link className="successLogo" href="/" aria-label="ThreeByrd Meal Prep home">
          <Image src="/assets/threebyrd-logo.png" alt="ThreeByrd Meal Prep official logo" width={3938} height={2591} priority />
        </Link>
        <p className="sectionLabel">Order received</p>
        <h1>That&apos;s a wrap.</h1>
        <p className="successLead">Thanks for ordering. Stripe has returned you here, and your payment is being confirmed securely before your order is prepared for Saturday cooking and delivery.</p>
        <div className="successDelivery"><strong>Saturday delivery</strong><span>Delivery only · no pickup · no promised delivery time</span></div>
        <Link className="button buttonPrimary" href="/">Back to ThreeByrd <span aria-hidden="true">→</span></Link>
      </div>
    </main>
  );
}
