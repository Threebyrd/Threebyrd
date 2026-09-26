export type OrderCapacityAvailability = {
  enabled: boolean;
  limit: number | null;
  confirmedMeals: number;
  reservedMeals: number;
  remaining: number | null;
  ordersOpen: boolean;
};

export function formatOrderCapacityMessage(availability: OrderCapacityAvailability): string {
  if (!availability.enabled || availability.limit === null || availability.remaining === null) {
    return "";
  }

  return availability.remaining === 0
    ? "Checkout capacity is currently full."
    : `${availability.remaining} meals available for checkout`;
}

export function isOrderCapacitySoldOut(availability: OrderCapacityAvailability | null): boolean {
  return availability?.enabled === true && availability.remaining === 0;
}
