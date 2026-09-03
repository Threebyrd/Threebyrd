import { getNextOrderCutoff, ORDERS_OPEN, quoteOrder, type CartItemInput } from "../../order-config";
import { getSiteOrigin, getStripe } from "../../stripe";

type CheckoutRequest = {
  items?: CartItemInput[];
};

export async function POST(request: Request) {
  if (!ORDERS_OPEN) {
    return Response.json({ error: "Orders are currently closed. Ordering will be opening soon." }, { status: 503 });
  }

  let body: CheckoutRequest;
  try {
    body = await request.json() as CheckoutRequest;
  } catch {
    return Response.json({ error: "We could not read that order. Please try again." }, { status: 400 });
  }

  const items = Array.isArray(body.items) ? body.items : [];
  const quote = quoteOrder(items);
  if (!quote.isValid) {
    return Response.json({ error: quote.errors[0] ?? "Add at least three boxes to continue." }, { status: 400 });
  }

  const cutoff = getNextOrderCutoff(new Date());
  if (Date.now() >= cutoff.getTime()) {
    return Response.json({ error: "This order window has closed. Refresh for the next Friday cutoff." }, { status: 409 });
  }

  const stripe = getStripe();
  if (!stripe) {
    return Response.json({ error: "Secure checkout is being configured. Please check back soon." }, { status: 503 });
  }

  try {
    const siteOrigin = getSiteOrigin(request);
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: quote.lines.map((line) => ({
        price_data: {
          currency: "usd",
          product_data: {
            name: line.name,
            description: "Meal prep with rice and broccoli · delivered Saturday",
          },
          unit_amount: line.unitAmountCents,
        },
        quantity: line.quantity,
      })),
      customer_creation: "always",
      phone_number_collection: { enabled: true },
      shipping_address_collection: { allowed_countries: ["US"] },
      success_url: `${siteOrigin}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${siteOrigin}/order?checkout=canceled`,
      metadata: {
        cart: JSON.stringify(quote.lines.map((line) => ({ productId: line.productId, quantity: line.quantity }))),
        totalBoxes: String(quote.totalBoxes),
        subtotalCents: String(quote.subtotalCents),
        cutoffAt: cutoff.toISOString(),
      },
    });

    if (!session.url) {
      return Response.json({ error: "Stripe did not return a checkout link. Please try again." }, { status: 502 });
    }

    return Response.json({ url: session.url });
  } catch (error) {
    console.error("Stripe Checkout Session creation failed", error instanceof Error ? error.message : "unknown error");
    return Response.json({ error: "Secure checkout is temporarily unavailable. Please try again." }, { status: 502 });
  }
}
