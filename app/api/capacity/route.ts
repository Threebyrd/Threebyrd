import { getNextOrderCutoff, ORDERS_OPEN } from "../../order-config";
import { getOrderCapacityConfig } from "../../order-capacity-config";
import { formatOrderCapacityMessage, type OrderCapacityAvailability } from "../../capacity";
import { getOrderCapacityAvailability } from "../../order-capacity-db";
import { isAllowedCheckoutOrigin, withCapacityCors } from "../cors";

export async function GET(request: Request) {
  if (!isAllowedCheckoutOrigin(request)) {
    return Response.json({ error: "This request origin is not allowed." }, withCapacityCors(request, { status: 403 }));
  }

  try {
    const cutoff = getNextOrderCutoff();
    const capacityConfig = getOrderCapacityConfig(cutoff.toISOString().slice(0, 10));
    const counts = await getOrderCapacityAvailability(await getCapacityDatabase(), capacityConfig);
    const environmentOrdersOpen = process.env.ORDERS_OPEN?.trim().toLowerCase() !== "false";
    const ordersOpen = ORDERS_OPEN && environmentOrdersOpen && Date.now() < cutoff.getTime();
    const availability: OrderCapacityAvailability = {
      enabled: capacityConfig.limit !== null,
      limit: capacityConfig.limit,
      ...counts,
      ordersOpen,
    };

    return Response.json({ ...availability, message: formatOrderCapacityMessage(availability) }, withCapacityCors(request, {
      headers: { "cache-control": "no-store" },
    }));
  } catch (error) {
    console.error("Order capacity availability is unavailable", error instanceof Error ? error.message : "unknown error");
    return Response.json({ error: "Weekly order availability is temporarily unavailable." }, withCapacityCors(request, { status: 503 }));
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

  return new Response(null, withCapacityCors(request, { status: 204 }));
}
