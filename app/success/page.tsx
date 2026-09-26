import Image from "next/image";
import Link from "next/link";
import { getNextOrderCutoff, getSaturdayForCutoff } from "../order-config";

const deliveryDay = getSaturdayForCutoff(getNextOrderCutoff());

export default function SuccessPage() {
  return (
    <main className="successPage">
      <div className="successCard">
        <Link className="successLogo" href="/" prefetch={false} aria-label="ThreeByrd Meal Prep home">
          <Image src="/assets/threebyrd-logo.png" alt="ThreeByrd Meal Prep official logo" width={3938} height={2591} priority />
        </Link>
        <p className="sectionLabel">Order received</p>
        <h1>That&apos;s a wrap.</h1>
        <p className="successLead">Thanks for ordering. Stripe has returned you here, and your payment is being confirmed securely before your order is prepared for {deliveryDay.toLowerCase()} cooking and delivery.</p>
        <div className="successDelivery"><strong>{deliveryDay} delivery</strong><span>Free delivery in Ithaca · no pickup · no promised delivery time</span></div>
        <Link className="button buttonPrimary" href="/" prefetch={false}>Back to ThreeByrd <span aria-hidden="true">→</span></Link>
      </div>
    </main>
  );
}
