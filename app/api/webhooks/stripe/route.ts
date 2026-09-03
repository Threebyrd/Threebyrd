import type Stripe from "stripe";
import { getDb } from "../../../../db";
import { orders } from "../../../../db/schema";
import { getStripe } from "../../../stripe";

export async function POST(request: Request) {
  const stripe = getStripe();
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  const signature = request.headers.get("stripe-signature");

  if (!stripe || !webhookSecret || !signature) {
    return Response.json({ error: "Stripe webhook is not configured." }, { status: 503 });
  }

  let event: Stripe.Event;
  try {
    const payload = await request.text();
    event = stripe.webhooks.constructEvent(payload, signature, webhookSecret);
  } catch (error) {
    console.error("Stripe webhook signature verification failed", error instanceof Error ? error.message : "unknown error");
    return Response.json({ error: "Invalid webhook signature." }, { status: 400 });
  }

  if (event.type !== "checkout.session.completed") {
    return Response.json({ received: true });
  }

  const session = event.data.object as Stripe.Checkout.Session;
  const cart = session.metadata?.cart;
  if (!cart) {
    return Response.json({ error: "Checkout session is missing its order metadata." }, { status: 500 });
  }

  try {
    const db = getDb();
    await db.insert(orders).values({
      id: session.id,
      stripeSessionId: session.id,
      stripePaymentIntentId: typeof session.payment_intent === "string" ? session.payment_intent : null,
      status: "confirmed",
      customerEmail: session.customer_details?.email ?? null,
      customerName: session.collected_information?.shipping_details?.name ?? session.customer_details?.name ?? null,
      customerPhone: session.customer_details?.phone ?? null,
      deliveryAddress: JSON.stringify(session.collected_information?.shipping_details?.address ?? session.customer_details?.address ?? null),
      items: cart,
      amountCents: session.amount_total ?? 0,
      currency: session.currency ?? "usd",
      cutoffAt: session.metadata?.cutoffAt ?? null,
      createdAt: session.created,
    }).onConflictDoNothing({ target: orders.stripeSessionId });

    return Response.json({ received: true });
  } catch (error) {
    console.error("Confirmed Stripe order could not be recorded", error instanceof Error ? error.message : "unknown error");
    return Response.json({ error: "Order recording failed; Stripe should retry this webhook." }, { status: 500 });
  }
}
