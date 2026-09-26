import { inspectGoogleSheetsDestination } from "../../order-sheet-sync";
import { isAllowedCheckoutOrigin, withCheckoutCors } from "../cors";

export async function POST(request: Request) {
  // This endpoint is intentionally staging-only and read-only. The Apps Script
  // request remains authenticated with the server-side sync secret.
  if (process.env.STRIPE_MODE !== "test" || process.env.ORDERS_OPEN?.trim().toLowerCase() !== "false") {
    return new Response(null, { status: 404 });
  }
  if (!isAllowedCheckoutOrigin(request)) {
    return Response.json({ error: "This diagnostic origin is not allowed." }, withCheckoutCors(request, { status: 403 }));
  }

  const result = await inspectGoogleSheetsDestination();
  return Response.json(result, withCheckoutCors(request, { status: result.ok ? 200 : 502 }));
}

export function OPTIONS(request: Request) {
  if (!isAllowedCheckoutOrigin(request)) return new Response(null, { status: 403 });
  return new Response(null, withCheckoutCors(request, { status: 204 }));
}
