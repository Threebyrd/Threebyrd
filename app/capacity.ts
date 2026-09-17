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
    return "Orders available this week";
  }

  return availability.remaining === 0
    ? "Sold out for this week"
    : `${availability.remaining} meals remaining this week`;
}

export function isOrderCapacitySoldOut(availability: OrderCapacityAvailability | null): boolean {
  return availability?.enabled === true && availability.remaining === 0;
}
