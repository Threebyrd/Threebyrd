import { BUSINESS_TIME_ZONE } from "../order-config.ts";

/** IDs and sequence are permanent; rescheduling changes dates, never identity. */
export type DeliveryCycle = Readonly<{
  id: string;
  sequence: number;
  deliveryDate: string;
  cutoffAt: string;
  chargeAt: string;
  status: "open" | "closed";
  closureReason?: string;
}>;

const dateFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: BUSINESS_TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit",
});

export function businessDateKey(instant: Date): string {
  const parts = Object.fromEntries(dateFormatter.formatToParts(instant).map((part) => [part.type, part.value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
}

export function instantMilliseconds(value: string): number {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?(?:Z|[+-]\d{2}:\d{2})$/.test(value) || !Number.isFinite(Date.parse(value))) {
    throw new Error("Use an explicit ISO timestamp with seconds and a UTC offset.");
  }
  const datePart = value.slice(0, 10);
  if (new Date(`${datePart}T12:00:00Z`).toISOString().slice(0, 10) !== datePart) throw new Error("Invalid calendar date.");
  return Date.parse(value);
}

export function validateCalendar(calendar: readonly DeliveryCycle[]): DeliveryCycle[] {
  const sorted = [...calendar].sort((a, b) => a.sequence - b.sequence);
  const ids = new Set<string>();
  const sequences = new Set<number>();
  let previousCutoff = -Infinity;
  let previousDelivery = "";
  for (const cycle of sorted) {
    if (!cycle.id.trim() || ids.has(cycle.id) || !Number.isSafeInteger(cycle.sequence) || cycle.sequence < 0 || sequences.has(cycle.sequence)) throw new Error("Cycle IDs and nonnegative sequence numbers must be unique.");
    ids.add(cycle.id); sequences.add(cycle.sequence);
    if (cycle.status !== "open" && cycle.status !== "closed") throw new Error("Invalid cycle status.");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(cycle.deliveryDate)) throw new Error("Use a YYYY-MM-DD delivery date.");
    const delivery = new Date(`${cycle.deliveryDate}T12:00:00Z`);
    if (!Number.isFinite(delivery.getTime()) || delivery.toISOString().slice(0, 10) !== cycle.deliveryDate || ![0, 6].includes(delivery.getUTCDay())) throw new Error("Delivery must be a valid Saturday or Sunday.");
    const cutoff = instantMilliseconds(cycle.cutoffAt);
    if (instantMilliseconds(cycle.chargeAt) !== cutoff) throw new Error("Charge time must equal the order/change cutoff.");
    if (businessDateKey(new Date(cutoff)) >= cycle.deliveryDate) throw new Error("Cutoff must precede the delivery date in New York.");
    if (cutoff <= previousCutoff || cycle.deliveryDate <= previousDelivery) throw new Error("Cycle chronology must agree with permanent sequence order.");
    previousCutoff = cutoff; previousDelivery = cycle.deliveryDate;
  }
  return sorted;
}

/** Future paid-order persistence must provide these locks from trusted storage. */
export function rescheduleCycle(
  calendar: readonly DeliveryCycle[], cycleId: string,
  changes: Pick<DeliveryCycle, "deliveryDate" | "cutoffAt" | "chargeAt">,
  lockedCycleIds: readonly string[],
): DeliveryCycle[] {
  if (!calendar.some((cycle) => cycle.id === cycleId)) throw new Error("Unknown delivery cycle.");
  if (lockedCycleIds.includes(cycleId)) throw new Error("Committed cycles require support resolution and customer notice.");
  return validateCalendar(calendar.map((cycle) => cycle.id === cycleId ? { ...cycle, ...changes } : cycle));
}
