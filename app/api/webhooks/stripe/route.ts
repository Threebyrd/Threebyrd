import type Stripe from "stripe";
import { recordConfirmedOrder, releaseOrderCapacityReservation } from "../../../../app/order-capacity-db";
import { getCartPricingTier, quoteOrder, readCartMetadata } from "../../../order-config";
import { getStripe, getStripeMode, isStripeEventForMode } from "../../../stripe";

export async function POST(request: Request) {
  const stripe = getStripe();
  const stripeMode = getStripeMode();
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  const signature = request.headers.get("stripe-signature");

  if (!stripe || !stripeMode || !webhookSecret) {
    return Response.json({ error: "Stripe webhook is not configured." }, { status: 503 });
  }

  if (!signature) {
    return Response.json({ error: "Invalid webhook signature." }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    const payload = await request.text();
    event = await stripe.webhooks.constructEventAsync(payload, signature, webhookSecret);
  } catch (error) {
    console.error("Stripe webhook signature verification failed", error instanceof Error ? error.message : "unknown error");
    return Response.json({ error: "Invalid webhook signature." }, { status: 400 });
  }

  if (!isStripeEventForMode(event.livemode, stripeMode)) {
    console.error("Stripe webhook mode does not match the Worker environment.");
    return Response.json({ error: "Webhook mode is not accepted by this environment." }, { status: 400 });
  }

  if (
    event.type !== "checkout.session.completed" &&
    event.type !== "checkout.session.async_payment_succeeded" &&
    event.type !== "checkout.session.async_payment_failed" &&
    event.type !== "checkout.session.expired"
  ) {
    return Response.json({ received: true });
  }

  const session = event.data.object as Stripe.Checkout.Session;

  if (event.type === "checkout.session.async_payment_failed" || event.type === "checkout.session.expired") {
    try {
      await releaseOrderCapacityReservation(await getCapacityDatabase(), {
        reservationId: session.metadata?.capacityReservationId,
        stripeSessionId: session.id,
      });
      return Response.json({ received: true });
    } catch (error) {
      console.error("Failed Stripe capacity reservation release", error instanceof Error ? error.message : "unknown error");
      return Response.json({ error: "Reservation release failed; Stripe should retry this webhook." }, { status: 500 });
    }
  }

  if (event.type === "checkout.session.completed" && session.payment_status !== "paid") {
    return Response.json({ received: true, deferred: true });
  }

  const cart = readCartMetadata(session.metadata?.cart);
  if (!cart) {
    return Response.json({ error: "Checkout session is missing its order metadata." }, { status: 500 });
  }

  const quote = quoteOrder(cart);
  const metadataTotalBoxes = Number(session.metadata?.totalBoxes);
  const metadataSubtotalCents = Number(session.metadata?.subtotalCents);
  const metadataPricingTier = session.metadata?.pricingTier;
  if (
    session.mode !== "payment" ||
    session.payment_status !== "paid" ||
    !quote.isValid ||
    quote.pricingTier !== (getCartPricingTier(quote.totalBoxes) ?? null) ||
    metadataTotalBoxes !== quote.totalBoxes ||
    metadataSubtotalCents !== quote.subtotalCents ||
    metadataPricingTier !== quote.pricingTier ||
    session.currency !== "usd" ||
    session.amount_total !== quote.subtotalCents
  ) {
    console.error("Confirmed Stripe session failed order reconciliation", session.id);
    return Response.json({ error: "Checkout session could not be reconciled." }, { status: 500 });
  }

  try {
    const database = await getCapacityDatabase();
    const reservationId = session.metadata?.capacityReservationId ?? null;
    const confirmedAt = Math.floor(Date.now() / 1000);
    const customerName = session.collected_information?.shipping_details?.name ?? session.customer_details?.name ?? null;
    const deliveryAddress = JSON.stringify(session.collected_information?.shipping_details?.address ?? session.customer_details?.address ?? null);
    const recorded = await recordConfirmedOrder(database, {
      stripeSessionId: session.id,
      stripePaymentIntentId: typeof session.payment_intent === "string" ? session.payment_intent : null,
      customerEmail: session.customer_details?.email ?? null,
      customerName,
      customerPhone: session.customer_details?.phone ?? null,
      deliveryAddress,
      items: JSON.stringify(cart),
      amountCents: session.amount_total,
      currency: session.currency,
      cutoffAt: session.metadata?.cutoffAt ?? null,
      createdAt: session.created,
    }, { reservationId, confirmedAt });

    if (!recorded) {
      console.error("Confirmed Stripe session could not be linked to an order", session.id);
      return Response.json({ error: "Checkout reservation could not be confirmed." }, { status: 500 });
    }

    return Response.json({ received: true });
  } catch (error) {
    console.error("Confirmed Stripe order could not be recorded", error instanceof Error ? error.message : "unknown error");
    return Response.json({ error: "Order recording failed; Stripe should retry this webhook." }, { status: 500 });
  }
}

async function getCapacityDatabase() {
  const { getDatabaseBinding } = await import("../../../../db");
  return getDatabaseBinding();
}
