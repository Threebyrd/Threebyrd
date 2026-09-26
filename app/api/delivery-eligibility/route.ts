import { checkDeliveryEligibility, DeliveryEligibilityError } from "../../delivery";
import { isAllowedCheckoutOrigin, withCheckoutCors } from "../cors";

export async function POST(request: Request) {
  if (!isAllowedCheckoutOrigin(request)) {
    return Response.json({ error: "This delivery checker origin is not allowed." }, withCheckoutCors(request, { status: 403 }));
  }

  let body: { address?: unknown };
  try {
    body = await request.json() as { address?: unknown };
  } catch {
    return Response.json({ error: "Enter the Ithaca address where this week’s meals should be delivered." }, withCheckoutCors(request, { status: 400 }));
  }

  try {
    const result = await checkDeliveryEligibility(body.address);
    return Response.json(result, withCheckoutCors(request));
  } catch (error) {
    if (error instanceof DeliveryEligibilityError) {
      const status = error.code === "OUTSIDE_DELIVERY_ZONE" ? 422 : error.code === "PROVIDER_UNAVAILABLE" ? 503 : 400;
      return Response.json({ error: error.message, code: error.code }, withCheckoutCors(request, { status }));
    }

    return Response.json({ error: "The delivery checker is temporarily unavailable." }, withCheckoutCors(request, { status: 503 }));
  }
}

export function OPTIONS(request: Request) {
  if (!isAllowedCheckoutOrigin(request)) return new Response(null, { status: 403 });
  return new Response(null, withCheckoutCors(request, { status: 204 }));
}
