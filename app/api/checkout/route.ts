import { buildCheckoutMetadata, getDeliveryDateIso, getNextOrderCutoff, getOrderCapacityWindowKey, ORDERS_OPEN, quoteOrder, type CartItemInput } from "../../order-config";
import { getOrderCapacityConfig } from "../../order-capacity-config";
import { attachOrderCapacityReservation, releaseOrderCapacityReservation, reserveOrderCapacity } from "../../order-capacity-db";
import { getCheckoutClientKey } from "../../checkout-client";
import { expireCreatedCheckoutSession } from "../../checkout-recovery";
import { checkDeliveryEligibility, DeliveryEligibilityError } from "../../delivery";
import { getSiteOrigin, getStripe, safeErrorMessage } from "../../stripe";
import { isAllowedCheckoutOrigin, withCheckoutCors } from "../cors";

type CheckoutRequest = {
  items?: CartItemInput[];
  deliveryAddress?: unknown;
};

export async function POST(request: Request) {
  if (!isAllowedCheckoutOrigin(request)) {
    return Response.json({ error: "This checkout origin is not allowed." }, withCheckoutCors(request, { status: 403 }));
  }

  const environmentOrdersOpen = process.env.ORDERS_OPEN?.trim().toLowerCase() !== "false";
  if (!ORDERS_OPEN || !environmentOrdersOpen) {
    return Response.json({ error: "Checkout is temporarily unavailable. Please try again later." }, withCheckoutCors(request, { status: 503 }));
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
  let deliveryCheck;
  try {
    deliveryCheck = await checkDeliveryEligibility(body.deliveryAddress);
  } catch (error) {
    if (error instanceof DeliveryEligibilityError) {
      const status = error.code === "OUTSIDE_DELIVERY_ZONE" ? 422 : error.code === "PROVIDER_UNAVAILABLE" ? 503 : 400;
      return Response.json({ error: error.message, code: error.code }, withCheckoutCors(request, { status }));
    }

    return Response.json({ error: "The delivery checker is temporarily unavailable." }, withCheckoutCors(request, { status: 503 }));
  }

  const stripe = getStripe();
  if (!stripe) {
    return Response.json({ error: "Secure checkout is being configured. Please check back soon." }, withCheckoutCors(request, { status: 503 }));
  }

  const now = Math.floor(Date.now() / 1000);
  const reservationId = crypto.randomUUID();
  const clientKey = await getCheckoutClientKey(request);
  const capacityConfig = getOrderCapacityConfig(getOrderCapacityWindowKey(cutoff));
  const reservation = capacityConfig.limit === null
    ? null
      : {
        id: reservationId,
        windowKey: capacityConfig.windowKey,
        clientKey,
        mealCount: quote.totalBoxes,
        reservedAt: now,
        expiresAt: now + capacityConfig.reservationTtlSeconds,
      };

  let createdSession: { id: string; url: string | null } | null = null;
  try {
    if (reservation) {
      const reserved = await reserveOrderCapacity(await getCapacityDatabase(), capacityConfig, reservation);
      if (!reserved.ok) {
        if (reserved.reason === "active_reservation") {
          return Response.json(
            { error: "You already have a checkout in progress. Finish it or wait for it to expire before starting another.", code: "CHECKOUT_IN_PROGRESS" },
            withCheckoutCors(request, { status: 409 }),
          );
        }
        return Response.json(
          { error: "Checkout capacity is temporarily unavailable. Please adjust your cart and try again.", code: "CAPACITY_EXHAUSTED" },
          withCheckoutCors(request, { status: 409 }),
        );
      }
    }

    const siteOrigin = getSiteOrigin();
    const metadata = buildCheckoutMetadata({
      quote,
      reservationId,
      deliveryAddress: deliveryCheck.normalizedAddress,
      cutoff,
    });

    if (reservation) {
      metadata.capacityReservationId = reservation.id;
      metadata.capacityWindowKey = reservation.windowKey;
    }

    createdSession = await stripe.checkout.sessions.create({
      mode: "payment",
      integration_identifier: `threebyrd_checkout_${randomLetters(8)}`,
      ...(reservation ? { client_reference_id: reservation.id, expires_at: reservation.expiresAt } : {}),
      line_items: quote.lines.map((line) => ({
        price_data: {
          currency: "usd",
          product_data: {
            name: line.name,
            description: `Meal prep with rice and broccoli · free delivery ${getDeliveryDateIso(cutoff)}`,
          },
          unit_amount: line.unitAmountCents,
        },
        quantity: line.quantity,
      })),
      customer_creation: "always",
      phone_number_collection: { enabled: true },
      success_url: `${siteOrigin}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${siteOrigin}/order?checkout=canceled`,
      metadata,
    });

    if (!createdSession.url) {
      throw new Error("Stripe did not return a checkout link.");
    }

    if (reservation) {
      const attached = await attachOrderCapacityReservation(await getCapacityDatabase(), reservation.id, createdSession.id);
      if (!attached) {
        throw new Error("Checkout session could not be linked to its capacity reservation.");
      }
    }

    return Response.json({ url: createdSession.url }, withCheckoutCors(request));
  } catch (error) {
    if (reservation) {
      if (createdSession) {
        const expired = await expireCreatedCheckoutSession(stripe, createdSession.id);
        if (!expired) {
          console.error("Checkout session could not be expired after reservation linking failed");
        }
      } else {
        try {
          await releaseOrderCapacityReservation(await getCapacityDatabase(), { reservationId: reservation.id });
        } catch (releaseError) {
          console.error("Checkout capacity reservation cleanup failed", safeErrorMessage(releaseError));
        }
      }
    }
    console.error("Stripe Checkout Session creation failed", safeErrorMessage(error));
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
