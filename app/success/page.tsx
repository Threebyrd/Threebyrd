import Image from "next/image";
import Link from "next/link";
import { formatMoney, quoteOrder, type CartItemInput } from "../order-config";
import { getStripe } from "../stripe";

type SuccessPageProps = {
  searchParams?: Promise<{ session_id?: string }>;
};

function readCart(value: string | undefined): CartItemInput[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed) ? parsed as CartItemInput[] : [];
  } catch {
    return [];
  }
}

export default async function SuccessPage({ searchParams }: SuccessPageProps) {
  const params = await searchParams;
  const stripe = getStripe();
  let session: Awaited<ReturnType<NonNullable<typeof stripe>["checkout"]["sessions"]["retrieve"]>> | null = null;

  if (stripe && params?.session_id) {
    try {
      session = await stripe.checkout.sessions.retrieve(params.session_id);
    } catch {
      session = null;
    }
  }

  const quote = quoteOrder(readCart(session?.metadata?.cart));
  return (
    <main className="successPage">
      <div className="successCard">
        <Link className="successLogo" href="/" aria-label="ThreeByrd Meal Prep home">
          <Image src="/assets/threebyrd-logo.png" alt="ThreeByrd Meal Prep official logo" width={3938} height={2591} priority />
        </Link>
        <p className="sectionLabel">Order received</p>
        <h1>That&apos;s a wrap.</h1>
        <p className="successLead">Your payment has been received. Your order is being confirmed server-side, then prepared for Saturday cooking and delivery.</p>
        {quote.lines.length > 0 && (
          <div className="successOrder" aria-label="Your selected meals">
            {quote.lines.map((line) => <div key={line.productId}><span>{line.quantity} × {line.name}</span><strong>{formatMoney(line.amountCents)}</strong></div>)}
            <div className="successTotal"><span>Order total</span><strong>{formatMoney(session?.amount_total ?? quote.subtotalCents)}</strong></div>
          </div>
        )}
        <div className="successDelivery"><strong>Saturday delivery</strong><span>Delivery only · no pickup · no promised delivery time</span></div>
        <Link className="button buttonPrimary" href="/">Back to ThreeByrd <span aria-hidden="true">→</span></Link>
      </div>
    </main>
  );
}
