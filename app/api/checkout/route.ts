import { getNextOrderCutoff, getOrderCapacityWindowKey, ORDERS_OPEN, quoteOrder, type CartItemInput } from "../../order-config";
import { getOrderCapacityConfig } from "../../order-capacity-config";
import { attachOrderCapacityReservation, releaseOrderCapacityReservation, reserveOrderCapacity } from "../../order-capacity-db";
import { getSiteOrigin, getStripe } from "../../stripe";
import { isAllowedCheckoutOrigin, withCheckoutCors } from "../cors";

type CheckoutRequest = {
  items?: CartItemInput[];
};

export async function POST(request: Request) {
  if (!isAllowedCheckoutOrigin(request)) {
    return Response.json({ error: "This checkout origin is not allowed." }, withCheckoutCors(request, { status: 403 }));
  }

  const environmentOrdersOpen = process.env.ORDERS_OPEN?.trim().toLowerCase() !== "false";
  if (!ORDERS_OPEN || !environmentOrdersOpen) {
    return Response.json({ error: "Orders are currently closed. Ordering will be opening soon." }, withCheckoutCors(request, { status: 503 }));
  }

  let body: CheckoutRequest;
  try {
    body = await request.json() as CheckoutRequest;
  } catch {
    return Response.json({ error: "We could not read that order. Please try again." }, withCheckoutCors(request, { status: 400 }));
  }

  const items = Array.isArray(body.items) ? body.items : [];
  const quote = quoteOrder(items);
  if (!quote.isValid) {
    return Response.json({ error: quote.errors[0] ?? "Add at least three boxes to continue." }, withCheckoutCors(request, { status: 400 }));
  }

  const cutoff = getNextOrderCutoff(new Date());
  if (Date.now() >= cutoff.getTime()) {
    return Response.json({ error: "This order window has closed. Refresh for the next Friday cutoff." }, withCheckoutCors(request, { status: 409 }));
  }

  const stripe = getStripe();
  if (!stripe) {
    return Response.json({ error: "Secure checkout is being configured. Please check back soon." }, withCheckoutCors(request, { status: 503 }));
  }

  const now = Math.floor(Date.now() / 1000);
  const reservationId = crypto.randomUUID();
  const capacityConfig = getOrderCapacityConfig(getOrderCapacityWindowKey(cutoff));
  const reservation = capacityConfig.limit === null
    ? null
      : {
        id: reservationId,
        windowKey: capacityConfig.windowKey,
        mealCount: quote.totalBoxes,
        reservedAt: now,
        expiresAt: now + capacityConfig.reservationTtlSeconds,
      };

  try {
    if (reservation) {
      const reserved = await reserveOrderCapacity(await getCapacityDatabase(), capacityConfig, reservation);
      if (!reserved) {
        return Response.json(
          { error: "Sold out for this week. Please check back for the next ordering window.", code: "CAPACITY_EXHAUSTED" },
          withCheckoutCors(request, { status: 409 }),
        );
      }
    }

    const siteOrigin = getSiteOrigin();
    const metadata: Record<string, string> = {
      cart: JSON.stringify(quote.lines.map((line) => ({ productId: line.productId, quantity: line.quantity }))),
      totalBoxes: String(quote.totalBoxes),
      subtotalCents: String(quote.subtotalCents),
      pricingTier: quote.pricingTier ?? "3-4",
      cutoffAt: cutoff.toISOString(),
    };

    if (reservation) {
      metadata.capacityReservationId = reservation.id;
      metadata.capacityWindowKey = reservation.windowKey;
    }

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      integration_identifier: `threebyrd_checkout_${randomLetters(8)}`,
      ...(reservation ? { client_reference_id: reservation.id, expires_at: reservation.expiresAt } : {}),
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
      metadata,
    });

    if (!session.url) {
      throw new Error("Stripe did not return a checkout link.");
    }

    if (reservation) {
      const attached = await attachOrderCapacityReservation(await getCapacityDatabase(), reservation.id, session.id);
      if (!attached) {
        throw new Error("Checkout session could not be linked to its capacity reservation.");
      }
    }

    return Response.json({ url: session.url }, withCheckoutCors(request));
  } catch (error) {
    if (reservation) {
      try {
        await releaseOrderCapacityReservation(await getCapacityDatabase(), { reservationId: reservation.id });
      } catch (releaseError) {
        console.error("Checkout capacity reservation cleanup failed", releaseError instanceof Error ? releaseError.message : "unknown error");
      }
    }
    console.error("Stripe Checkout Session creation failed", error instanceof Error ? error.message : "unknown error");
    return Response.json({ error: "Secure checkout is temporarily unavailable. Please try again." }, withCheckoutCors(request, { status: 502 }));
  }
}

async function getCapacityDatabase() {
  const { getDatabaseBinding } = await import("../../../db");
  return getDatabaseBinding();
}

export function OPTIONS(request: Request) {
  if (!isAllowedCheckoutOrigin(request)) {
    return new Response(null, { status: 403 });
  }

  return new Response(null, withCheckoutCors(request, { status: 204 }));
}

function randomLetters(length: number): string {
  const letters = "abcdefghijklmnopqrstuvwxyz";
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  return Array.from(bytes, (byte) => letters[byte % letters.length]).join("");
}
